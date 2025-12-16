# Unpublished modules should return 410 Gone 

# Summary

Unpublished packages currently cause pain for NPM users. A recommended approach
ends up being to [delete your lock file and re-generate it](https://github.com/yarnpkg/yarn/issues/6702#issuecomment-442314783),
which can cause a huge amount of dependencies to change when only one was needed.

Unpublished packages currently return the HTTP status code "404 Not Found".
This code is designed for resources that might exist again in the future. In
the NPM ecosystem, version numbers are wisely
[immutable](https://www.npmjs.com/policies/unpublish). A better HTTP status
code to return for an unpublished package is "410 Gone", designed for resources
that will never come back.

When `npm` encounters a [410
Gone](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/410) resource,
it could try to resolve the related semantic version again, possibly selecting a newer
version, fixing the issue the single dependency without requiring regenerating the entire lock file.

# Motivation

Like many others I just lived through the pain of the
[Great Unpublishing of har-validator 5.1.2](https://github.com/yarnpkg/yarn/issues/6694).
I tried many things to get `yarn` to notice that this module was gone, and to re-resolve
The semantic version of `^5.1.0` to a newer version that existed, like `5.1.3`.  Finding
no workable solution, I searched online and found multiple people recommending to delete
`yarn.lock` and re-generate it.

I did that, and *many* unrelated dependencies got upgraded, causing new test failures. Pain.

(I mention `yarn` here, but `yarn` can only work the HTTP status code that the NPM servers return.)

# Detailed Explanation

## Server Side

The NPM servers must already be tracking "unpublished versions" to prevent version number re-use.
So it seems like a small change on the servers to return 410 in this case as well.

## Experience during a npm install

As a client, `npm` can get into a state where the lock file references a
file which is in the state `410 Gone` on the server.

During interactive installation, the user could be prompted:

> "The har-validator 5.1.2 dependency has been unpublished. Would you like to use a newer version instead?"

The user might be prompted to "Select minimum upgrade", "Select latest version" or "see all newer versions
and select".

It may also be better to passively notify the user and continue:

"warning: har-validator 5.1.2 has been unpublished. `har-validator ^5.1.0 is now being resolved to
`har-validator 5.1.3`.

The safest passive choice is likely the "minimum upgrade" to a version that exists.

We should also consider the case of the `event-stream` unpublishing, where the initial advice was
to *downgrade*. No newer version was available.

After the replacement version is selected, `npm` would install the package and update `package-lock.json`
to reflect the change following the existing add/update code paths.

## Caching

The `410 Gone` module should be purged from the NPM cache.

## We can't fix everything

If the semver refers to a specific version that version has been unpublished,
there no reasonable version to automatically select. We could prompt the user if they want
install the latest version (if any) with a warning that's not compatible with the `semver`.

# Rationale and Alternatives

`npm` could be updated to handle 404s in a similar way, but this doesn't seem as safe.
A 404 may indicate a temporary issue, where changing the version of a dependency is not desirable.

## Prior Art

[This same proposal was made by @seldo in 2015](https://github.com/npm/npm/issues/7261).
At the time, it appears it was a planned feature for "Registry 2.0".

Back then @isaacs objected, saying that:

> a deleted package isn't a dead url. If someone else publishes at that
> location, it'll return. A 404 is most appropriate there.

@isaacs suggestion of allowing URL-reuse is in conflict with the current
[unpublish policy](https://www.npmjs.com/policies/unpublish) which states:

> Registry data is immutable, meaning once published, a package cannot change. We
> do this for reasons of security and stability of the users who depend on those
> packages. So if you've ever published a package called "bob" at version 1.1.0,
> no other package can ever be published with that name at that version. This is
> true even if that package is unpublished.

Allowing URL-reuse would be a major security concern if "someone else" could
publish unrelated code at the same URL with the same version, it could be a
malicious payload not from an author that the downloader ever intended to
trust.


# Unresolved Questions and Bikeshedding

Why isn't "410 Gone" already more popular?
