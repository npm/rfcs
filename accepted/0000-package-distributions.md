# Package Distributions

## Summary

Today, maintainers utilize various strategies to distribute platform-specific versions of their software under a singular package namespace. Often, these strategies rely on `install` scripts or `optionalDependencies` with some type of bootloader implementation (ex. [`esbuild`](https://npmjs.com/package/esbuild?activeTab=explore)); both are not ideal. The `npm` CLI should support a first-class/standard way for maintainers to define conditions in which a package distribution is reified in place of the origin target. 

## Motivation

As we continue progress towards, & focus on, creating reproducible installations/builds, we should actively reduce the **need** for bespoke package distribution implementations & install scripts.

## Detailed Explanation

Introduce a new field called `distributions` which will be utilized by the `npm` CLI to add & then conditionally reify a package in place of the initially named version (if satisfied).

## Rationale and Alternatives

### Optional Dependency Fallback:

The current best practice/work-around is to define all package distributions as `optionalDependencies` & rely on the environment failing to install them - then testing to see which dep successfully installed & use accordingly.

A major pit fall of this approach is that optional dependencies that don't get installed also don't get added to the package-lock.json. If a user were to install the `foo` package described below in Windows, only the `foo` and `foo-win` packages would be locked. A contributor to the same project working in MacOS would only get `foo` and `foo-darwin` locked. This creates churn that is especially noticeable in any project that is expected to run in multiple environments.

In addition to this, there is no requirement for any optional dependencies to be installed. This means it is a perfectly valid dependency tree to omit every single optional dependency.

Another significant concern is that after zero or more optional dependencies have been installed, the consuming package must attempt to require each of them wrapped in a `try/catch` block in order to discover which, if any, of its optional dependencies has been installed.

It's worth mentioning as well that this approach does not cover the use cases that are currently met by the `postinstall` script mentioned below, meaning that it is only possible to install platform specific dependencies as npm packages. The ability to download an arbitrary binary asset from an external host and place it within the package's own directory is not within the scope of optional dependencies.

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

### Optional dependency enhancements

The optional dependency approach detailed above has some problems with it, however some of those problems can be addressed within the scope of improving the current behavior of optional dependencies.

The primary change that would have to be made is that _all_ optional dependencies in a tree must be added to the `package-lock.json` regardless of whether or not the system running the install command is capable of installing each. This eliminates the churn in the lock file created by installations on multiple hosts.

The missing ability to require at least one of the optional dependencies listed can also be addressed in a separate feature by allowing for some additional metadata to be added to the `package.json` that signals at least one of a set of optional dependencies must be installed.

Working around the multiple attempts at `require` can realistically only be addressed by providing a pre-written function that wraps `require` to make this simpler.

Again, it is worth mentioning that these improvements still would not allow the retrieval of arbitrary binary assets to be placed within the package's directory. All platform specific dependencies would have to be npm packages.

### Postinstall scripts

Another common approach is to use a `postinstall` script that determines what binary asset is needed and fetches it when the `foo` package is installed. There are several significant concerns with this approach. If a user installs the package with `--ignore-scripts`, something that the npm team hopes to make the default in the future, the `postinstall` script will not be run and the binary asset will never be retrieved. In the event that the user installing the package does allow scripts to run, there are still additional concerns. Because the fetch is done manually, it lacks both the caching and integrity verification that npm packages provide _unless_ the maintainer implementing the script accounts for these needs. There is also the concern of the binary being hosted outside of the npm registry, meaning that users with fine grained firewalls would have to allow a new host and all users become vulnerable to that host being compromised.

For these reasons, the npm CLI team feels that a `postinstall` script is not considered a best practice and should be avoided.

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

### For Publishers:

* Publish the main package with the source, pointing to distribution package specifiers and selection criteria
* Publish pre-built distributions as needed

This is amenable to publishing distributions post-hoc as a CI build.  If any fail to build and publish, no matter, they will simply fail to install, and fall back to the main package.

### For Consumers:

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

- Do we need to feature flag this for `npm@9`? ex. put this feature under a new flag (ex. `--with-distributions`)? Does that limit it's impact/usage?
- Should we outline best practices? 
  - ex. a best practice we could recommend for maintainers to ensure their consumers are using `distributions` properly, & to avoid confusion, is to set `engines` value for `npm` & educate maintainers/consumers on `--engines-strict`

```json
{
  ...
  "engines": {
      "npm": "^8.4.0"
  }
  ...
}
```

- Do we really want to allow for arbitrary binary assets to be placed, or should this be restricted to npm packages?
- Do we want this feature to also address the use case of `full` vs `slim` packages, or `commonjs` vs `esm`? These are not platform specific dependencies, rather they are usage specific. Defining a way to retrieve these is currently outside of the scope of this feature but may be something to consider adding.

## Known risks

The `distributions` feature as described here has a significant known risk in the requirement of platform specific packages having no dependencies. This is often an impractical requirement and in some cases may even be impossible. Requiring that a distribution package has no dependencies creates a road block for adoption and may limit its usefulness in practice.
