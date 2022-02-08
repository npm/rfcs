# Stop storing `integrity` for git dependencies

## Summary

We intend to stop storing the `integrity` field for dependencies installed from git.

## Motivation

Our integrity calculation and verification process looks at the final, compressed, result from packing a package. This raises issues because of potential platform and architecture differences in `zlib`.

## Detailed Explanation

When we install a git dependency, we clone the repository (or in some cases download an archive of the code, and extract it), we then install its dependencies and `npm pack` the resulting directory. That directory is then installed, and its integrity calculated and stored in the `package-lock.json`.

Due to the nature of compression, however, we are not guaranteed to generate a byte-identical result across platforms and operating systems, even if we have the exact same input. This leads to problems where multiple members of a team could receive `invalid checksum` errors for git dependencies.

## Rationale and Alternatives

To my knowledge there is no form of compression that guarantees idempotent results. That leaves us with a few options:

1. We remove the `integrity` calculation and verification for git dependencies.
2. We calculate the integrity of the package based on the `.tar` file before compression.

Due to option 2 being a very significant change to npm, and not being backwards compatible (i.e. packages published by an npm with this change would not be verifiable when installed with older versions of npm), it is an untenable approach at this time.

## Implementation

The `pacote` flow for git dependencies will be altered such that an `integrity` is never calculated, we will then ensure that `@npmcli/arborist` does not attempt to store the `integrity` field.

## Prior Art

None to my knowledge.

## Unresolved Questions and Bikeshedding

This change alters the security posture of npm with regards to git based dependencies. By not storing the `integrity` field, we have removed a layer of defense against the possibility of a git repository becoming compromised and a known hash and/or tag becoming overwritten. Is this risk acceptable?
