# Show dependencies of a particular dependency

## Summary

This proposal introduces a new feature of showing a complete dependency tree of a particular local package using `npm ls <package> --depth=n`.

## Motivation

At the moment, the `npm ls --depth=n` command only works without specifying a package name. This will list the dependency tree to the specified depth. However when the `<package>` argument is added, the command will only show the branch of the dependency tree up to the package, without listing the dependencies of the specific package. e.g. running `npm ls promzard@0.1.5` will show the following output:
```
npm@@VERSION@ /path/to/npm
└─┬ init-package-json@0.0.4
  └── promzard@0.1.5
```
instead of showing the dependencies of `promzard@0.1.5`.

## Detailed Explanation

Use `npm ls <package> --depth=n` to output the branch up to the specified depth. If `n` is less than the depth of the specified package, the output will be everything up to the depth of the package (disregarding the value of `n`). If `n` is greater than the depth of the specified package, the output will be everything in that branch up to the specified depth.

e.g. `npm ls --depth=2` will give the output of
```
npm@@VERSION@ /path/to/npm
└─┬ init-package-json@0.0.4
  └── promzard@0.1.5
    └── [whatever dependency promzard have]
```

## Rationale and Alternatives

- I believe this is the best option as it adds a new handy feature without altering the behaviour of the existing functionalities of `npm ls`.
- An alternative way is to use `npm view` but it only lists the dependencies without specifying whether those dependencies have been installed locally. Adding new features to this command will not be consistent with its existing functionalities.

## Implementation

- The parameters are already set in the current version of npm. Only need to address the presence of both `depth` and `<package>`. Expecting extra logic needs to be add.
- I have to admit that I have not looked into the technical details.

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

- Not aware of prior examples

## Unresolved Questions and Bikeshedding

N/A
