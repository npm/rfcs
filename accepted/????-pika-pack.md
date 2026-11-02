# Integrate @pika/pack into npm

## Summary

The [pika](https://www.pikapkg.com) folks recently released a simple, clean bundling-at-publish-time solution in the form of [@pika/pack](https://www.pikapkg.com/blog/introducing-pika-pack/).  Let's integrate this into npm proper so that pika pipelines work with `npm pack`.

## Motivation

@pika/pack solves a bunch of problems really well:

* Build pipelines not well served by run scripts.
* Low/no configuration for modern best practices
* Quality plugins for many purposes

But in many ways the core magic is integration into pack and publish directly.  This puts those activities in the right place, rather than as a distinct build step, and makes these actions clearly about publication of an artifact.

## Detailed Explanation

This is a replacement for the existing pack/publish process, where, when there are pipelines defined they're used to transform the artifact in various ways, from adding values to the resulting package.json to generating types, cjs from esm or other actions.

## Rationale and Alternatives

The magic bit is the integration into pack.  Outside of that it superficially seems similar to existing build tools, but it has the advantage of having a substantially more constrained configuration language, being limited to plugin names + JSON.  This constrained scope makes integration of it substantially more appealing.

Other options would involve essentially recreating the work already done on `@pika/pack`.

## Implementation

Ideally this should be built off of existing (or created-for-this-project) libraries currently used in @pika/pack so that the existing project can continue to maintain them.

Integration will involve hooking into `npm pack` (and in turn `npm publish`).


## Unresolved Questions and Bikeshedding

Should this use the `@pika/pack` package.json section as is?  Would there be value in, as a larger community, settling on an unnamespaced `pipelines` field?

Right now that bit feels the highest friction to me, but I wouldn't support doing it without support from the existing `@pika/pack` project.
