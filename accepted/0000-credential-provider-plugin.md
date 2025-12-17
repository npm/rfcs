
# Credential Provider Plugin Protocol for Secure NPM Authentication

## Summary

This RFC proposes the implementation of a credential provider plugin protocol for the NPM CLI to enable secure, dynamic retrieval of authentication tokens. The protocol will allow external credential providers to supply short-lived tokens at runtime, eliminating the need to store secrets in plaintext within `.npmrc` files or environment variables.

## Motivation

Currently, NPM requires authentication tokens to be stored in plaintext within `.npmrc` files or injected via environment variables. 

This practice violates enterprise security policies and is a known vector for exploitation.

The expected outcome is a secure, extensible mechanism for token retrieval that supports enterprise-grade authentication workflows and aligns with modern security standards.

## Detailed Explanation

The proposed plugin protocol will define a standard interface for credential providers that can be invoked by the NPM CLI during authentication workflows. When a token is required (e.g., for publishing or installing from private registries), the CLI will call the configured credential provider, which will return a valid token. This avoids the need to persist tokens in `.npmrc` or environment variables.

Key components:
- CLI logic to detect when a credential is needed and invoke the provider.
- Support for scoped registries and multiple providers.
- Graceful fallback behavior if no provider is available.

## Rationale and Alternatives

### Alternative 1: Continue using plaintext `.npmrc` tokens
- Rejected due to security risks and policy violations.
- Tokens are vulnerable to theft via malware or accidental exposure.

### Alternative 2: Encrypt `.npmrc` tokens locally
- Considered but introduces complexity around key management and cross-platform support.
- Does not solve the problem of token rotation or dynamic retrieval.

### Alternative 3: Use environment variables exclusively
- Still violates secure secret storage policies and does not scale well for short-lived tokens.
- Difficult to manage securely across developer machines and CI/CD environments.

The credential provider plugin protocol is the most secure and flexible solution. It aligns with practices in other ecosystems (e.g., NuGet, pip, cargo, etc.) and supports enterprise use cases without compromising developer experience.

The credential provider plugin protocol enables:
- Short-lived credentials
- Ephemeral or encrypted token storage
- Enterprise-grade authentication workflows (e.g. MSAL brokered authentication with device-locked tokens, 2FA, conditional access policies, 1P and 3P private package registries)

## Implementation

Implementation will involve changes to the NPM CLI codebase, specifically:
- Modifying the authentication flow to check for a configured credential provider before falling back to existing token sources.
- Defining the protocol for provider invocation.
- Ensuring compatibility with scoped registries and multiple registry configurations.
- Adding telemetry and error handling for provider failures.

Security considerations:
- Ensure provider execution is sandboxed and does not introduce arbitrary code execution risks.
- Validate provider output format and sanitize inputs.

## Prior Art

- **NuGet Credential Providers:** NuGet supports external credential providers for secure token retrieval, widely adopted in enterprise environments.
- **pip Keyring Integration:** Python’s pip can retrieve credentials from OS keychains via plugins.
- **Git Credential Helpers:** Git supports credential helpers for dynamic authentication, including integration with OS keychains and cloud identity providers.

These examples demonstrate the viability and benefits of plugin-based credential retrieval in developer tooling.

## Unresolved Questions and Bikeshedding

- How will credential providers be registered? (e.g. bundled with npm-cli, well-known globally installed node_module, well-known and dynamically installed by npm-cli, etc.).
- Can custom credential providers be registered via a new setting in `.npmrc`?
- What is the expected output format (e.g., JSON, plain text)?
- How should errors be surfaced to the user?
- Should NPM CLI support caching of tokens returned by the provider or is this the provider's responsibility?
