# Local Hooks for npm Install Commands

## Summary

This RFC proposes adding a mechanism for users to define local hooks that execute before npm install commands, allowing custom validation scripts to run and prevent installation of packages that don't meet user-defined criteria. The primary use case is enabling security-conscious users to prevent installation of npm packages that are less than a configurable number of days old, though the mechanism is generic enough to support various security tooling integrations.

## Motivation

The npm ecosystem faces ongoing security challenges with malicious packages being published and quickly installed by unsuspecting users. While npm has implemented various security measures, there remains a gap in allowing users to implement their own security policies at installation time.

### Current Pain Points

1. **Supply Chain Attacks**: Malicious packages are often most dangerous in their first few hours/days after publication, before they can be detected and removed.

2. **Zero-Day Package Vulnerabilities**: New packages haven't had time for community review or security scanning.

3. **Lack of User Control**: Users currently have no programmatic way to enforce organizational security policies during package installation.

4. **Integration Challenges**: Security teams struggle to integrate their tooling into the npm installation workflow.

### Use Cases

1. **Package Age Validation**: Prevent installation of packages published less than X days ago
   ```bash
   # Example: Block packages less than 7 days old
   npm install express  # Would fail if express was updated < 7 days ago
   ```

2. **Security Scanner Integration**: Run organizational security scanners before allowing installation
   ```bash
   # Hook could call internal security API to validate package
   npm install some-package  # Hook validates with corp-security-scanner
   ```

3. **License Compliance**: Verify package licenses meet organizational requirements

4. **Internal Registry Validation**: Ensure packages come from approved registries

**Important Note**: This feature is intended for npm package **consumers** (users installing packages), not for package **publishers** (developers creating packages). This distinction is crucial for understanding the security model.

## Detailed Explanation

### Hook Configuration

Hooks would be configured in the user's `.npmrc` file or project's `.npmrc`:

```ini
# .npmrc
install-hook=/path/to/security-check.sh
install-hook-timeout=30000  # 30 seconds
```

### Hook Execution

1. **Timing**: Hooks execute after package resolution but before actual installation
2. **Environment**: Hooks receive package metadata via environment variables:
   ```bash
   NPM_HOOK_PACKAGE_NAME=express
   NPM_HOOK_PACKAGE_VERSION=4.18.2
   NPM_HOOK_PACKAGE_RESOLVED=https://registry.npmjs.org/express/-/express-4.18.2.tgz
   NPM_HOOK_PACKAGE_INTEGRITY=sha512-...
   NPM_HOOK_PACKAGE_PUBLISH_TIME=2023-10-25T10:30:00.000Z
   NPM_HOOK_EVENT=preinstall
   ```

3. **Exit Codes**:
   - `0`: Allow installation to proceed
   - Non-zero: Block installation with hook's stderr as error message

### Example Hook Script

```bash
#!/bin/bash
# security-check.sh - Prevent packages less than 7 days old

CURRENT_TIME=$(date +%s)
PUBLISH_TIME=$(date -d "$NPM_HOOK_PACKAGE_PUBLISH_TIME" +%s)
AGE_DAYS=$(( ($CURRENT_TIME - $PUBLISH_TIME) / 86400 ))

if [ $AGE_DAYS -lt 7 ]; then
  echo "Error: Package $NPM_HOOK_PACKAGE_NAME@$NPM_HOOK_PACKAGE_VERSION is only $AGE_DAYS days old" >&2
  echo "Security policy requires packages to be at least 7 days old" >&2
  exit 1
fi

# Additional checks could go here
exit 0
```

### Hook Behavior

1. **Batch Operations**: For `npm install` with no arguments, hook runs once per package
2. **Dependencies**: Hook runs for all dependencies (direct and transitive)
3. **Caching**: Hook results could be cached per package@version
4. **Failures**: Any hook failure prevents entire installation

### Security Considerations

1. **Hook Trust**: Users are responsible for their hook scripts' security
2. **No Network Access**: Hooks should complete quickly; long-running network calls discouraged
3. **Read-Only**: Hooks should not modify package contents
4. **Logging**: Hook executions logged for debugging

## Rationale and Alternatives

### Why This Approach?

1. **Flexibility**: Generic hook mechanism supports various use cases
2. **Simplicity**: Single script interface is easy to understand
3. **Compatibility**: Works with existing npm workflows
4. **User Control**: Empowers users to implement their own security policies

### Alternative 1: Built-in Package Age Checking

```ini
# Hypothetical built-in feature
npm-min-package-age=7d
```

**Pros**: Simpler for basic use case
**Cons**: Inflexible, doesn't support other security checks

### Alternative 2: External Wrapper Scripts

```bash
# Current workaround
security-npm install express
```

**Pros**: No npm changes needed
**Cons**: Poor integration, doesn't work with tools expecting standard npm

### Alternative 3: Registry-Level Controls

**Pros**: Centralized policy enforcement
**Cons**: Requires registry changes, not user-controlled

## Implementation

### npm CLI Changes

1. **Config Loading**: Add `install-hook` configuration option
2. **Hook Runner**: New module to execute hooks with proper environment
3. **Install Lifecycle**: Integration point before package extraction
4. **Error Handling**: Clear error messages when hooks fail

### Affected Components

- `lib/commands/install.js`: Hook integration
- `lib/utils/config/definitions.js`: New config options
- `lib/utils/lifecycle-hook-runner.js`: New hook execution logic
- Documentation updates

### Performance Impact

- Minimal for users without hooks configured
- Hook execution time adds to install time
- Potential for caching hook results

### Backwards Compatibility

- Feature is opt-in via configuration
- No impact on users without hooks configured
- Existing npm scripts and lifecycle scripts unaffected

## Prior Art

### pip (Python)
- `pip install --require-hashes`: Requires package hashes
- No direct hook mechanism, but supports custom index URLs

### RubyGems
- `gem install --trust-policy`: Certificate-based trust policies
- Plugin system allows custom security checks

### Maven (Java)
- Repository managers like Nexus provide policy enforcement
- No client-side hooks, but extensive plugin architecture

### Go Modules
- `GOPROXY` allows custom proxy servers with filtering
- `go.sum` provides integrity checking

## Unresolved Questions and Bikeshedding

1. **Configuration Format**: Should hooks be in `.npmrc` or `package.json`?
   - Current proposal: `.npmrc` for user-level control

2. **Multiple Hooks**: Should we support multiple hooks or hook chains?
   - Current proposal: Single hook for simplicity

3. **Async Hooks**: Should hooks support async operations?
   - Current proposal: Synchronous with timeout

4. **Hook Language**: Should we support non-shell hooks (Node.js, etc.)?
   - Current proposal: Shell scripts for simplicity

5. **Granularity**: Should hooks run per-package or per-install?
   - Current proposal: Per-package for fine-grained control