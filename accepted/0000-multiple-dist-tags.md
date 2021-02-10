# Allow for multiple dist-tags in a single command

## Summary

When publishing, and when adding and removing dist-tags, the user should
be able to specify multiple dist-tags

## Motivation

Allowing for multple tags to be set on a given version at once will
streamline many users' workflows.  Currently they must add tags
one-at-a-time to any new versions they published, and can only set one
of those tags during the publish action itself.

## Detailed Explanation

Both `npm publish` and `npm dist-tag` will be affected.

The `--tag` parameter for `npm-publish` will parse as an optionally
comma-separated list of tags.  Since a comma is not a valid character
currently in tags, this does not present a breaking change.

The `add` and `rm` commands would parse their `<tag>` parameter as a
comma-separated list of tags.

## Rationale and Alternatives

One approach is to have postinstall scripts that handle this. This is
what some maintaners are doing now and it is not very practical because
it is simply working around the limitations of the existing system only
allowing one tag at a time.  Adding lifecycle methods is less preferable
to being able to specify the tags all at once when you would be changing
them in the first place.

Another approach is to add a config option of tags to add automatically
to a package when it is published.  This is not a good choice because
those defaults may only work for the latest versions of a package, and
not changes to older semver-major versions. Overriding that kind of a
setting would be quite cumbersome if implemented.

## Implementation

```sh
$ npm publish --tag latest,next,latest-7
```
This would publish your package, and add the dist-tags of `latest`,
`next`, and `latest-7` to the version being published

```sh
$ npm dist-tag add npm@6.14.11 latest-6,lts
```

This would set two dist-tags for the `npm` package: `latest-6` and
`lts`. They would both point to the version `6.14.11`

```sh
$ npm dist-tag rm npm next-2,next-3,next-4
```

This would remove the `next-2`, `next-3`, and `next-4` tags from the
`npm` package.

Implementation would take place in the cli itself.

For `npm dist-tag` it would mean iterating through each tag specified
and making a new request to the registry.  The current registry endpoint
for adding a dist-tag only operates on one tag at a time.  This also
means that "rolling back" from an error is not very feasible, as it
would mean for example attempting to delete any tags already added if
one failed, and that is problematic if the tag is `latest`.

For `npm publish` it would mean adding the dist-tags to the packument
being uploaded at publish time. Multiple requests should not be needed.

## Prior Art

I am not aware of any package managers that interact with the npm
registry that allow for this behavior. I looked at two as a small sample
size:

Currently yarnpkg also only allows for single-tag manipulation at one
time via their `yarn tag add` and `yarn tag remove` commands, as well as with
`yarn publish`.

pnpm also only allows for a single tag during publishing, and does not
appear to have an analog for `npm dist-tag`

## Unresolved Questions and Bikeshedding

Do we want a new parameter `--tags` instead? My first reaction is that
we don't but it is worth discussing.

How do we feel about the fact that rollbacks are not going to be
feasible with adding and removing tags?
