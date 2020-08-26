# `devOptional` flag in package-lock.json

## Summary

Add a `devOptional` flag to shrinkwrap/lockfile entries to indicate
packages that are in both the `dev` and `optional` trees, but not in only
one or the other.

## Motivation

Currently, there is no way to easily identify in a shrinkwrap that a
package is a meta-dependency in the overlap of the `dev` and `optional`
subtrees.

The `dev` flag indicates that the package is a child of the `dev` tree, and
not required by any non-dev dependencies.  The `optional` flag indicates
that a package is a child of the `optional` tree, and not required by any
non-optional dependencies.

If a package is an optional dependency of a dev dependency, then it will
have both flags set.

However, if a package is a regular dependency of _both_ a dev dependency
_and_ an optional dependency, then neither flag is set.

This makes it difficult to implement pruning and filtering for both
`--no-optional` and `--production` at the same time.

## Detailed Explanation

Consider this dependency graph:

```
root
+-dev-> b ---+
|            |
|            v
+-opt-> c -> d
```

The root package has a dev dependency on `b`, and an optional dependency on
`c`.  `b` and `c` both have a dependency on `d`, which is deduplicated.

If we want to prune all dev and optional dependencies, then `d` should be
pruned.

However, because `d` is not "onlyDev", the `dev` flag is not set in the
shrinkwrap.  And, because it is also not "onlyOptional", the `optional`
flag is not set.

In this case, a new flag, `devOptional` will be added.

The `devOptional` set is the packages in both the dev and optional trees,
which are not solely in either tree.

## Rationale and Alternatives

This opens the door for `npm prune --production --no-optional`, without
having to re-walk the tree to find packages that are neither `onlyDev` nor
`onlyOptional`.

## Implementation

Already implemented in `@npmcli/arborist`.  Will be included in npm v7.

Internally, Arborist nodes have the `devOptional` flag if they are either
dev _or_ optional (ie, it is the union of the two sets).  But,
`devOptional` is only set in the shrinkwrap if they do not have `dev` or
`optional` set as well.
