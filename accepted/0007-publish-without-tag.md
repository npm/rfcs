# Publish older versions without a tag

## Summary

By default, running `npm publish` will update the `latest` tag so it points to the new version of the package being published (unless another tag is specified using `--tag <tag>`).

This makes sense when publishing a new version of the package that has a higher version number than the current release tagged with `latest`. But it doesn't make sense when releasing a version number that's lower than the version currently tagged `latest`.

Instead, `npm publish` should only update the `latest` tag if the package being published has a higher version number than the one currently tagged `latest`.

## Motivation

If you publish an older version of a package - say a patch for an older major branch - this new version will today be automatically tagged `latest` and will be the default package downloaded when a user runs `npm install <pkg>`. The version will also be listed as the latest on npmjs.com.

This is counter intuitive when publishing a patch to an older version of a package and normally _never_ what the publisher want.

Worst case scenario is that the publisher doesn't notice that the `latest` tag have changed, and users of the package will now start downloading older versions of the package without knowing a newer version exist.

## Detailed Explanation

If publishing a package whos version is less than the version tagged `latest`, the `latest` tag should not be updated unless specifically stated with `--tag latest`.

## Rationale and Alternatives

Currently possible:

- `npm publish --tag <tag>` - Publish using a tag
- `npm publish --tag <tag> && npm dist-tag rm <pkg> <tag>` - Publish using a throwaway tag that can be removed afterwards

Currently not possible, but would be an alternative solution:

- `npm publish --no-tag` - Explicitly don't tag the release

Publishing using an explicit tag can be seen as kind of a hack. It's not intuitive to users who are not well versed in npm internals. The alternative of introducing a `--no-tag` argument doesn't solve the problem for publishers who don't know about it (though it would be better than requiring publishers to use a tag).

## Implementation

{{Give a high-level overview of implementaion requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

{{This section is optional if there are no actual prior examples in other tools}}

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
