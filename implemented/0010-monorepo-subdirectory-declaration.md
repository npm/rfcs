# Monorepo subdirectory declaration

**IMLPLEMENTED** by [#140](https://github.com/npm/cli/pull/140) and included in `npm@6.8.0`.

## Summary

Add an optional `directory` field to the `repository` declaration a package makes in its `package.json`. If populated, use this directory to construct a more accurate link to the package's source code from its www.npmjs.com show page, and include it in the API response from registry.npmjs.org.

## Motivation

Currently if a package is developed within a monorepo then npm has no knowledge of its location within that repo. That restricts the ability of npm or third party tools to provide helpful links to the package, or find its changelog.

For example, the npm listing for [react-dom](https://www.npmjs.com/package/react-dom) links to the root ouf the [react monorepo](https://github.com/facebook/react), as does the [react-dom API response](http://registry.npmjs.org/react-dom). It would be preferable to link to the [sub-directory](https://github.com/facebook/react/tree/master/packages/react-dom) in which react-dom is developed.

## Detailed Explanation

Package maintainers have the option to specify a `repository` object for their package, which takes `type` and `url` keys, or can be given a shorthand ([docs](https://docs.npmjs.com/files/package.json#repository)). The URL is intended to be passed directly to a version control system, so should not have directory details appended to it.

I propose add an additional, optional `directory` key to the `repository` object, which allows maintainers who develop packages within a monorepo to specify where within the monorepo it lives.

In the react-dom case, this would look like:

```
"repository": {
  "type": "git",
  "url": "https://github.com/facebook/react",
  "directory": "packages/react-dom"
}
```

## Rationale and Alternatives

Alternative 1 is to maintain the status quo. It is not currently possible to accurately link to the source code of a package being developed within a monorepo, and this is not a disaster. Why change it? It would technically be possible to figure out the location of the package by crawling the repo in some way.

Alternative 2 is to add the path details to the existing URL.

Alternative 3 is for monorepo packages to specify the full repository URL, including directory, as their `homepage`.

Alternative 1 isn't ideal because it makes it harder to build useful tools that take into account data in the package's repository. The best example is finding changelogs.

Alternative 2 isn't ideal because in cases where npm couldn't reverse engineer the root of the repo it would cause issues fetching it with a VCS client. Adding a separate string that has to be combined with the repo URL has a better failure case (for packages hosted by a provider that npm doesn't know how to deal with the directory could simply be ignored).

Alternative 3 isn't ideal because in cases where a monorepo has a non-repository homepage (such as React, which uses https://reactjs.org/), replacing it would leave no field for the monorepo's packages to specify that homepage. It also would not be clear that this is a field that is designed to be used by machines, rather than people.

## Implementation

Update the `package.json` documentation in the https://github.com/npm/cli repo to give details of the new `directory` field of the `repository` declaration.

## Prior Art

I'm not aware of any other tools that operate this way. Monorepos are particularly prevalent in the JS library development ecosystem.

## Unresolved Questions and Bikeshedding

- Aside from serializing it on the package show view and in the API, what, if anything, does npm use the current `repository` information for? Could this RFC improve those processes?
- Is there additional monorepo support work that this RFC can fit in to, or can it be approved on its own?
