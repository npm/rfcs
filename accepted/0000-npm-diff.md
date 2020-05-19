# npm diff

## Summary

Add a new command that enables diff workflows (similar to `git diff`) for
packages published in the registry.

## Motivation

- Package Consumers: Complements `npm audit` and `npm outdated` workflows by
providing insight on what changed across different versions of a package.
- Package Authors: Enables diff packlist-tracked-only file changes prior to
publishing a new version of a package, or while debugging past changes.

## Detailed Explanation

Introduce a new `npm diff` command that accepts one or more package specs and
uses these specs to compare files and print diff patches. Contents are fetched
using `pacote`, accepting any type of specs that the npm installer understands.

### npm diff --diff=`<spec>`

Using a single `<spec>` allows users to retrieve diff output between an
existing valid version of a package with the same **name** found in the actual
dependency tree and the exact `<spec>` match from the registry.

### npm diff --diff=`<spec-a>` --diff=`<spec-b>`

Fetches/reads contents of two versions of a package, represented by
`<spec-a>` and `<spec-b>` and prints diff output.

### npm diff (no arguments)

Meant as a helper tool to package authors, prints diff output between the
current file system dirs/files (tracked by packlist) and the last published
version of that package.

## Rationale

- A very common workflow is using npm outdated to figure out what dependencies
need update and then manually reviewing what changed in between the current
version you have in your project and whatever you can update to. That workflow
involves multiple steps, some of them being extra mental hurdle (such as
keeping track of the semver versions change and their meaning) some other very
manual such as jumping around to repos, scanning through changelogs, veryfing
semver contract is respected, etc.
- It feels very natural to have a `npm diff` from the point of view of a
user of `git diff`s - It does provide much more quick insight and transparency
on code that makes its way into our projects in a
([medium](https://en.wikipedia.org/wiki/Diff#Unified_format)) that most
developers are already familiar with.

## Alternatives

- Not have a native `npm diff` command and deffer to userland tools.

## Implementation

Parses user args and reads package contents for two different specs and run a
diff of each file, providing an usable patch output for users to work with.

### Parsing diff arguments logic

What should happen if using `npm diff` (no args) ?
What should be the expected behavior when using `npm diff --diff=<pkg>` ?
What if I use two `--diff=<pkg>@<version>` arguments?

Here's some of the sketch ideas that were initially put together to try
and answer these questions:

- IF NO arg:
  - READ `package.json` name
    - IF FOUND:
      - RETURN `package-json-name@tag` - `file:.`
    - ELSE:
      - THROW usage
- IF arg is `package-name` only:
  - READ arborist load actual tree AND PARSE `package-name`
    - IF NOT SPEC TYPE REGISTRY:
      - THROW unsupported spec type
    - IF FOUND:
      - RETURN `package-name@FOUND_VERSION`
    - ELSE:
      - RETURN `package-name@latest`
- IF arg is validl semver range|version:
  - READ `package-name` from either arg1 or arg2
    - IF FOUND:
      - RETURN `other-arg-parsed-name@arg`
    - ELSE:
      - READ `package.json` name
        - IF FOUND:
          - RETURN `package-json-name@arg`
        - IF NO `package.json`:
          - THROW error need to run from package dir to user versions

This argument parsing part of the implementation lives in the npm cli:
- [lib/diff.js](https://github.com/npm/cli/blob/latest/lib/diff.js)

### Generating patch diff contents

- [libnpmdiff](https://www.npmjs.com/package/libnpmdiff)

## Prior Art

- https://github.com/juliangruber/npm-diff
- https://github.com/g-harel/npmfs
- https://github.com/FormidableLabs/publish-diff
- https://github.com/sergcen/npm-package-diff

