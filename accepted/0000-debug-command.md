# `npm debug` command

## Summary

This RFC proposes an `npm debug` command to simplify debugging npm packages.

## Motivation

When developing

1. an executable npm package with a `bin` entry in `package.json`
1. a package with a `main` entry script in `package.json`
1. a tool configuration for an executable tool installed to `node_modules`
1. a multi-package workspace project

then without editor or IDE support there's only the `node --inspect` or `node --inspect-brk` command for starting a debug session for a JavaScript file. Since `node` has no inherent knowledge of an *npm package* its commands require typing a complete path to the JavaScript file that is meant to be debugged.

## Detailed Explanation

This RFC proposes an `npm debug` command to simplify debugging npm packages.

## Rationale and Alternatives

**Rationale:** Make debugging npm packages easier.

**Alternatives:**

1. `node --inspect` or `node --inspect-brk`
    - operates on a single JavaScript file and often requires lengthy command lines to specify the path of the target script file
    - can not use NPM package metadata
2.  editor or IDE support
    - requires an editor or IDE
    - typically requires creating or configuring a tool-specific launch configuration

The `npm debug` command facilitates npm's `package.json` manifest to simplify launching a debug session for packaged JavaScripts.

## Implementation

When applicable an `npm debug` command should be as consistent as possible with existing commands like `npm run`, `npm exec` or `npm test` in terms of

- naming of arguments the commands share,
- script or package selection,
- current working directory
- etc.

For example, it may share a similar synopsis like `npm exec`. Further to remain consistent the new command's `argv` MAY be separated from the debugged script's `script-argv` using `' -- '` (dashes enclosed in spaces).

### Expected Behavior

An `npm debug` command is supposed to launch a debug session which halts debugging until a remote debugger connects using `node --inspect-brk`. Subject to discussion, the following algorithms are being proposed when `npm debug` is *issued within a package directory*. Each step is supposed to be applied in the order given until `END.`.

*Algorithm 1*

~~~
npm debug
~~~

1. GIVEN a `script.debug` property is present in `package.json`
   - THEN run the run-script similar to how `npm start` would run `script.start`. END.
   - ELSE continue
1. GIVEN a `bin` property is present in `package.json`
   - THEN launch a debug session for the script referred to by the `bin` property using `node --inspect-brk <bin-script> <script-argv>`. END.
   - ELSE continue
1. GIVEN a `main` property is present in `package.json`
   - THEN launch a debug session for the script referred to by the `bin` property using `node --inspect-brk <main-script> <script-argv>`. END.
   - ELSE continue
1. EXIT with an `npm ERR!`. END.

*Algorithm 2*

~~~
npm debug <package>
~~~

1. GIVEN a search in all `workspaces` finds a target package `<package>`
   - THEN apply *Algorithm 1* with the target package's `package.json`. END.
   - ELSE continue
1. GIVEN a non-recursive search in `node_modules` finds a target package `<package>`
   - THEN apply *Algorithm 1* with the target package's `package.json`. END.
   - ELSE continue
1. EXIT with an `npm ERR!`. END.

*Algorithm 3*

~~~
npm debug <package> --workspaces
~~~

1. GIVEN a search in `workspaces`, only, finds a target package `<package>`
   - THEN apply *Algorithm 1* with the target package's `package.json`. END.
   - ELSE continue
1. EXIT with an `npm ERR!`. END.

*Algorithm 4*

~~~
npm debug <package> --workspace=X
~~~

1. GIVNE a search in workspace `X`, only, finds a package `<package>`
   - THEN apply *Algorithm 1* with the target package's `package.json`. END.
   - ELSE continue
1. EXIT with an `npm ERR!`. END.

## Prior Art

There are other development lifecycle commands like

- `npm start`
- `npm test`
- `npm publish`
- `npm run`

but none for debugging in particular.

- `npx debug` would install [debug](https://npmjs.com/package/debug). Though, that package focuses on entering/providing a "debug mode" for scripts that may be run with node but not within a node debugger session.

## Unresolved Questions and Bikeshedding

- Do proposed algorithms assist in implementing the RFC? Or should they be discussed separately within an issue? After all consistency with `npm run` or `npm exec` are more important than following any of the proposed algorithms, strictly.
- Include searching `workspaces` before `node_modules` in Algorithm 2 when no `--workspaces` argument is given?
