# `npm debug` command

## Summary

This RFC proposes an `npm debug` command to simplify debugging scripts and packages.

## Motivation

When developing

1. an executable npm package with a `bin` entry in `package.json`
1. a package with a `main` entry script in `package.json`
1. a tool configuration for an executable tool installed to `node_modules`
1. a multi-package workspace project

then without editor or IDE support there's only the `node --inspect` or `node --inspect-brk` command for starting a remote debug session for a JavaScript file. Since `node` has no inherent knowledge of an *npm package* its commands require typing a complete path to the JavaScript file that is meant to be debugged.

## Detailed Explanation

This RFC proposes an `npm debug` command to simplify debugging scripts and packages.

## Rationale and Alternatives

**Rationale:** Making debugging npm packages easier.

**Alternatives:**

1. `node --inspect` or `node --inspect-brk`
    - operates on a single JavaScript file and often requires lengthy command lines to specify the path of the target script file
    - can not use NPM package metadata
2.  editor or IDE support
    - requires an editor or IDE
    - typically requires creating or configuring a tool-specific launch configuration

The `npm debug` command facilitates npm's `package.json` manifest to simplify launching a debug session for packaged JavaScripts.

## Implementation

In general the `npm debug` command should be as consistent as possible with existing commands like `npm run` or `npm test` in terms of shared arguments, script or package selection, current working directory etc. *where applicable*. For example, to remain consistent with `npm run` the new command's `argv` MAY be separated from the debugged script's `script-argv` using `' -- '` (dashes enclosed in spaces).

The command launches a debug session but halts debugging until a remote debugger connects, similar to `node --inspect-brk`.

When being issued in a package directory subsequent commands should apply the given steps in the given order and *first-match-only*:

*Algorithm 1*

~~~
npm debug
~~~

1. run the run-script referred to by some `script.debug` property when present in `package.json`
1. launch a debug session for the script referred to by the `bin` property when present in `package.json` using `node --inspect-brk <bin-script>`
1. launch a debug session for the script referred to by the `main` property when present in `package.json` using `node --inspect-brk <main-script>`
1. fail with an `npm ERR!` otherwise.

*Algorithm 2*

~~~
npm debug <package>
~~~

1. search all `workspaces` for a target package `<package>` and apply *Algorithm 1* with the target package's `package.json`
1. search `node_modules` non-recursively for a target package `<package>` and apply *Algorithm 1* with the target package's `package.json`
1. fail with an `npm ERR!` otherwise.

*Algorithm 3*

~~~
npm debug <package> --workspaces
~~~

1. search `workspaces`, only, for a target package `<package>` and apply *Algorithm 1* with the target package's `package.json`
1. fail with an `npm ERR!` otherwise.

*Algorithm 4*

~~~
npm debug <package> --workspace=X
~~~

1. search only workspace `X` for target package `<package>` and apply *Algorithm 1* with the target package's `package.json`
1. fail with an `npm ERR!` otherwise.

## Prior Art

There are other development lifecycle commands like

- `npm start`
- `npm test`
- `npm publish`
- `npm run`

but none for debugging in particular.

## Unresolved Questions and Bikeshedding

- Separating `argv` and `script-argv` with extra dashes was proposed for consistency with `npm run`, only. When debugging an executable package with script arguments, regularly, then this is more of an annoyance, though. Make `debug` a command *without* own arguments and *sensible defaults* instead and rather refer to a `debug` run-script for using `node --inspect-brk` with additional debugger arguments?

- Include searching `workspaces` before `node_modules` in Algorithm 2 when no `--workspaces` argument is given?
