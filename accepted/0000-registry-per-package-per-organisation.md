# Registry per package per organisation

## Summary

We want to install some private package from github registry and some public package from npm registry with the same scope organisation.

## Motivation

We use multiple registry, npm for public package, github for private package. We use multiple mono repos and want to host on github registry for simplicity. But we want to share with the community our public package on npm because everyone have his habits on npm registry.

## Detailed Explanation

We want to specify in `.npmrc` the different registry per packages per organisations.

- keep the scope registry for default
  - eg: `@unlikelystudio:registry=https://npm.pkg.github.com/`
- should let the possibility to add a registry per package per organisation.
  - eg: `@unlikelystudio/simpleql:registry=https://registry.npmjs.org/`
- let in package.json the developer of package the possibility to specify a registry for her package.
  - eg: `{registryUrl: "https://npm.pkg.github.com/"}`

## Rationale and Alternatives

We have considered other alternative:

- using the git url to specify our private/public github when we need to have our private registry on our project.
  - but side effect no script hook used on package.json when installed by git url.
- publishing on github and npm registry our package to prevent this sort of problem.
  - the method we use now in production.

## Implementation

{{Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

{{This section is optional if there are no actual prior examples in other tools}}

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}

## Unresolved Questions and Bikeshedding

From conversation during the Open RFC Meeting from sept 2nd, 2020.

The hackmd transcription ⬇️

````
Isaac: One small downside is the potential to create multiple codepaths in order to support that functionality
Isaac: One other thing we’ve seen in the past is a way to define registry per-package in package.json
```
````
