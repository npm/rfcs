# Publish set the tag accordingly to the semver version number

## Summary

Currently : Versions numbers have no direct connection with dist-tags.
It should be possible to run `npm publish` without specifying the `--tag` argument, instead it will pick the tag based on the semver version number (inside `package.json`).

## Motivation

Currently we can have a version number with the value : `16.0.3-beta.1` but released under the `latest` tag, that makes no sense in my opinion.
I don't see any use case, where you want to release under a version number with the value : `16.0.3-tagname.1` under the `latest` tag, if they are use cases, they would still be able to use the `--tag` argument, but it would be better to have a default behavior without `--tag`.

My use case is that we need to automate the workflow to publish npm packages with GitHub Actions, we run this command : `npm publish`, but even if I set my version number to `16.0.3-beta.1`, it would still be released under `latest` tag.
That makes difficult to automate the release process on different tags with git tag/release.

The `latest` tag can currently point to non-latest releases, making it a semantical non-sense.

## Detailed Explanation

Examples of various versions values inside `package.json`

`16.0.3` release the package attached to the `latest` tag
`16.0.3-tagname.1` release the package attached to the `tagname` tag
`16.0.3-beta.1` release the package attached to the `beta` tag

## Rationale and Alternatives

The only alternative solution is to set manually the tag with the `--tag` argument in the `npm publish` command.

## Implementation

{{Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

- Initial discussion in `npm/feedback` : <https://github.com/npm/feedback/discussions/194>
- Issue on `yarnpkg` about the same feature : <https://github.com/yarnpkg/berry/issues/2444>
- Mutability of the `latest` tag discussion : <https://github.com/npm/feedback/discussions/109>

## Unresolved Questions and Bikeshedding

- Should we delete the `--tag` argument of the `npm publish` command, since we now rely on the version number inside `package.json` ?
- Is there is any use case where you need to release a new version with the value `16.0.3-beta.1` to `latest` tag ?
