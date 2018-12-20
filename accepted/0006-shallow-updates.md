# Shallow update support for `npm update`

## Summary

Change `npm update` to not update indirect dependencies if not necessary.

## Motivation

Original issue:
https://npm.community/t/impossible-to-update-single-package-without-updating-its-dependencies/1156

Currently, when running `npm update package-name`, not only `package-name` is
updated to its latest in-range version, but every dependency of `package-name`
too, and the dependencies of the dependencies, etc.

This causes real pains when having a frequently-updated shared library on npm
that is used in multiple applications, because every time you want to update
just that shared library in an application (for example for a small but
important low-risk bug fix), it also has the potential to bring in a pile of
bugs introduced in new versions of indirect dependencies.

As a user, this behavior is counter-intuitive, because when asking for a
specific package to update, I expect npm to only update that package (unless it
_has_ to update indirect dependencies to satisfy new constraints) and otherwise
respect the versions in the lockfile.

It is especially dangerous because the updated indirect dependencies are hard to
notice, because lockfile changes are usually not reviewed (they are hidden by
GitHub in diffs by default).

[Here](https://about.sourcegraph.com/blog/the-pain-that-minimal-version-selection-solves#background)
is a concrete case where we accidentally brought in a broken indirect dependency
in what should have been a low-risk shallow update.

## Detailed Explanation

When `npm update package-name` is run, only `package-name` should be updated.
Only if the new version of `package-name` has new dependency constraints that
are _not_ satisfied, npm should update the indirect dependencies that _need_ to
be updated too to satisfy all constraints.

In other words, as a user I would expect `npm` to update `package-name` to the
latest in-range version, then check if the constraints for all direct
dependencies of `package-name` are still satisfied. If they are not for a
package, run the same steps recursively for that package (do shallow update,
check sub-dependencies).

If and only if a conflict occurs, duplicate the package as npm does today.  
This means that given dependency constraints like this:

```
|- A@^1.0.0
| `- B@^1.0.0
`- B@^1.2.0
```

where both constraints for `B` are compatible and therefor `B` was deduped:

```
|- A@1.0.0
`- B@1.2.0
```

If `A` is being updated and bumped its constraint to `B@^1.3.0`, the deduping is
maintained and the deduped package is updated for the root too:

```
|- A@1.0.0
`- B@1.3.0
```

I believe this is the expected behavior, because it is inline with npm's
dedupe-by-default behavior for `install`. If this is undesirable in a case, the
user can pin the version in the root package.json.

It would be good if at the end the command printed out the list of packages that
were updated and their version to highlight transitive updates that happened
that may not be obvious otherwise. This gives the user a chance to test if those
updates broke anything.

## Rationale and Alternatives

- Don't change the default behavior, but add support through `--depth 1`. I
  think this should be the default because it is the expected behavior by myself
  and everyone I talked to.
- Minimal Version Selection. I think this is out of scope effort-wise, and it
  would make it impossible to get latest transitive dependencies on
  `npm install`, which carries big implications for the whole JavaScript
  ecosystem.

## Implementation

Unfortunately I don't have any knowledge about npm internals.

## Prior Art

Same request for Yarn: https://github.com/yarnpkg/yarn/issues/5475

## Unresolved Questions and Bikeshedding

- Should this behavior be overridable with an option, e.g. `--depth`, so
  `--depth Infinity` can be used if wanted? The linked issue above for yarn
  states that yarn used to work this way, but the behavior was changed by
  request. This indicates that there are use cases for both behaviors.
- What should `npm update` without a package name do? For consistency, I think
  it should do the same (a shallow update), but for all direct dependencies. If
  someone wanted to update everything deep, they could pass the
  `--depth Infinity` flag, or just `rm` the lockfile and `node_modules` and
  rerun `npm install`.
