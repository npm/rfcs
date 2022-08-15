### References
relates to #581

----

# Registry Only Dependencies

## Summary

When auditing dependencies with `npm audit`, the npm CLI should have a mechanism for communicating (and optionally failing on) dependencies that _do not_ come from a registry, like a [git URL](https://docs.npmjs.com/cli/v7/configuring-npm/package-json#git-urls-as-dependencies).

> _**Note**: this RFC has a hard dependency on [`npm query`](https://github.com/npm/cli/pull/5000) landing to support its implementation._

## Motivation

In an effort to give users of npm more insight and transparency into the packages they are installing, knowing that a package is _not_ coming from a registry and thus is susceptible to mutability and related supply chain attacks from that vector, seems like a meaningful heuristic missing from the package manager.

Thus, npm should afford various levels of messaging and erroring through a flag to accommodate users of npm looking to gain this insight from their dependency graph.

## Detailed Explanation

For example a _package.json_ like this
```json
{
  "dependencies": {
    "@babel/cli": "^7.4.0",
    "eslint": "git+https://github.com/eslint/eslint.git"
  }
}
```

Would trigger a message to the console for **eslint** if the `warn` value was passed when running `npm audit`.

```sh
$ npm audit --only-registry-deps=warn

found 1 vulnerabilities

...
```

## Rationale and Alternatives

It could be argued that a user could write a script themselves that does all the look-ups and resolution from a given _package.json_ or _package-lock.json_ to vet their dependencies that way, potentially reusing arborist in a similar manner to how the CLI uses it.

However, when this issue was raised no other alternatives were suggested at the time, even the one above, so it seems that most feel (implicitly at least) that the package manager is in the best position to vet the source of dependencies before they can be installed, and communicate that information to the user.

## Implementation

When running `npm audit`, the user should be informed if _any_ dependency in the tree is not using a valid [semver range](https://docs.npmjs.com/cli/v7/configuring-npm/package-json#dependencies) and emit a message to the terminal communicating that information.  Effectively, the audit messaging should get raised if any of the dependencies qualify as a [`type` of **git** or **remote* dependency per this document](https://github.com/npm/npm-package-arg#result-object).

The flag would allow three values that the user could use to influence the level of messaging and command line behavior:
```sh
$ npm audit --only-registry-deps=silent|warn|fail

found N vulnerabilities

...
```

From a CLI perspective, this could easily (ideally) be delegated to the `npm query` command.
```sh
$ npm query ":is(:type(git,remote))"
```

### Options

#### Silent
Same behavior as it is now in the CLI effectively, in that there is no messaging in regards to the source of a dependency.

```sh
$ npm audit --only-registry-deps=silent
```

#### Warn (default)
Emits a log message to the terminal indicating that a dependency is referencing a non-registry URL.  
```sh
$ npm audit --only-registry-deps=warn

found 1 vulnerabilities

npm WARN eslint is not installed from a trusted source; using tarball URL <URL>.  Please read more about our guidelines at https://docs.npmjs.com/cli/....
```

This would be the default value for the command with or without a value passed to the flag.
```sh
# both would behave the same way
$ npm audit --only-registry-deps
$ npm audit --only-registry-deps=warn
```

#### Fail
Emits an error level log to the terminal indicating that a dependency has a non-registry URL AND exits the process with an exit code.

```sh
$ npm audit --only-registry-deps=fail

found 1 vulnerabilities

npm ERROR eslint is not installed from a trusted source; using tarball URL <URL>.  Please read more about our guidelines at https://docs.npmjs.com/cli/....
```

### Messaging

In addition to calling out these types of specifiers numerically, it would be good to have the messaging include information about the dependency graph, similar to the `npm why` or `npm explain`.  This is important as users will want to be able to use `overrides` for those cases which they don't have direct control over and / or report upstream.

For example, using the above **eslint** example, a more complete output might look like this:
```sh
$ npm audit --only-registry-deps=warn

found 1 vulnerabilities

npm WARN eslint is not installed from a trusted source; using tarball URL <URL>.  Please read more about our guidelines at https://docs.npmjs.com/cli/....

eslint@6.8.0 dev
node_modules/eslint
  dev eslint@"^6.8.0" from the root project

...
```

### Install
It is understood that `npm install` leverages `npm audit` but I believe the output of `npm audit` does not directly influence the behavior of `npm install`, say in the case using the `fail` option here.

If possible, it would be great for `npm install` to fail if `npm audit` fails.
```sh
$ npm install --fail-on-audit
```

### Documentation
In addition to being added to the `npm audit` docs, this behavior should probably be called out or referenced in other relevant area(s) of the CLI documentation, specifically in the [dependencies section of the docs](https://docs.npmjs.com/cli/v7/configuring-npm/package-json#git-urls-as-dependencies), where non semver range versions like git URLs are discussed.

## Prior Art

As far as I know, while other package managers allow installing from URLs and git repositories, none of them call it out as a potential anti-pattern or area of caution.
- **yarn**: [`add`](https://classic.yarnpkg.com/en/docs/cli/add#toc-adding-dependencies), [`install`](https://yarnpkg.com/cli/install)
- **pnpm**: [`add`](https://pnpm.io/cli/add#install-from-git-repository), [`install`](https://pnpm.io/cli/install)

This seems like a worthwhile area for npm to be the first mover.

To demonstrate, if you see [this demo repo](https://github.com/thescientist13/npm-query-registry-only-deps-rfc-demo) and follow the steps to `npm link` with a version that has `npm query`, you will see output for **eslint** but not **babel**, which is the desired outcome in this situation given that _package.json_ has eslint as a `git` dependency.

## Unresolved Questions and Bikeshedding

### Default Behavior
As proposed, the default behavior would be the `silent` option.  As part of a semver-major change, the default behavior could be changed to that of the `warn` option instead.

> _Decided that `warn` would be the appropriate initial default._

### Dependency Distinctions
A point raised was if different dependency types should have different rules applied to them, or if this flag should apply equally across direct and transitive dependencies alike.  ex.
- warn by default for direct dependencies
- hide by default for transitive dependencies
- etc

> _Decided that the upcoming `npm query` RFC would be the appropriate way to overlay more granular filtering and preferences.  Through this, `npm audit` could become over more powerful by elevating this RFC to signal other potential risks like for:_
>  - CVEs (default)
>  - Signatures
>  - Engines
>  - Peer Deps, et al

### Naming
Currently the flag is `--only-registry-tarballs` which while explicit, is a bit verbose.  I think the final flag name is less consequential / material to the ultimate objective of this RFC, as long as it gets clearly captured in relevant areas of the documentation.

> _Decided on a name of `--only-non-remote-deps` to account for local linking of packages done by a user intentionally._
>
> _Another name change made to call the flag `--only-registry-deps`._