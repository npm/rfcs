# Secure NPM

## Summary

NPM Secure prevents to publish open source packages without an integrity check with the source code, especially for those packages that are a result of a build/compilation/transpilation process.

## Motivation

### Why are we doing this?
To improve NPM safety and security.

### What pain points does this resolve?
When a new package is being published on the NPM registry no one can say that the code is the same of that published on Github (or on to another public repo).

### What use cases does it support?
To prevent situations like these:

- https://hackernoon.com/im-harvesting-credit-card-numbers-and-passwords-from-your-site-here-s-how-9a8cb347c5b5
- https://github.com/eslint/eslint-scope/issues/39

### What is the expected outcome?
NPM should prevent to publish open source packages without an integrity check with the source code (stored online not on the file system of the author’s computer), especially for those packages that are a result of a build/compilation/transpilation process.
So, if an author wants to publish a new package that differs from its counterpart published on Github (or on to another public repo), NPM replies with an error.

## Detailed Explanation

I’ve created a Proof of Concept, called SNPM, that instead of allowing the user to push the code directly on NPM, they need to push it on a public repo (like Github) and then ask NPM to fetch it.
This procedure is validated using checksums of what being uploaded.

Whole and detailed explanation described here: https://hackernoon.com/secure-npm-ca2fe0e9aeff

## Rationale and Alternatives

### 1. unpkg.com
It inspects the code that’s actually published.
Unfortunately, this is a post-strategy (a curative one) and NPM should adopt a preemptive one.
I think this job should be done by NPM during the publishing phase and not then, by the user on a certain version of the package.

### 2. npm integrity
It should check the integrity between what has been published on the NPM registry and what's published on Github, for instance:

```
$ npm pack --dry-run --json react | grep integrity

> “integrity”: “sha512-7eocFH2ryezvBVXJbptblDSuLAQa8nOSDdAYtv/CHTG0btXuC1axHhVV6W8KVdWMNq7cF/w9Z/xVuoEK6IzXhQ==”,

$ npm pack --dry-run --json github:facebook/react#semver:16.4.1 | grep integrity

> “integrity”: “sha512-3GEs0giKp6E0Oh/Y9ZC60CmYgUPnp7voH9fbjWsvXtYFb4EWtgQub0ADSq0sJR0BbHc4FThLLtzlcFaFXIorwg==”,
```

Actually, I didn’t get on what files that checksum has been calculated.
Anyway, it does not prevent the author to publish malicious code on NPM's registry.

## Implementation

The specs are well detailed in this article: https://hackernoon.com/secure-npm-ca2fe0e9aeff
Here's a working Proof of Concept: https://github.com/wilk/snpm

It should inpact:
- the `npm build` command: it should build what will be published and put the checksum calculated from the build inside the `package.json`
- the `package.json`: it should contain the `checksums` field, as explained by CommonJS (http://wiki.commonjs.org/wiki/Packages/1.1#Catalog_Properties)
- the `npm publish` command: instead of uploading the source code directly on the NPM registry, it should fetch it from Github

## Prior Art
Cargo does something like SNPM: https://doc.rust-lang.org/cargo/reference/publishing.html#github-permissions

## Unresolved Questions and Bikeshedding
