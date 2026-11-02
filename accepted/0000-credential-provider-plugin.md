
# Credential Provider Plugin Protocol for Secure NPM Authentication

## Summary

This RFC proposes the implementation of a credential provider plugin protocol for the NPM CLI to enable secure, dynamic retrieval of authentication tokens. The protocol will allow external credential providers to supply short-lived tokens at runtime, eliminating the need to store secrets in plaintext within `.npmrc` files or environment variables.

## Motivation

Currently, NPM requires authentication tokens to be stored in plaintext within `.npmrc` files or injected via environment variables. 

This practice violates enterprise security policies and is a known vector for exploitation.

NPM also lacks a native hook to automatically acquire/refresh short-lived credentials. This discourages short token lifetimes (e.g., ≤ 60 minutes) because developers are forced into manual copy/paste rotation.

A standardized credential provider protocol fixes this at the tooling layer and enables modern enterprise authentication workflows (brokered auth, device-bound tokens, MFA, etc.) without compromising developer experience.

### Goals

- Enable runtime token acquisition via a standardized provider interface.
- Support short-lived tokens without manual rotation.
- Support scoped registries and multiple registry configurations.
- Support 3rd party registry authentication using npm cli and 3rd party credential providers.
- Graceful fallback behavior if no provider is available.

### Non-Goals
- Mandate a single identity provider or authentication mechanism (protocol is IdP-agnostic).
- Define a universal keychain-based storage requirement for Node tooling (providers may use OS keychains or brokers internally).
- Persist returned tokens to disk (explicitly avoided).


## Detailed Explanation

The proposed plugin protocol defines a standard interface for external credential providers that can be invoked by the NPM CLI during authentication workflows. When NPM needs credentials for a registry request (e.g., installing from or publishing to a private registry), the CLI will invoke a configured credential provider at runtime and receive a token in response. This design avoids persisting tokens in `.npmrc` or relying on environment variables as a long-term secret store.

### How it works (high level)

1. **Registry request requires auth**: NPM determines that a request to a registry requires authentication (install, publish, etc.).
2. **Select provider**: NPM checks for a provider configured globally or for the specific registry host.
3. **Invoke provider**: NPM executes the provider as a child process and receives a structured response over `stdout`.
4. **Use token in-memory**: NPM uses the returned token for the outgoing HTTP request without writing it to disk.
5. **In-process caching**: Respecting `expiresAt`, NPM will cache the token **in-memory for the lifetime of the process** to avoid repeated invocations during a single command (no persistence).
6. **Fallback / failure handling**: If no provider is configured, NPM continues with existing credential behavior. If a provider is configured but fails, NPM surfaces a errors written to `stderr` and NPM will fallback to legacy sources.

### Key components
- **CLI auth flow integration**: Detect when credentials are required and invoke the configured provider.
- **Registry scoping + multiple providers**: Support scoped registries by selecting providers per registry host and allowing multiple provider configurations.
- **Safe handling of secrets**: Tokens are handled in-memory, never written to `.npmrc` by NPM, and provider output is validated/sanitized.
- Fallback to plaintext secrets if no provider is configured

## Rationale and Alternatives

### Alternative 1: Continue using plaintext `.npmrc` tokens
- Rejected due to security risks and policy violations.
- Tokens are vulnerable to theft via malware or accidental exposure.

### Alternative 2: Encrypt `.npmrc` tokens locally
- Adds key management and cross-platform complexity
- Does not solve rotation/dynamic retrieval

### Alternative 3: Use environment variables exclusively
- Still violates secure secret storage policies and does not scale well for short-lived tokens.
- Difficult to manage securely across developer machines and CI/CD environments.

The plugin protocol is the most secure and flexible option and aligns with prior art (pnpm tokenHelpers, NuGet credential providers, pip keyring integration, Git credential helpers).

## Implementation

### Configuration & Registration

Providers are configured explicitly via npm config / `.npmrc`, with optional registry scoping.

1. Global provider
    - `credentialProvider=<command>`
2. Per-registry provider (recommended for scoped registries)
    - `//<registryHost>:credentialProvider=<command>`
        > Example: `//npm.pkg.github.com:credentialProvider=<command>`  
        > Example: `//org.pkgs.visualstudio.com/_packaging/project/npm/registry/:credentialProvider=<command>`  

This avoids implicit discovery in v1 and gives enterprises admin control (managed devices/images, bootstrap scripts, etc.).

#### `<command>` format examples

- `npm-credprovider --registry-type npmjs`
- `npm-credprovider --registry-type github`
- `artifacts-npm-credprovider -registry-uri https://org.pkgs.visualstudio.com/_packaging/project/npm/registry/`
- `artifacts-npm-credprovider -registry-uri https://org.pkgs.visualstudio.com/_packaging/project/npm/registry/ -interactive`
- `artifacts-npm-credprovider -registry-uri https://org.pkgs.visualstudio.com/_packaging/project/npm/registry/ -scope readonly`

### Invocation Model

When NPM requires credentials for a registry request (install/publish/etc.), it attempts:

1. Provider invocation (if configured)
2. Existing credential sources (current behavior)

Providers are executed as a child process:
- NPM executes `<command>` from `.npmrc`
- Provider returns a JSON response on **stdout**
- Provider may pass error logs to npm on **stderr**
- Provider may write debug/verbose logs to a file

### Protocol: Request / Response Contract

#### Request (NPM → Provider)
- Provider in invoked with exactly as specified by `<command>`
- No **stdin**

#### Response (Provider → NPM)
- Provider writes error logs to **stderr**
- Provider writes a single UTF-8 JSON object to **stdout**
- Example **stdout**:
    ```json
    {
        "_authToken": "", // bearer token
        "expiresAt": 0    // unix timestamp
    }
    ```
    ```json
    {
        "_auth": "",      // basic auth token
        "expiresAt": 0    // unix timestamp
    }
    ```
    ```json
    {
        "username": "",   // username
        "_password": "",  // password
        "expiresAt": 0    // unix timestamp
    }

## Prior Art

- **pnpm tokenHelper**: The pnpm tokenHelper calls an external script or binary using `child_process.spawnSync()` to outsource authentication and token storage to the external script or binary.
    - https://github.com/npm/cli/issues/8141
    - https://pnpm.io/settings#urltokenhelper
        > Usage; use the following settings in `.npmrc`:
        > ```
        > tokenHelper=/home/ivan/token-generator    // tokenHelper is the default for all registries
        > //registry.corp.com:tokenHelper=/home/ivan/token-generator    // tokenHelper scoped to registry.corp.com
        > ```
    - https://github.com/pnpm/pnpm/blob/8b5dcaac4d9752b9b4571aca73e2d50309b29944/network/auth-header/src/getAuthHeadersFromConfig.ts#L60
- **@azure/identity**: The `AzureCredential` interface is used by azure resource management libraries. Any concrete `AzureCredential` implementation can be used from any package as long as the implementation satisfies the interface.
    - https://www.npmjs.com/package/@azure/identity
    - This method would be more challenging because NPM cli would need to be updated to support new `CredentialProvider` interfaces and this would require more maintenance.
- **@aws-sdk/credential-providers**: Similar to `@azure/identity`, this credential provider interface can be implemented in code to support customer authentication chains. Some of these implementations include: From SSO, cognito identity, container metadata service, etc.
    - https://www.npmjs.com/package/@aws-sdk/credential-providers#createcredentialchain
    - Similar challenges compared to `@azure/identity`
- **NuGet Credential Providers:** NuGet supports external credential providers for secure token retrieval, widely adopted in enterprise environments.
- **pip Keyring Integration:** Python’s pip can retrieve credentials from OS keychains via plugins.
- **Git Credential Helpers:** Git supports credential helpers for dynamic authentication, including integration with OS keychains and cloud identity providers.

These examples demonstrate the viability and benefits of plugin-based credential retrieval in developer tooling.

## Unresolved Questions and Bikeshedding

- Plaintext secrets in .npmrc are still the default auth mechanism by default. Should we change the default and also supply a secure NPM Credential Provider with this RFC or is it okay to defer that implementation to a future RFC?
