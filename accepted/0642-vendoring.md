# Dependency vendoring

## Summary

Provide a mechanism to vendor all dependencies for a project in a more reproducible form than adding `node_modules` to version control.

## Motivation

A `node_modules` directory can differ between operating systems(/npm versions?), which presents pitfalls for projects that want to ensure full reproducibility of a given dependency tree, such as [Nixpkgs](https://github.com/NixOS/nixpkgs).

## Detailed Explanation

This would add a new command to the npm CLI, `npm vendor`. This command results in a reproducible {archive, directory} that contains all dependencies of the given project. Additionally, a configuration value will be added. When `npm install` and `npm ci` are ran with this value set to a valid path, they will pull from the vendored copies of dependencies.

## Rationale and Alternatives

To my knowledge, there are two alternatives:
1. Ship `node_modules`. This would work a good percent of the time, assuming `npm ci --ignore-scripts` is used, and all packages are installed across all operating systems.
2. Generate a cache, and point npm to that. Given that the cacache format hasn't changed in a number of years, nor has what npm stored in cache entry metadata, I'd say this is a pretty safe bet. However, I feel uneasy about relying on it, as it could break at any time.
3. Assuming all dependencies are marked as `bundledDependencies`, `npm pack` is another alternative. However, this depends on the local state of the `node_modules` directory, which isn't ideal for determinism reasons.

Given the pitfalls to these alternatives, I think having an official, sanctioned vendoring mechanism is the best solution.

## Implementation

Pacote will need to be changed to support pulling from vendored copies of dependencies, similar to how `make-fetch-happen` pulls from cacache when possible.

A command will need to be added to facilitate the generation of vendored dependencies.

This will also require a new module to be created to share schemas between the two entrypoints -- unless it fits in an existing one?

## Prior Art

### Go's [`go mod vendor`](https://go.dev/ref/mod#go-mod-vendor)

Go's dependency vendoring solution creates a directory. The contents of directory, for the same project (which means same `go.sum`, their lockfile), has changed between major Go versions. This is something we'd ideally avoid.

### Cargo's [`cargo vendor`](https://doc.rust-lang.org/cargo/commands/cargo-vendor.html)

## Unresolved Questions and Bikeshedding

None at the moment.
