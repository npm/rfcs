# Interactive audit resolver

## Summary

Add means for a human to resolve issues if they can't be fixed and interactively make decisions about each issue.
Remember the resolutions and allow them to affect `npm audit` behavior.
Decision options include 'ignore', 'remind later', 'fix', 'remove'.


## Motivation

At times, running `npm audit fix` won't fix all audit issues. Fixes might not be available or the user might not want to apply some of them, eg. major version updates to test dependencies.

It should be possible to make `npm audit` a step in a CI pipeline. Managing security of dependencies should be effective, easy to audit over time and secure in itself.

For that, the user needs a new tool which makes addressing issues one by one convenient.

## Detailed Explanation

TODO: expand bullets below

interactive CLI tool to speed up making and applying decisions
audit-resolv.json (or a section in package.json) to store the decisions
ability to postpone, ignore, remember fixed - all recorded for specific paths and issues, so the same issue found elsewhere would not get ignored
tools to help out when a fix is not yet known
resolutions and their changes are easy to track in git

## Rationale and Alternatives

{{Discuss 2-3 different alternative solutions that were considered. This is required, even if it seems like a stretch. Then explain why this is the best choice out of available ones.}}

- nsp check used to support ignoring a particular issue in all dependencies, but that's not enough to be in control and remain secure
- ignoring dev dependencies is not enough. sometimes the developer knows a vulnerability can be ignored because a package with a DOS is used in tooling for the project, not production code.
- manually handling all those issues doesn't scale

## Implementation

reference implementation https://github.com/npm/cli/pull/10

prototype of a working tool (in production use) https://www.npmjs.com/package/npm-audit-resolver

{{Give a high-level overview of implementaion requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

{{This section is optional if there are no actual prior examples in other tools}}

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}

I recall a tool wrapping `nsp check` that gave me the idea to store exact paths of dependencies set to ignore (or any resolution)

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
