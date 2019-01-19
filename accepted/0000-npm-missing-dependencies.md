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

## Rationale and Alternatives

A solution to this issue was implemented in version 2.0.0. It focuses on importing the whole folder pasted in the project as a module. Hence, each module or component that is added to the project should contain a `package.json` that centralizes all its dependencies. Therefore, it becomes easy to make a project more modular.

The old answer to this issue was to create a symlink of the "module" added to the project, and basically adding it to the project's `package.json` using the path to the symlink. This method also involves implementing a `package.json` file for each "module".

These solutions assume that each folder or file copied and paste from a project to another should be considered as a package that appears as a dependency within the project's `package.json`. However, it causes some problems because it forces the developer to implement a `package.json` for each one of them, so potentially creating many extra files that could pollute the project's architecture. What this new feature is trying to achieve is basically to add all required dependencies to the project's `package.json` without adding extra files.

## Implementation

The implementation was done already in a fork here:

`https://github.com/tanohzana/cli`

Changes are the following:

- A file should be created in `lib` that would contain the source code for the feature
- Some tap tests shall be implemented to test the feature's different use cases
- A line should be added in `lib/config/cmd-list.js` to allow function call from cli
- Finally, a file containing documentation shall be implemented in `doc/cli`

None of these addings do interfer with any other CLI method. Although, it uses `npm install` to install missing dependencies but does not alter the way `install` works, not does it change its source code.

## Prior Art

Before reaching out and forking `npm cli`, this whole concept was part of a npm package that can be found here:

[Missing-packages](https://www.npmjs.com/package/missing-packages)

This package might carry a few glitches that were fixed in npm cli's fork and new feature implementation.

## Unresolved Questions and Bikeshedding

Some arbitrary decisions were taken such as what sentences should be used to prompt the user to install found dependencies. Also, the first draft of this feature was named `Missing packages` and I wished to change it into `Missing dependencies`, which would make more sense in my opinion. Any other name that'd make more sense shall be suggested ! Another arbitrary decision was to first deal with CommonJS's `require` and later implement ES6's `import`, and to only treat package.json's `dependencies` and not `devDependencies` at first.

Any suggestion are very much welcome.