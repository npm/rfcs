### References
relates to #581

----

# Registry Only Tarballs

## Summary

When installing dependencies, the npm CLI should have a mechanism for communicating (and optionally failing on) dependencies that do not come from a registry, like a [git URL](https://docs.npmjs.com/cli/v7/configuring-npm/package-json#git-urls-as-dependencies).

## Motivation

In an effort to give users of npm more insight and transparency into the packages they are installing, knowing that a package is _not_ coming from a registry, and thus is susceptible to mutability and related supply chain attacks from that vector, seems like a meaningful heuristic missing from the package manager.

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

Would trigger a message  to the console for **eslint** if the `warn` value was passed.

```sh
$ npm install --only-registry-tarballs=warn
```

## Rationale and Alternatives

It could be argued that a user could write a script themselves that does all the look-ups and resolution from a given _package.json_ to vet their dependencies that way, potentially reusing arborist in a similar manner to how the CLI uses it.

However, when this issue was raised no other alternatives were suggested at the time, even the one above, so it seems that most feel (implicitly at least) that the package manager is in the best position to vet the location of dependencies before they can be installed, and communicate that information to the user.

## Implementation

As npm is building up the dependency graph, it should check if _any_ dependency in the tree is not using a valid [semver range](https://docs.npmjs.com/cli/v7/configuring-npm/package-json#dependencies) and emit a message to the user in the terminal.

The flag would allow three values that the user could be provided based on the outcome of messaging / behavior the user was looking for:
```sh
$ npm install --only-registry-tarballs=silent|warn|fail
```

### Silent (default)
Same behavior as it is now in the CLI, which is effectively that there is no consideration made for the location of a dependency.  This would be the default value of the flag as far as the npm CLI is concerned, or if the user used the flag but and did not pass any value.

```sh
# both would behave the same way
$ npm install --only-registry-tarballs
$ npm install --only-registry-tarballs=silent
```

### Warn
Emits a `console.log` to the terminal indicating that a dependency is installing via a non-registry URL.

```sh
$ npm install --only-registry-tarballs=warn 
npm WARN deprecated coffee-script@1.12.7: CoffeeScript on NPM has moved to "coffeescript" (no hyphen)
npm WARN eslint NOT installed from a registry, using tarball URL <URL>

added xxx packages, and audited xxx packages in 8s

...
```

### Fail
Emits a `console.error` to the terminal indicating that a dependency is installing via a non-registry URL AND then exits the process with an exit code.

```sh
$ npm install --only-registry-tarballs=error
npm WARN deprecated coffee-script@1.12.7: CoffeeScript on NPM has moved to "coffeescript" (no hyphen)
npm ERROR eslint NOT installed from a registry, using tarball URL <URL>

process exited with code ....
```

----

Additionally, this behavior should probably captured in relevant area(s) of the documentation, likely in the dependencies section of the docs, where non semver range versions are discussed.

## Prior Art

As far as I know, while other package managers allow installing from URLs and git repositories, none of them call it out as a potential anti-pattern or area of caution.
- **yarn**: [`add`](https://classic.yarnpkg.com/en/docs/cli/add#toc-adding-dependencies), [`install`](https://yarnpkg.com/cli/install)
- **pnpm**: [`add`](https://pnpm.io/cli/add#install-from-git-repository), [`install`](https://pnpm.io/cli/install)

This seems like a worthwhile area for npm to be the first mover.

## Unresolved Questions and Bikeshedding

### Default Behavior
As proposed, the default behavior would be the `silent` option.  As part of a semver-major change, the default behavior could be changed to that of the `warn` option instead.

### Dependency Distinctions
A point raised was if different dependency types should have different rules applied to them, or if this flag should apply equally across direct and transitive dependencies alike.  ex.
- warn by default for direct dependencies
- hide by default for transitive dependencies

### Naming
Currently the flag is `--only-registry-tarballs` which while explicit, is a bit verbose.  I think the final flag name is less consequential / material to the ultimate objective of this RFC, as long as it gets clearly captured in relevant areas of the documentation.