# Provide download counts by versions

## Summary

Now npm's registry APIs only support to get the total download counts for a given period or per day for a given period, for all packages or a specific package. From npm's website or other 3rd-party tools, users can't know the download counts by package versions.

{{A concise, one-paragraph description of the change.}}

## Motivation

Original issue: https://github.com/npm/download-counts/issues/6

As producers, packages authors can track adoption rates of their own packages, in order to determine future development directions. For example, `axios` maintainers released a prerelease version `0.20.0-0` on the `next` tag, and want to know how many users have downloaded the prerelease version. If the rate was enough and issues reported were not much, then a formal version can be released.

As consumers, packages authors can find out situations of their dependencies, then select appropriate scope to support. For example, when we wanted to publish a `webpack` plugin, we can only cover the major version.

{{Why are we doing this? What pain points does this resolve? What use cases does it support? What is the expected outcome? Use real, concrete examples to make your case!}}

## Detailed Explanation

{{Describe the expected changes in detail, }}

## Rationale and Alternatives

{{Discuss 2-3 different alternative solutions that were considered. This is required, even if it seems like a stretch. Then explain why this is the best choice out of available ones.}}

## Implementation

{{Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

{{This section is optional if there are no actual prior examples in other tools}}

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
