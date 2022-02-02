# Package Distributions

## Summary

Today, maintainers utilize various strategies to distribute platform-specific versions of their software under a singular package namespace. Often, these strategies rely on `install` scripts or `optionalDependencies` with some type of bootloader implementation (ex. [`esbuild`](https://npmjs.com/package/esbuild?activeTab=explore)); borth are not ideal. The `npm` CLI should support a first-class/standard way for maintainers to define conditions in which a package distribution is reified in place of the origin target. 

## Motivation

As we continue progress towards, & focus on, creating reproducible installations/builds, we should actively reduce the **need** for bespoke package distribution implementations & install scripts.

## Detailed Explanation

Introduce a new field called `distributions` which will be utilized by the `npm` CLI to add & then conditionally reify a package in place of the initially named version (if satisfied).

## Rationale and Alternatives

### Optional Dependency Fallback:

The current best practice/work-around is to define all package distributions as `optionalDependencies` & rely on the environment failing to install them - then testing to see which dep successfully installed & use accordingly.

#### Example:
```json
{
  "name": "foo",
  "optionalDependencies": {
    "foo-win": "2.x",
    "foo-darwin": "2.x",
    "foo-android": "2.x"
  }
}
```

#### foo-android `package.json
```json
{
  "name": "foo-android",
  "os": [
    "android"
  ]
}
```

## Implementation

### Goals:
- Limit the amount of net-new concepts & scope (ie. try to use existing paradigms & building blocks as much as possible)
- Make this feature opt-in (at least initially)
- Implement in a way that allows for graceful degredation (ie. fallbacks/polyfills)

### Overview:
- `distributions` will be an `Array` of objects defining conditions where a different package will be refieid & linked as the original target
- `package-lock.json` will include _all_ distributions alongside the origin package (as it would for `optionalDependencies` today), but **only one** of these will be **reified on disk** ([as a link](#arborist-reify))
- `distributions` **cannot conflict** with one another or have different dependencies within the tree (ex. it is not possible to have one distribution with a peer on `react@15` and another on `react@16`)
- the **initial** conditional fields available will include the existing environment information `npm` already supports (ie. [`platform/os`](https://docs.npmjs.com/cli/v8/configuring-npm/package-json#os), [`arch/cpu`](https://docs.npmjs.com/cli/v8/configuring-npm/package-json#cpu), [`engines`](https://docs.npmjs.com/cli/v8/configuring-npm/package-json#engines))
- `npm` will create the _same_ tree when `distributions` are found; the only thing that will change is that the package matching the conditions is reified in place

#### Example

```json
{
  "name": "foo",
  "version": "1.2.3",
  "main": "index.js",
  "scripts": {
    "preinstall": "node-gyp rebuild"
  },
  "distributions": [
    {
      "engines": {
        "node": "10"
      },
      "platform": "win32",
      "package": "foo-native-win32-10@1.x"
    },
    {
      "platform": "linux",
      "arch": "x64",
      "package": "foo-native-linux-x64@2.x"
    },
    "..."
  ]
}
```

### `Arborist.buildIdealTree`:

* Place _all_ distribution targets as optional<sup>(or peer?)</sup> of the `foo` package
* Any that cannot be placed are not placed (eg, package not found, cannot be placed for conflicting peer deps, etc.), similar to `optionalDependencies`
* Record status of `idealTree` placed distributions of the main "foo" package, along with their selection criteria
- the `idealTree` **should not** be platform-specific

### `Arborist.reify`:

* Choose one distribution of the main package, and reify that
* **Do not** reify the others, or any of their dependencies (unless they are required to meet another dependency in the tree)
* Reify the main package as a `Link` to the chosen distribution

### For Publisher's:

* Publish the main package with the source, pointing to distribution package specifiers and selection criteria
* Publish pre-built distributions as needed

This is amenable to publishing distributions post-hoc as a CI build.  If any fail to build and publish, no matter, they will simply fail to install, and fall back to the main package.

### For Consumer's:

* Add a `foo` as a dependency
* Pre-built distributions will be added to lockfile.
* `require('foo')` will return the appropriate context-specific distribution if one was found successfully, or the original package if it was not.

> **Note:** There should be no chance of an exponential explosion in lockfile size, as we calculate every possible combination of distribution matrices.

## Use Cases

### Polyfills:
While this is most useful for slow and costly binary builds, it is also interesting for providing polyfills for node features.

#### Example:

```json
{
  "name": "fs-readdir",
  "version": "fs.readdir() guaranteed to have withFileTypes:true support",
  "distributions": [
    {
      "engines": { "node": "<v10.11.0"},
      "package": "fs-readdir-polyfill@1"
    },
    {
      "package": "fs-readdir-native@1"
    }
  ]
}
```

#### fs-readdir-polyfill `package.json`

```json
{
  "name": "fs-readdir-polyfill",
  "version": "1.2.3",
  "description": "polyfill the fs.readdir withFileTypes using fs.stat"
}
```

#### fs-readdir-native `package.json`

```json
{
  "name": "fs-readdir-native",
  "version": "1.2.3",
  "description": "just export require('fs').readdir"
}
```

> Notably, we could just as easily have the `fs-readdir-polyfill` define `fs-readdir-native` as a distribution when `"engines": {"node": ">=10.11.0" }`

## Prior Art

- Yarn's **Package Variants** Proposal: https://github.com/yarnpkg/berry/issues/2751

## Unresolved Questions and Bikeshedding

- Do we need to feature flag this for `npm@8`? ex. put this feature under a new flag (ex. `--with-distributions`)? Does that limit it's impact/usage?
- Should we outline best practices? 
  - ex. a best practice we could recommend for maintainers to ensure they're consumers are using `distributions` properly, & to avoid confusion, is to set `engines` value for `npm` & educate maintainers/consumers on `--engines-strict`

```json
{
  ...
  "engines": {
      "npm": "^8.4.0"
  }
  ...
}
```