# {{TITLE: Wider range for peer dependency prereleases}}

## Summary

A User should be able to specify a "semver" range, such that *all* prerelease versions within that range will match. For example a single range should be able to match the following versions:
`1.0.0-0`
`1.0.0`
`1.1.0-0`
`1.1.0-1`
`1.1.0`
`1.1.1-0`
Currently the closest is `^1.0.0-0` will only match `1.0.0-0`, `1.0.0` and `1.1.0`.

I'm focusing on peer dependencies in this RFC, but it could apply to resolving or matching any version (dependencies/devDependencies).

## Motivation

Take a library (called `library`) which follows semver and makes regular releases and prereleases. `library` has plugins. The plugins are guaranteed to work with a certain range of versions of `library`, including any and all prereleases in that range.

`library` plugins specify `library` as a peer dependency. i.e. `"library": "^1.0.0-0"`

Developers of `library` who release prereleases cannot properly test these prereleases with any existing plugin since any new 1.x prerelease which should be compatible with the plugin, will not match the peer dependency (only `library@1.0.0-0` will ever match).

On npm prior to 7, this causes warnings which don't really have a workaround.
On npm 7+ this causes either a failed `npm install` (peer not satisfied), or two versions of `library` being installed with `node_modules/plugin/node_modules` including the "wrong" version.


## Detailed Explanation

The plugins should specify that they require a peer dependency of "library", for example this plugin supports every release of the first major version - 1.0.0 to 1.9.9 (asuming 1.9.9 is the last 1.x.x version). Since "library" follows semver, a plugin user (and developer) should be able to use _any_ version of "library", including prereleases, alongside this plugin without any breaking changes.

As mentioned before, the plugin has a peer dependency, let's say `"library": "^1.0.0-0"` with the intent of supporting all 1.x versions of library including prereleases. If `library@1.2.0-0` is installed alongside the plugin, then the the peer dependency won't be satisfied, and the latest non-prerelease 1.x version of "library" will be installed alongside "1.2.0-0" which is not acceptable.

This is not a real issue for "regular" users of "library" who we could assume do not use prereleases (although it's not always the case), however it will directly impact the developers of `library`, who will be installing and testing their prereleases with existing plugins.

The point of the RFC is to discuss what changes could be made to NPM to allow for this use case, and for the expected peer dependency to be satisfied.


## Rationale and Alternatives

1. Updating the peer dependency range in your plugin to include every possible prerelease version explicitly. This is just unmaintainable.

Right now, the best workarounds are the following: 

2. On npm 6, you can just put up with a warning on npm install. The problem here is that users are pushed to update and install npm 7 so we can't force people to stick on older versions.
3. on npm 7 use the `legacy-peer-deps` flag/config. This isn't sustainable going forward, and can be removed in future versions, so we need to have a real solution.

Having to have these particular requiments for your module don't end up making it fit very well into an ecosystem where it can be installed alongside any number of other dependencies, and is not future proof.

## Implementation

To be honest i'm not sure what the solutions are here. It's a tricky one when relying on existing standards. It's either some sort of additional package.json setting for the dependency, an extension to semver, or pushes for a change to semver itself.

## Prior Art

{{This section is optional if there are no actual prior examples in other tools}}

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
