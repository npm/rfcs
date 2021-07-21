# RFC: Add `preunpack` life cycle script

## Summary

Add a `preunpack` life cycle script that runs before unpack.

## Motivation

npm v7 introduced a new order of running the `preinstall` script, where it runs **after** dependencies are installed, breaking backward compatibility with packages expecting to run a script **before** dependencies are installed.

By introducing a new life cycle script that will run first in the execution order on `unpack` events, we can give a path forward to packages that require a script to run **before** dependencies are installed.

Use cases:

* Handling authentication for private registries with short-lived tokens (i.e., AWS, GCP, Azure)
* Generating workspaces from gRPC proto files before workspaces and dependencies get evaluated.

## Detailed Explanation

A `preunpack` life cycle script that run **first** in execution order on installs (`unpack`).

Examples of when `preunpack` would execute:

* Runs on local `npm install` without any arguments
* Runs on non-local `npm install` (from a package being unpacked)
* Runs on `npm ci`

Example usage in the case of handling authentication for AWS CodeArtifact:

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "description": "A sample application consuming a private scoped npm package",
  "main": "index.js",
  "scripts": {
    "preunpack": "npm run co:login",
    "co:login": "aws codeartifact login --tool npm --repository my-repo --domain my-domain"
  },
  "dependencies": {
    "@myorg/my-package": "^1.0.0"
  }
}
```

When running `npm install`, the `npm run co:login` will be run before any dependencies are installed.

## Rationale and Alternatives

### Implement a separate top level "events" field

The idea here would be to implement a top-level "events" field to keep the current behavior of "scripts" while providing a better implementation elsewhere as described in [this comment](https://github.com/npm/cli/issues/2660#issuecomment-794415767).

This approach would undoubtedly address the use cases outlined above, but the scope may be too large when we need a quicker stop-gap for the interim.

### Revert back to the `preinstall` functionality from versions before v7

See [Unresolved Questions and Bikeshedding](#unresolved-questions-and-bikeshedding).

## Implementation

<!-- Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be. -->

<!-- THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted -->

## Prior Art

* npm v6

## Unresolved Questions and Bikeshedding

* Are there any security implications with this approach?
* Are we sure we don't want to revert back to the `preinstall` functionality of npm v6?

<!-- THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION -->
