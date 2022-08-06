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

1. `node`
   ~~~
   node --inspect <path>
   node --inspect-brk <path>
   NODE_OPTIONS=--inspect-brk node <path>
   ~~~

   - requires a lengthy command line to specify the path of the target script file, esp. when the package to debug is a *third-party* package in `node_modules`
   - can not use knowledge of NPM package metadata
1. `npm run debug`

   - requires a package author to add a `debug` script to its `package.json`. The author then may choose to debug its own package using a `node` command line.
   - while possible it feels wrong for debugging third-party packages installed into `node_modules`

1.  editor or IDE support

    - requires an editor or IDE
    - typically requires creating or configuring a tool-specific launch configuration

1. `npx debug` is *not* an alternative. Rather it would install [debug](https://npmjs.com/package/debug) which is a decorator for `console.log` to write debug statements when running a `node` script in a "debug mode". It is not running in a debugger session.


## Implementation

### Synopsis

~~~
npm debug [package] [<argv>] [-- <script-argv>]

argv:
--bin [<name>]    // Debug the `bin` script or a particular `bin` script
--workspaces      // Search [package] in workspaces only (exclude node_modules)
--workspace=<ws>  // Search [package] in a particular package only
~~~

Synopsis and behavior should be as consistent as possible with existing commands like `npm run`, `npm exec` or `npm test`.For example, to remain consistent the new command's `argv` will be separated from the debugged script's `script-argv` using `' -- '` (dashes enclosed in spaces).

### Expected Behavior

Subject to discussion, the following algorithms are being proposed when `npm debug` is *issued within a package directory*. Each step is supposed to be applied in the order given until `END.`


*Algorithm 1*

[packagejson-bin]: https://github.com/npm/cli/blob/latest/docs/content/configuring-npm/package-json.md#bin
[packagejson-main]: https://github.com/npm/cli/blob/latest/docs/content/configuring-npm/package-json.md#main

~~~
npm debug
~~~

1. GIVEN a `script.debug` property is present in `package.json`
   - THEN run the run-script similar to how `npm start` would run `script.start`. END.
   - ELSE continue
1. GIVEN a [`bin`][packagejson-bin] property is present in `package.json`
   - THEN apply *Algorithm: Debug Executables*
   - ELSE continue
1. GIVEN a main property is present in `package.json`
   - THEN launch a debug session for the script referred to by the `main` property using `node --inspect-brk <main-script> <script-argv>`. END.
   - ELSE continue
1. EXIT with an `npm ERR!`. END.

*Algorithm: Debug Executables*

1. GIVEN the value of [`bin`][packagejson-bin] in `package.json` is a string
   - THEN launch a debug session for the script referred to by `bin`. END.
   - ELSE continue
2. GIVEN the value of [`bin`][packagejson-bin] in `package.json`  is an object
   1. GIVEN [`bin`][packagejson-bin] has multiple object properties
      - EXPECT a pair `--bin <name>` in `argv` of `npm debug`
      - EXPECT the value of `bin[name]` in `package.json` to be a non-empty string
      - THEN launch a debug session for `bin[name]`. END.
      - ELSE EXIT with `npm ERR`. END.
   2. GIVEN [`bin`][packagejson-bin] has a single object property
      1. GIVEN a pair `--bin <name>` in `argv` of `npm debug`
         - EXPECT the value of `bin[name]` in `package.json` to be a non-empty string
         - THEN launch a debug session for `bin[name]`. END.
         - EXIT with `npm ERR`. END.
      1. GIVEN a pair `--bin <name>` in `argv` of `npm debug` is missing
         - EXPECT the value of `Object.keys(bin)[0]` to be a non-empty string
         - THEN launch a debug session for `Object.keys(bin)[0]` END.
         - ELSE continue.
3. EXIT with `npm ERR`. END.


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

1. GIVEN a search limited to `workspaces` finds a target package `<package>`
   - THEN apply *Algorithm 1* with the target package's `package.json`. END.
   - ELSE continue
1. EXIT with an `npm ERR!`. END.

*Algorithm 4*

~~~
npm debug <package> --workspace=X
~~~

1. GIVEN a search in workspace `X`, only, finds a package `<package>`
   - THEN apply *Algorithm 1* with the target package's `package.json`. END.
   - ELSE continue
1. EXIT with an `npm ERR!`. END.

## Prior Art

There are other development lifecycle commands like

- `npm start`
- `npm test`
- `npm publish`
- `npm run`

but not a command for debugging in particular.

## Unresolved Questions and Bikeshedding

- Do proposed algorithms assist in implementing the RFC? Or should they be discussed separately within an issue? After all consistency with `npm run` or `npm exec` are more important than following any of the proposed algorithms, strictly.
- Include searching `workspaces` before `node_modules` in Algorithm 2 when no `--workspaces` argument is given?
