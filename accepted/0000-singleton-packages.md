# Singleton Packages

## Summary

Add a step to the graph analysis phase of `npm install` that causes it to fail when unable to resolve certain packages to a single instance/version due to semver constraints.  Would be best if this could happen prior to package downloads, if there's an index-fetch only

## Motivation

There are many situations where packages have implicit requirement to be the sole instance in the package tree:
 - Polyfills, which typically extend or wrap global methods and objects
 - Packages that wire global properties or methods onto to `window` or `document`
 - Packages that make use of implicit global registries such as `CustomElementsRegistry`
 - Frameworks which establish global concerns such as `mocha`, `react` or `angular`
 - Libraries which make use of `instanceof` in objects transacted by their public API

## Detailed Explanation

Any package which needs to ensure its uniqueness in the package tree would indicate so in its `package.json`, likely  `{"singleton": true}`, informing the install command to permit installation of only one instance in the entire tree.  If unable to resolve to a solitary version, due to semver constraints, installation would fail, providing a list of version conflicts and prompt with details about options for resolving the conflict.

A new feature for resolving version conflicts is neither part of this RFC nor a pre-requisite of it, but is an anticipated need.  See [Prior Art](#Prior%20Art) for more.

## Rationale and Alternatives

A failure during installation will be much easier to identify and troubleshoot than a runtime failure which may be obscure and may not have any noticable effect until breaking something in a production service.

Building this into the `npm` tool will protect the entire community of npm users from issues arising from version conflicts in singleton packages than deferring to opt-in packages/plugins.

Existing relevant discussions on the topic:

- https://github.com/npm/npm/issues/20185
- https://github.com/package-community/discussions/issues/3
- https://github.com/arcanis/build-pnm/issues/1

## Implementation

Continuing from *Detailed Explanation*, consider the following session when running `npm install ` for my project:

```
$ npm install
npm ERR! Singleton dependency conflict(s)...
npm ERR!   @webcomponents/webcomponentsjs@^1.0.0 in some-package@2.1.0
npm ERR!   @webcomponents/webcomponentsjs@^2.0.0 in other-package@0.9.0

npm ERR! A complete log of this run can be found in:
npm ERR!     C:\Users\usergenic\AppData\Roaming\npm-cache\_logs\2018-11-28T10_40_07_124Z-debug.log
```

I can clearly see here that `@webcomponents/webcomponentjs` is a dependency of two packages, `some-package@2.1.0` and `other-package@0.9.0` which each have mutually exclusive semver constraints.  I now know the nature of the problem I am dealing with and can work towards resolving it.

## Prior Art

Most package systems either assume everything is a singleton or nothing is.  In package systems which assume everything is singleton, there are *sometimes* override measures to support manual resolution of conflicts, but not always.  So while there is not prior art I can point to for the self-identifying singleton package, there is plenty of precedent for working around the problem of singleton conflicts and the need for supporting singletons.

[Bower](https://bower.io/) is an example of a package manager that installs everything as singletons and uses a [resolutions](https://github.com/bower/spec/blob/master/json.md#resolutions) map to direct the installer.

[Yarn](https://yarnpkg.com) which is a Node package manager, has a [resolutions](https://yarnpkg.com/lang/en/docs/package-json/#toc-resolutions)  map as well, originally for addressing conflicting dependencies only in `yarn install --flat` installations.  However, it has since been extended to support [selective resolutions](https://github.com/yarnpkg/rfcs/blob/master/implemented/0000-selective-versions-resolutions.md), enabling singleton installation of *some* packages while using traditional package tree layout for other node modules. to override conflicting versions.

[Bundler](https://bundler.io) for Ruby has been debating an override/resolutions feature for at least 7 years. [Current RFC](https://github.com/bundler/rfcs/pull/13)

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
