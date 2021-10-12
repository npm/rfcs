# Add `lockfile-version` Config Flag

## Summary

Currently npm 7 can read `package-lock.json` versions 1, 2, and 3, but it
always writes version 2. It would be nice if npm 7 could write
`package-lock.json` version 3 instead.

## Motivation

npm 7 introduces new features which aren’t compatible with older npm
versions, such as workspaces. This makes npm 7 a minimum requirement for a
project.

Both `package-lock.json` version 1 and 3 files can be huge.
`package-lock.json` 2 is an intermediate format whose goal is to add
backwards compatibility with `package-lock.json` version 1 and npm 6. It
does so by writing both the dependency trees in the version 1 and 3
formats. This means the file is even twice as big as it needs to be. This
also means the same change appears twice in a diff, but in a different
format, meaning it needs to be reviewed twice. This is unnecessary if the
minimal required npm version is 7.

Additionally, on projects where both npm v6 and v7 may be used, it would be
preferable to keep the lockfile at version 1, to prevent unnecessary churn
in the source tree, as both npm versions attempt to convert the lockfile to
their format.

## Detailed Explanation

npm is expected to output the version of `package-lock.json` which is
configured in the `lockfile-version` config.  This also will be the version
used for `npm-shrinkwrap.json` files, following the same logic.

`lockfile-version` is a standard npm config optional, and can be set on the
command line, in the environment, or in any of the `npmrc` files that npm
handles.  It may take the possible values of `1`, `2`, `3`, and `null`,
with `null` being the default.

If set to a valid number, that lockfile version is used.

If set to `null`, then:

- Lockfiles of version 1 will be upgraded to version 2.
- Lockfiles of version 2 and higher will be saved back in their current
  version.

New major npm versions may drop support for old formats, add new supported
versions, or upgrade older lockfile versions to their new defaults.

## Implementation

- Add `lockfileVersion` option in `@npmcli/arborist`
- Default config with valid values in npm/cli config definitions.
