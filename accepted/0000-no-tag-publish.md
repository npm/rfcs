Publishing a package without a dist-tag

## Summary

When publishing, the user should be able to specify that no new
dist-tags should be included with the release.

## Motivation

Allowing for the behavior of various registries to deal with defaul
tags, and allowing users to publish legacy versions of their packages
without having to either create new tags for legacy lanes, or juggle the
`latest` tag after the fact.

## Detailed Explanation

This will only affect `npm publish`

A new parameter will be added that tells the cli not to add any tags to
the version being published.

Currently if you do an `npm publish` and do not specify any tag, the
`latest` tag is added to your dist-tags that point to the version
currently being published.

## Rationale and Alternatives

There is currently another open rfc suggestion
https://github.com/npm/rfcs/pull/317 that outlines programmatically
chosing the tag to associate during publish.  This is potentially an
alternative to defaulting to `latest` like the cli currently does.

The problem of publishing older versions of a package that won't end up
with the `latest` tag is currently being solved by including a
`publishConfig.tag` setting in the source control for those older
versions.  This does solve the problem but not in a way that is
practical for every workflow out there, and still does not allow for
publishing of older versions with no dist-tag associated with them at
all.

## Implementation

A new parameter would be parsed by the cli at the point in which it adds
the `defaultTag` to the package being published. If present this step
would be skipped.

## Prior Art

Most, if not all, of the other npm clients replicate the current
behavior of defaulting the tag to `latest` if one is not given.

## Unresolved Questions and Bikeshedding

We can call the flag whatever we want, `--no-dist-tag` `--skip-tag`.

Currently it is not possible to publish a new version of a package to
the npm registry without including at least one dist-tag.  A 400
response is returned.  The github package registry handles it just fine,
and allows an older version to then be published without clobbering the
`latest` tag.
