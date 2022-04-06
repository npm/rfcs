# Scoped Command Config

## Summary

Implement a mechanism to scope configuration to commands explicitely.

## Motivation

This change will help resolve many issues user's face when configuring `npm` as the current strategy is to have a single set of global options available to **all** commands. 

## Detailed Explanation

- expand `.npmrc` to support command-specific configuration
- changes should be as backwards compatible as possible (old `.npmrc` files should still be supported)
- add clear documentation on configuration precedence (ex. arguments vs. command-specific vs. project, user & global vs. globally set vs. `publishConfig`)

## Rationale and Alternatives

Currently, the only alternative strategy users have is to manual pass arguments to `npm`.

## Implementation

- `npm` should support `npm-` prefixed command configuration in `.npmrc` files
- prefixed command configuration scopes the nested config

### Example `.npmrc`

```ini
omit=dev

# equivalent to `npm install --no-audit --no-fund`
[npm-install]
audit=false
fund=false

# equivalent to `npm audit --production`
[npm-audit]
production=true

# equivalent to `npm audit fix --force`
[npm-audit-fix]
force=true

# equivalent to `npm list --all`
[npm-list]
all=true

# equivalent to `npm publish --loglevel=silly`
[npm-publish]
loglevel=silly
```

## Prior Art

- N/A

## Unresolved Questions and Bikeshedding

- N/A