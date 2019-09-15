# Expose arborist metadata to lifecycle scripts

## Summary

When running any (?) lifecycle script for a package, insert the data for that package from `.arborist-metadata.json` into the environment.

## Motivation

For context, [`prebuild-install`](https://github.com/prebuild/prebuild-install) is a CLI that downloads prebuilt binaries for native modules and falls back to compiling the native module when no prebuilt binaries are available. It is typically used in the npm `install` lifecycle script, so that the prebuilt binary is available to a user after running `npm install`. In some cases, it is not desirable to download a prebuilt binary.

[RFC 0013](./0013-no-package-json-_fields.md), when implemented, breaks `prebuild-install` because `prebuild-install` uses the `_from` field in `package.json` to determine whether a package is installed as a dependency (`npm i foo`), root install project (`cd foo && npm i`) or as a git dependency. In the last two cases, `prebuild-install` skips the download step.

RFC 0013 states:

> These \[`_`-prefixed `package.json`\] fields are only relevant to npm.

However, tools like `prebuild-install` need access to the same information because they extend npm's functionality (until the day that npm itself can fill the gaps that exist in installing native modules).

## Detailed Explanation

This RFC proposes to expose the necessary metadata as environment variables. At the time of writing no other use cases of `_` fields are known, so it would suffice to expose the `resolved` field. It will be used by `prebuild-install` in two ways: skip download if `resolved` is either a git URL or not defined. This will in fact be more reliable than the `_from` package field, which is not guaranteed to exist.

## Rationale and Alternatives

- `prebuild-install` could instead read `.arborist-metadata.json`. This means reaching into the guts of npm and having to follow format changes to `.arborist-metadata.json`, increasing maintenance cost and possibly reducing support of different npm versions. Furthermore, having (a simple subset of) the metadata in the environment creates the opportunity for other package managers to do the same.
- Remove the features described above from `prebuild-install`. Moving the concern of "should we download" to the end user. Difficult for three reasons:
  1. `prebuild-install` users have grown accustomed to these features
  2. `prebuild-install` is integrated into other tooling like [`electron-rebuild`](https://github.com/electron/electron-rebuild)
  3. `prebuild-install` may live deep in a dependency tree (making it harder to control). Ideally `prebuild-install` is invisible and "just works".

## Implementation

- Metadata must be made available to [`npm-lifecycle`](https://github.com/npm/npm-lifecycle) (how and where?)
- `npm-lifecycle`, when invoking scripts, sets `<TBD>` in the environment

## Prior Art

None. To my knowledge, Yarn and pnpm do not expose similar metadata.

## Unresolved Questions and Bikeshedding

- What are the names of the environment variable(s)?
- Which scripts should get the metadata? Are there any reasons, like performance, to exclude certain scripts? The use case described above only needs `install` (and maybe `preinstall`, `postinstall` to be safe).
