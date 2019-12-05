# Let `npm run` traverse monorepo directory tree up to the root before failing

## Summary

Allow `npm run` command to traverse the directory tree up to the root level if it can't find a required `/node_modules/.bin` with executable command in subdirectory where it was executed from.

## Motivation

In the context of a multi-package monorepo where all dependencies are installed in the root `node_modules` it would've been very useful and convenient to have an ability to execute scripts from subdirectories that are packages within this monorepo without writing a full path to the root's `/node_modules/.bin` executable or adding a `prefix` to each run. Currently if you attempt to run a script from a subdirectory it will fail with `command not found` if there is no `/node_modules/.bin/` executable in the same subdirectory.

## Detailed Explanation

The expected change to `npm run` is to let it traverse the directory tree up to the root in search of an executable that may be stored in the root `/node_modules/.bin/`. If such executable doesn't exist anywhere in the directory tree then fail out.

### Example:

#### Folder structure:

```
monorepo-root
├─ node_modules
│  └─ .bin
│     ├─ react-docgen
│     ├─ rimraf
│     ├─ run-s
│     └─ webpack
├─ packages
│  ├─ foo
│  │  ├─ src
│  │  └─ package.json
│  ├─ bar
│  │  ├─ src
│  │  └─ package.json
│  └─ baz
│     ├─ src
│     └─ package.json
├─ package.json
└─ package-lock.json
```

#### scripts example for package `bar`

```json
bar - package.json
{
  "name": "@monorepo/bar",
  "scripts": {
    "build": "run-s clean prod comments",
    "prod": "BABEL_ENV=production webpack --mode production",
    "webpack:dev": "BABEL_ENV=development webpack --mode development",
    "build:dev": "run-s clean webpack:dev comments",
    "clean": "rimraf dist",
    "comments": "react-docgen ./src/components/ --exclude index.js --include Examples"
  }
}
```

With the above structure `npm run build` from bar directory will fail out with `sh: run-s: command not found` as it can't find `node_modules/.bin/run-s` in that directory.
Ideally, it would've been great if this command could attempt a directory tree traversal in search of this executable.

## Rationale and Alternatives

The rationale for this feature is coming purely from a Developer Experience where you may have different teams working on different packages within one monorepo. In this case it is convenient for one team to work within one package folder and being able to run various scripts from that location without workarounds.

There are 3 alternative solutions that somewhat resolve this problem:

### Solution #1

Write full paths in `scripts` to point to appropriate executables. The disadvantage of this approach is that each `package.json` file may be polluted and it will be hard to maintain it going forward:

```json
{
  "name": "@monorepo/bar",
  "scripts": {
    "build": "../../node_modules/.bin/run-s clean prod comments",
    "prod": "BABEL_ENV=production ../../node_modules/.bin/webpack --mode production",
    "webpack:dev": "BABEL_ENV=development ../../node_modules/.bin/webpack --mode development",
    "build:dev": "../../node_modules/.bin/run-s clean webpack:dev comments",
    "clean": "../../node_modules/.bin/rimraf dist",
    "comments": "../../node_modules/.bin/react-docgen ./src/components/ --exclude index.js --include Examples"
  }
}
```

### Solution #2

Use `--prefix ../..` each time when you run a script, e.g. `npm run --prefix ../.. build`.

This approach is a little bit cleaner than Solution #1 but still requires everyone to remember to prefix an executable. Working in large teams this `prefix` approach may be solved by documenting it but there is still a risk that people may forget to add `prefix`.

### Solution #3

Since this is a monorepo that may be managed with `lerna`, there is a way to execute these scripts from root by running `lerna run build` that will execute all build scripts in all packages or `lerna run build --scope bar` to execute it only in the `bar` package.

The disadvantage of this approach is that you need to constantly `cd` between root and your working directory and also scoping your script to a package that you work on.


## Implementation

This is an area that I may need help from `npm cli` team to determine the implementation details.

Ideal scenario would be for an `npm run command` to not fail immediately if there is no `node_modules` folder but to try to traverse the directory tree up to the root where it may find `node_modules/.bin` with appropriate executable.

## Unresolved Questions and Bikeshedding

-