# Restore NPM 6 ability to install one package

## Summary

With NPM 6, it was possible to install a single package. [This is no longer the case with NPM 7](https://github.com/npm/cli/issues/3023).

## Motivation

My particular motivation is that in a monorepo, most of my projects use the same set of core dependencies, with only one or two specific dependencies for each project. I used to be able to install the core deps in the monorepo root, and only the specific deps in each project. The common ones were found in `../node_modules`. This massively reduced the install time and disk space usage, without having to resort to iffy symlinking via tools like `pnpm`.

Besides myself, there have been many Q&As about this ability on StackOverflow ([1](https://stackoverflow.com/questions/52786695/npm-install-always-installs-everything-from-package-json), [2](https://stackoverflow.com/questions/49732031/npm-install-single-package-without-rest-of-dependencies), [3](https://stackoverflow.com/questions/22420564/install-only-one-package-from-package-json/65233880#65233880)), which suggests [significant](https://en.wikipedia.org/wiki/1%25_rule_(Internet_culture)) general demand for the feature.

## Detailed Explanation

A flag like `npm install <package> --only` could drive installing only the specified package.

## Rationale and Alternatives

One alternative would be to install everything from `package.json`, then try to figure out repeated dependencies and delete those directories. Besides being very cumbersome, this would *increase* the install time.

Another one would be not declaring common dependencies at all in `package.json`.

## Implementation


## Prior Art

NPM 6

## Unresolved Questions and Bikeshedding

See https://github.com/npm/cli/issues/3023.
