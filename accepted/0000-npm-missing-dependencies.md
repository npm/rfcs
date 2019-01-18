# New NPM CLI missing dependencies RFC

## Summary

View or install any missing dependencies from files or folders gathered from other projects or devs, right from the terminal.

## Motivation

There are several situations where required dependencies are not met in a Node.js project:
  - Using front-end frameworks, components can be passed from a project to another with dependencies
  - When passing utils from a project to another, several files could contain several dependencies

Today, when pasting folders between projects, all files added should be opened to check what dependencies are used and so to be installed.

## Detailed Explanation

NPM CLI would be extended with this new feature called `Missing Dependencies` that would be used this way: `npm md <name_of_folder>`. It would allow developers to simply copy and paste entire folders from a project to another and install required dependencies using a single command. For the first version of it, it would only check that the project's `package.json` contains all dependencies required in files added to the project using ES5 commonJS. ES6's `import` style shall be supported in further inhancements of the tool.

## `TODO`: Rationale and Alternatives

{{Discuss 2-3 different alternative solutions that were considered. This is required, even if it seems like a stretch. Then explain why this is the best choice out of available ones.}}

## Implementation

{{Give a high-level overview of implementaion requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

{{This section is optional if there are no actual prior examples in other tools}}

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
