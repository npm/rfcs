# npx should respect registry in .npmrc

## Summary

At the moment anything executed with `npx` is resolved against npm registry. However, for `npm` users can configure their own registry url. It would be good if `npx` respected this configuration option as well. 

## Motivation

In corporate environments the official npm registry might not be accessible, because a corporate registry like `Nexus` or `verdaccio` is available. In these scenarios `npx` currently does not work, because it cannot reach npm registry. The corporate registry is configured in `.npmrc`, so the configuration could be honored by `npx` too to make it usable in these environments too. 

## Detailed Explanation

Allow `npx` to read npm configuration and use it to contact the registry. 

## Rationale and Alternatives

* Introduce own configuration for `npx`: This should not be necessary as the registry to be used is probably the same as the one configured for `npm`. 

## Implementation

{{Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

{{This section is optional if there are no actual prior examples in other tools}}

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
