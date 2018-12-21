# Implement a package override option

## Summary

Add a section to package.json that allows the user to designate packages as an 'override' at a particular version.

## Motivation

In some situations, allowing more than one version of a package to be installed at the same time can cause unwanted behaviors. This will allow users to fix that by explicitly setting a single version to use.

## Detailed Explanation

Users will be able to add an additional dependency section called 'overrides' where they give a list of one or more packages to be installed at a specific version. Having this section will ensure that the only version of that package that is eventually installed to the project is the one set as an override. This will not affect the name, source, path, or other aspects of the package's installation.

## Rationale and Alternatives

Users don't frequently need to do this sort of override because npm's nested tree structure allows for a collection of dependencies to require incompatible semvers for the same package. In many cases, the default behavior is acceptable and nothing further is needed. In other, more problematic situations, the user may encounter conflicting binaries or other components that cannot be used simultaneously. The only current options are to attempt to get the maintainers of the dependencies to make changes that will reduce these conflicts, or to use a tool like `https://www.npmjs.com/package/replace-deep-dep` to repair the requirements.

## Implementation

{{In order to do this, the npm installer will need to read in an overrides section from `package.json`. This will have a simple format such as `overrides: { 'foo': '1.2.3' }`. These values will need to be used at the end of the tree-building process to select the final version. [Is there also a pruning element to this?]}}

## Prior Art

  - [Dart](https://www.dartlang.org/tools/pub/dependencies#dependency-overrides) uses a dependency override option that allows defining a specific source or version.
  - [Bower](https://github.com/bower/spec/blob/master/json.md#resolutions) has a setting for 'resolutions', which are package versions to fall back to if there's a conflict.
  - [Yarn](https://yarnpkg.com/en/docs/package-json#toc-resolutions) has a similar resolutions setting, which allows choosing a version or a file source. It allows a more complex system of selecting which packages the override will be applied to.

Our goal in this RFC is to provide the simplest possible solution to a less common but impactful problem. The most important part of this feature is to define a safe fallback for package versions that conflict.

## Unresolved Questions and Bikeshedding

Are there error situations that could occur? When should the installer exit or warn because the override will not be possible?

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
