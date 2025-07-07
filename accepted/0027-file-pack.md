# new install protocol file+pack

## Summary

Imported from https://github.com/npm/cli/issues/1333

Add a way to install local folder dependencies by first running `pack` script to trigger any build process required to generate distributable files before linking generated tarball to requesting module.

## Motivation

{{Why are we doing this? What pain points does this resolve? What use cases does it support? What is the expected outcome? Use real, concrete examples to make your case!}}
When using local package dependencies, they usually require a build process which should be triggered before linking. I've seen a similar issue to this one: https://github.com/npm/cli/issues/459#issue-520571016

Also a lot of times when using local package dependencies dependency hoisting and linking does not match the same as installing from a tarball, which has been reported in some issues before:

https://github.com/npm/cli/issues/529#issuecomment-577635266

https://github.com/npm/cli/issues/702

From [@isaacs](https://github.com/isaacs) comments:

> It seems like at least part of the need here stems from the fact that you want the `prepare` script to be run in the linked dep.  Could we get part of the way with a flag to just tell npm to do that?  Ie, `npm install --rebuild-links` or something?  That flag would also be respected by default by the rebuild command, so you could do `npm rebuild --rebuild-links` when you know something's changed, and even set up a watcher to do that while in development.  (This would be considerably faster than creating and unpacking a tarball.)

## Detailed Explanation

When resolving `file+pack` the following will happen:

```
package-b has prepack script?
    npm install on package-b directory (dependencies + devDependencies)
npm pack
install generated package-b-1.0.0.tgz on package-a
```

## Rationale and Alternatives

As per [@isaacs](https://github.com/isaacs) suggestions:

> We might also explore something like pack:file:/path/to/folder, where pack: can be a prefix applied to any arbitrary spec? Then you could do something like pack:express@latest. It'd be extraneous in the case of git deps, where we already have to repack for consistency, but I'm wondering if there might be cases where it's worthwhile to re-generate a tarball that you get from a url or registry? Like if it is a url like https://my-company/module/src.tgz tarball of the raw src code that has to be built?

## Implementation

Sample raw implementation wrapping npm: https://github.com/RecuencoJones/npm-filepack

Sample repository: https://github.com/RecuencoJones/filepack-example


## Prior Art

We could consider every other monorepo management tool a prior art to this:

- [Lerna](https://github.com/lerna/lerna)
- [Yarn workspaces](https://classic.yarnpkg.com/en/docs/workspaces/)
- [Rush](https://github.com/microsoft/rushstack/tree/master/apps/rush)

## Unresolved Questions and Bikeshedding

As per [@isaacs](https://github.com/isaacs) comments:

- Spelling of the protocol needs to be bikeshedded. I don't know off the top of my head any reason to prefer `file+pack:` vs `pack:` vs `pack+file:` etc., but I know we do test the resolved string against `/^file:/` in a few places to see whether it's a local dep, so all those code paths will have to be examined
