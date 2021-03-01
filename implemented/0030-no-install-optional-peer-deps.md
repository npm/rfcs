# No auto-install for peerDependencies marked as optional

## Summary

Avoid automatically installing `peerDependencies` marked as optional using
`peerDependenciesMeta` and `{ "optional": true }`.

## Motivation

Package authors want to specify supported version ranges of
`peerDependencies`. They also want to set some peers as optional with
`peerDependenciesMeta` and `{ "optional": true }` to avoid automatically
installing them when an end-user installs their package.

As an example, let's take a database ORM package. The ORM package could support
upwards of a dozen different databases and require an end-user to install the
database adapter(s) needed for their project. These database adapters could be
huge and could have `peerDependencies`, `postinstall` scripts, and other
requirements.

It could significantly bloat a project's install time and dependency tree to
pull in tons of packages that an end-developer would never use.

## Detailed Explanation

- When a peer dependency is marked as `{ "optional": true }` using
  `peerDependenciesMeta`, it should not install automatically.

- `peerDependencies` without a `peerDependenciesMeta` value of
  `{ "optional": true }` should still install automatically.

### Example `package.json`

```json
{
  "peerDependencies": {
    "react": "^17.0.0"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    }
  }
}
```

## Rationale and Alternatives

Allows package authors to define their supported peer dependency SemVer ranges,
but maintain control over which peers should be auto-installed.

### Option A: Use `{ "autoinstall": false }` instead

Proposal [0025-install-peer-deps][0025-install-peer-deps] by @isaacs.

Providing `{ "autoinstall": false }` in `peerDependenciesMeta` currently has no
effect -- all `peerDependencies` are still installed. If support for
`{ "autoinstall": false }` was implemented, it would provide the same effect
this proposal is requesting.

The only downside with this approach is that the community has already adopted
`{ "optional": true }`. As of npm v6 `{ "optional": true }` is understood as the
way to avoid npm warnings over optional `peerDependencies`.

### Option B: Continue installing all `peerDependencies`

This makes package authoring much more difficult for tools such as ORMs and even
things like shared code quality configuration files. An author could have a
shared ESLint config that optionally peer depends on TypeScript if a project
needs it.

If all `peerDependencies` install automatically regardless of configuration,
package authors would need to release fragmented packages for each peer the
author intended to be optional.

Imagine the extra effort related to managing all aspects of maintaining both
`eslint-config-foo-base` and `eslint-config-foo-typescript`.

It's less than ideal and complicates publishing, to name a few issues:

- Creates lots of noise about which bug tracking issues are where for each
  package.

- Opens up the possibility of version mismatching when a user would need to
  install both `eslint-config-foo-base` and `eslint-config-foo-typescript`.

- Easy for package authors publishing manually to slip up and forget to publish
  all packages.

## Implementation

- The easiest option is to filter out optional `peerDependencies` before
  auto-installing in `@npmcli/arborist`.

- Let `@npmcli/arborist` issue warnings and errors for mismatched/unsupported
  `peerDependencies` the same as it does now in npm v7.
  
  For example, specifying `{ "react": "^17.0.0" }` defined in `dependencies`
  and then installing a package with an exact peer dependency of
  `{ "react": "14.0.0" }`, should result in the same exact warnings/errors
  regardless of `react` being marked as optional in `peerDependenciesMeta`.

## Prior Art

- [0025-install-peer-deps][0025-install-peer-deps] by @isaacs proposes using
  `peerDependenciesMeta` paired with `{ "autoInstall": false }` to achieve the
  same effect. Instead, this proposal omits the need for a new field and
  leverages the already well-known and used `{ "optional": true }`.

[0025-install-peer-deps]: https://github.com/npm/rfcs/blob/latest/implemented/0025-install-peer-deps.md
