# Package Aliases

## Summary

This proposal introduces a new package alias system that allows installation of
packages with names other than the ones in `package.json`, as well as a new
dependency type that allows referencing registry-hosted packages when using this
system. In short, this feature implements [the corresponding feature in
Yarn](https://twitter.com/sebmck/status/873958247304232961?lang=en) and is
intended to be mostly compatible with their implementation.

## Motivation

This was [previously proposed back in
2012](https://github.com/npm/npm/issues/2943) and [definitively shot
down](https://github.com/npm/npm/issues/2943#issuecomment-10388316),
[again](https://github.com/npm/npm/issues/2943#issuecomment-55648651), and
[again](https://github.com/npm/npm/issues/7959).

This was a fairly reasonable response back then, when npm was expected to be for
node modules themselves -- nesting largely prevents the need for this kind of
aliasing. While it can be somewhat inconvenient, it's still _possible_, and it
doesn't seem to have stopped the ecosystem from growing as fast as it did. The
simplicity of the npm model has been pretty good to us this whole time.

Enter 2018, and we've started working on `npm asset`. After many conversations
about it (with @isaacs nonetheless!) the CLI team finally decided to go ahead
with this feature. Having the Yarn implementation around was a good reference
when deciding _how_ to actually do this and totally helped make a case for it!

## Detailed Explanation

This will occur on two levels: one, a new spec type, `alias` will be added, to
represent the `npm:<pkg>` part. The bigger change, though, will be allowing npm
to install _any_ package under a different name, regardless of package type, and
use the specific name provided when it adds it to `node_modules`. That is, `npm
install foo@github:zkat/bar` will always install into a directory called `foo`,
as will `npm install foo@npm:bar` and `npm i foo@../bar`.

Furthermore, package IDs (used when comparing packages), will take aliases into
account. For a package to be considered equivalent by npm, it must match BOTH
the package name and version AS WELL AS the physical directory name it was
installed under. This will take care of blocking aliases from injecting
transitive dependencies.

## Rationale and Alternatives

Pretty much since the dawn of npm's time, there's been the question of "how do I
install a package under this separate name?" -- be it for using git forks as
replacements, or forked npm packages as replacements. This question is older
than npm scopes themselves, so we've had some developments since the choice was
originally made.

There is no good, easy way to do this. You can, of course, craft special
packages that re-export everything under a different name and install those, but
that seems less than ideal in a lot of situations.

The main use-cases for something like this seem to be:

1. installing multiple versions of a same-name package side-by-side (`npm i jquery3@npm:jquery@3 jquery2@npm:jquery@2` -> installs `node_modules/jquery(2|3)`
2. installing a registry-published fork under the name of the original package (`npm i npm@npm:@zkat/npm`)
3. shorter, more convenient import names for packages that are otherwise longer than desired (`npm i npa@npm:npm-package-arg`)

This RFC should solve all three of those problems.

There are other, related problems that this RFC will NOT address:

1. replacing packages in transitive dependencies that have different names (`npm i underscore@npm:lodash` will only make it so `require('underscore')` _in your own project_ loads `lodash` instead. Your dependencies will receive their own (nested) version of the actual `underscore` package). This may be covered in the future by an explicit resolutions mechanism, and may be facilitated by this RFC, but is still not part of it.
2. circumventing package naming restrictions (`npm i UpdateNotifier@npm:update-notifier` is invalid because CamelCased names are invalid. npm will continue to refuse installing anything in your filesystem that violates these expectations, because they can cause serious filesystem conflicts and other breakage)
3. others?

## Implementation

I'm working on an implementation of this over in a branch right now, and it's a
lot, and I don't know how to write all that down right now.

## Prior Art

The only prior art I'm aware of is Yarn's aliasing feature, which, as far as I
can tell, is entirely undocumented. I can't really tell what the gotchas are
with their own specifics.
