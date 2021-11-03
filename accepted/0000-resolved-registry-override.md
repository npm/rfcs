# Resolved registry overrides

## Summary

Create a mechanism that allows users to create package-locks that can be used
with different custom registries.

## Motivation

package-lock files include the resolved url of dependencies installed from the
registry.  When npm installs packages with a lock file the resolved url is
preferred to the configured registry. npm may install packages from a different
registry than the user intended or installation may fail if the resolved url is
not available.  

npm treats the default registry, registry.npmjs.org, as a magic value meaning
'the currently configured registry'.  If the lock file uses the default
registry npm will install packages from the configured registry.  This feature
lets packages switch from the default registry to a custom registry without
deleting or editing the lock file, however packages with a custom registry in
their lock file cannot switch to another registry.

We build npm projects in different contexts using different custom registries.
Our current solution is to delete the resolved key from lock files after the
file is updated. This is a pain when users forget to run the script and lock
files are left with references to the wrong repository.

npm v7 seems to have changed the behavior of resolved in npm-shrinkwrap
files[^1]. This caused errors on our CI servers with limited network access
when installing aws-cdk packages that include registry.yarnpkg.com in their
shrinkwrap. npm v6 would ignore the resolved key and install aws-cdk's
dependencies from our allow-listed custom registry. npm v7 would read the
resolved key and fail to install from the blocked yarnpkg registry. We've fixed
this for new versions of aws-cdk[^2] but still cannot install old versions. 

This RFC proposes an npm option that would enable generating and reading lock
files without a resolved field.

[^1]: npm/cli#3783
[^2]: aws/aws-cdk#16607

## Detailed Explanation

npm can already install packages with lock files that do not include a resolved
field. npm will resolve the package version from the current registry. This is
less efficient than using resolved urls because an extra request must be made
for each package.

When `$disable-write-resolves` is true npm will omit the resolved key from
registry dependencies when creating package-lock or npm-shinkwrap files. 

When `$disable-read-resolves` is true npm will ignore the resolved key from
registry dependencies when reading package-lock or npm-shrinkwrap files. prior
to npm v7 it seemed that npm would ignore the resolved key in npm-shrinkwrap
files npm/cli#3783.

## Rationale and Alternatives

### Alt 1: `$record-registry` option

Add an option that overrides the registry recorded in lock files. By setting
this option to the default registry npm will create a lock file that will
effectively use the configured registry.

This option and the current magic default registry behavior both rely on
registries hosting files at the same paths. If a lock file has `resolved:
https://registry.npmjs.org/npm/-/npm-8.1.0.tgz` you cannot switch to a custom
registry that hosts tarballs under `/tarballs/npm-8.1.0.tgz`. 

### Alt 2: new registry:// protocol

The new protocol would indicate that the path should be resolved relative to
the current registry. This might require a new lock file version and has the
same downsides as Alt 1 but is less magical. 


## Implementation

> Stub for initial submission
> I think npm/arborist reads and writes lock files.
> https://github.com/npm/arborist/blob/726ceff003ff9688d04a529639d9d606d3422af0/lib/arborist/reify.js#L707-L717

## Prior Art

> N/A 

## Unresolved Questions and Bikeshedding

I've left config names as placeholders. `$disable-write-resolves`,
`$disable-read-resolves`