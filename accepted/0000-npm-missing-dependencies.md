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

A solution to this issue was implemented in version 2.0.0. It focuses on importing the whole folder pasted in the project as a module. Hence, each module or component that is added to the project should contain a `package.json` that centralizes all its dependencies. Therefore, it becomes easy to make a project more modular.

The old answer to this issue was to create a symlink of the "module" added to the project, and basically adding it to the project's `package.json` using the path to the symlink. This method also involves implementing a `package.json` file for each "module".

These solutions assume that each folder or file copy and paste from a project to another should be considered a package that appears as a dependency within the project's `package.json`. However, it causes some problems because it forces the developer to implement a `package.json` for each one of them, so potentially many extra files that could pollute the project's architecture.

## Implementation

{{Give a high-level overview of implementaion requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

{{This section is optional if there are no actual prior examples in other tools}}

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
