# Handling Conflicting `peerDependencies`

## Summary

Detect unresolvable `peerDependencies` in packages being installed, and
provide mechanisms for users to decide whether this should be treated as a
failure or a warning, with defaults that surface errors with minimal
disruption to existing workflows.

## Motivation

With the move in npm v7 to [install
`peerDependencies`](./0025-install-peer-deps.md), npm now has the capacity
to enter "dependency hell", where a package cannot be installed correctly
because its `peerDependencies` conflict with other packages in the tree.

For example, given the following dependency graph:

```
project -> (x@1, y@2)
x@1 -> PEER(y@1)
y@2 -> PEER(x@2)
```

The project cannot correctly install both `x@1` and `y@2` at the same point
in the dependency tree, because the peer dependency from `x@1` will always
conflict with the dependency on `y@2`.  And if it does, then the peer
dependency from `y@2` on `x@2` will conflict with the dependency on `x@1`.

If `project` is published and used as a dependency, there is no way for it
to get correct dependencies with any arrangement of nesting.  If `project`
resolves `x` to `x@1`, and `y` is installed at or above `x` in the tree,
then `x` will resolve to the same version of `y` that `project` does.

Since `peerDependencies` were _not_ installed by default for so long,
the inclusion of required `peerDependencies` fell to the module with the
dependency.  Thus, this sort of conflict is widespread within the npm
package ecosystem.

While the most effective way to get these issues discovered and fixed would
likely be to fail the install in these situations, it also would make it
impossible for many users to upgrade to npm v7, which is not ideal.

In many cases, the "expected" resolution can be determined by treating
`peerDependencies` as lower priority than direct dependencies of the
package depending on the peer dependency set.

For example, in the conflict described above, we could reasonably infer
that, at least for the purposes of `project`, using `x@1` and `y@2`
together is the intent, in spite of their stated conflict, because the
package bringing in these dependencies has an explictly stated dependency
on each of them.

In other situations, the expected result is more difficult to determine.
For example:

```
project -> (x@1, y@2)
x@1 -> PEER(z@1)
y@2 -> PEER(z@2)
```

In this situation, there is no explicit dependency on `z`, and thus no way
to know the intent of the author of `project`.

Also, a user encountering a conflict caused by a dependency is in a much
different position than a user encountering a conflict in their own
project.  Failing a build due to meta-dependencies is annoying and
frustrating; failing a build due to incorrect direct dependencies is
helpful and actionable.

Thus, it is sensible to have different behavior for conflicts caused by
dependencies than for those caused by the root project or one of its
workspaces.

## Detailed Explanation

When the `--legacy-peer-deps` flag is set, ignore `peerDependencies`
entirely.  This makes npm v7 behave effectively the same as npm v3 through
v6.  The `--legacy-peer-deps` flag is _never_ set for `npm ls`, so that npm
always warns on incorrect package trees when inspecting.

A `peer set` is a set of packages where each package has a peer dependency
on one of the others.  In other words, it is the recursive resolution of
`peerDependencies`, given a particular version of a package.  (The "null"
trivial peer set is just a single package with no `peerDependencies`.)

In a peerDependencies conflict:

- Either the peer set is possible to resolve without conflicts, or it is
  not.
- Either the package depending on the peer set has an explicitly stated
  dependency on a package that conflicts with one of the members of the
  peer set, or it does not.
- Either the package depending on the peer set is the root project, or it
  is a dependency.

In addition to `--legacy-peer-deps`, a user can opt to use the following
options:

- `--strict-peer-deps` - fail the install on any `peerDependencies`
  conflict, even if we can use a heuristic to provide a least-surprising
  resolution.  This flag is `false` by default, meaning that we _will_ use
  heuristics as described below for dependencies, but not for the root
  project.
- `--force` - If `--strict-peer-deps` is not set, then use heuristics to
  resolve any and all `peerDependencies` conflicts, even those originating
  from the root project.  When a satisfactory resolution cannot be found,
  skip the install of the conflicted peer dependency, so that we do install
  _something_.

### Heuristics

There are three ways a peer dependency conflict can occur.

- The creation of the peer set.
- The attempt to place the peers in the tree, where a peer conflicts with a
  non-peer dependency in the tree.
- The attempt to place the peers in the tree, where a peer conflicts with a
  peer dependency in the tree.

In general:

- The `--strict-peer-deps` config flag will trigger Strict Mode.  In this
  mode, any `peerDependencies` conflicts that occur will be treated as an
  error that halts the install process with an `ERESOLVE` error.
- The `--force` config flag will trigger Force Mode.  In this mode,
  conflicting `peerDependencies` trigger a warning, and overridden by
  either a non-peer dependency, or the first peer dependency encountered.
- In non-strict, non-forced mode (ie, the default), direct dependencies of
  the root project and any workspace projects are treated strictly, and
  peer conflicts triggered by nested dependencies of the root project are
  overridden.

In all of these cases "first dependency added to the set" refers to the
consistent way in which npm adds new resolved nodes to the tree during the
ideal tree building process.

- Shallower nodes are added before deeper nodes.  Thus, the traversal is
  breadth-first through the dependency graph.
- Nodes are resolved in alphabetical order.  The traversal of peers in the
  dependency graph is an arbitrary, consistent, deterministic order.

#### Creation of the Peer Set

To create the peer set:

- Create a virtual node with the manifest of the package that depends on
  the new node to be created.
- Add the node to the virtual root's children.
- For each peer dependency the node has, use either the dependency from the
  node in question, or from the virtual root if one exists, and resolve it
  to a peer dep node.
- Add the peer dep node to the virtual root, and continue the process with
  its unmet peer dependencies as well.

When encountering conflicts within the peer set, there is no need to warn
when the override is applied, since an appropriate warning will be emitted
if a correct resolution cannot be found.

There are two ways that this can result in a conflict:

1. Conflict external to the peer set.
2. Conflict internal to the peer set.

##### Conflict External to Peer Set

The first: if the virtual root node has a direct dependency on one of the
nodes in the peer set, which does not satisfy the dependency from within
the peer set, then we'll end up adding a package to the peer set that does
not meet the peer dependency of one or more of the other packages in the
set.

Example:

```
x -> (y@1, z@2)
y -> PEER(z@1)
```

In this example, the `z@2` dependency will be the override.

Note that, despite the conflict within the peer set, we _may_ still be
able to ultimately design a correct package tree in cases like these.  For
example:

```
my-project
+-- x
|   +-- z@2
+-- y@1
+-- z@1
```

In other cases, we may not be able to design a tree that satisfies all the
peer dependency relationships.  For example:

```
x -> (y@1, z@2)
y@1 -> PEER(z@1)
z@1 -> PEER(y@1)
y@2 -> PEER(z@2)
z@2 -> PEER(y@2)
```

In order for `x` to have its dependency on both `y@1` and `z@2` met, _and_
satisfy the peer dependency relationships of each, we will always end up in
a state where one of the instances of `y` or `z` are trying to pull in a
version of the other that conflicts with `x`'s non-peer dependency.

When this situation is encountered, npm will behave in the following ways
at the peer set creation stage of the process:

- **Strict mode**: Raise an error and halt the ideal tree building process.
- **Force mode**: Override with the dependency that the virtual root
  specifies.
- **Non-strict mode**: If the virtual root is a replica of the project
  root, then throw an error.  If it is not, proceed with the override.

##### Conflict Internal to Peer Set

The second way that it can result in a conflict is that the peer
dependencies _themselves_ cycle in such a way as to cause a conflict.

Example:

```
x -> (y@1)
y@1 -> PEER(z@1)
z@1 -> PEER(y@2)
```

In this example, `y@1` requires `z@1`, which in turn requires `y@2`.

Note that, despite the conflict within the peer set, we _may_ still be
able to ultimately design a correct package tree in cases like these.  For
example:

```
my-project
+-- x
|   +-- y@1
+-- z@1
+-- y@2
```

There are cyclical cases where no correct dependency resolution is posible.
For example:

```
x@1 -> PEER(y@1)
x@2 -> PEER(y@2)
y@1 -> PEER(x@2)
y@2 -> PEER(x@1)
```

When this situation is encountered, npm will behave in the following ways
at the peer set creation stage of the process:

- **Strict mode**: Raise an error and halt the ideal tree building process.
- **Force mode**: Override with the dependency that the virtual root
  specifies.
- **Non-strict mode**: If the virtual root is a replica of the project
  root, then throw an error.  If it is not, proceed with the override.

#### Peer Set Conflicts with Non-Peer Dependency in Tree

It is possible for a peer set to conflict with an existing non-peer
dependency in the tree in the only location where it can be placed.  In
these cases, we prioritize the non-peer dependency over the peers in the
peer set, unless the non-peer dependency can be nested deeper in the tree.

Example 1:

```
root -> (x@1, y@2)
x@1 -> PEER(y@1)
```

In this case, the root project depends on `x`, which has a peer dependency
on `y@1`, which conflicts with the root project's non-peer dependency on
`y@2`.

Example 2:

```
root -> (x@1, z@2)
x@1 -> (y@1)
y@1 -> PEER(z@1)
```

Note that this example does _not_ cause a conflict, because the following
arrangement correctly meets the dependency contracts:

```
root
+-- x@1
|   +-- y@1
|   +-- z@1
+-- z@2
```

However, it is important to note the conflict with the peer set when
attempting to place the `(y@1, z@1)` peer set, so that it can be
placed deeper in the tree, underneath `x@1`.

Sometimes, a non-peer dependency will have been placed more shallowly in
the tree than is strictly necessary, as part of npm's "maximally naive
deduplication" tree generation algorithm.  For example:

```
root -> (x@1)
x -> (y@1)
```

This will result in the following dependency tree on disk:

```
root
+-- x@1
+-- y@1
```

If we then were to add a package `z@1` with a peer dependency on `y@2`,
then we _must_ place `y@2` in the root `node_modules` folder.

```
root -> (x@1, z@1)
x@1 -> (y@1)
z@1 -> PEER(y@2)
```

And thus prioritize the peer dependency over the non-peer dependency
because it can be nested, resulting in this dependency tree:

```
root
+-- x@1
|   +-- z@1
+-- y@1
+-- z@2
```

When a conflict cannot be resolved correctly, as in the examples above, do
the following:

- **Strict mode**: Raise an error and halt the ideal tree building process.
- **Force mode**: Warn about the conflict.  Skip the conflicted peer
  dependency, and keep the non-peer dependency.
- **Non-strict mode**: If the source of the conflicted dependency is the
  root project, then raise an error and halt the process.  If it is not,
  then raise a warning about the conflict and proceed as with force mode.

#### Peer Set Conflicts with Peer Dependency in Tree

When we do not have a non-peer dependency involved in the peer conflict,
the situation is impossible to resolve by reference to prioritizing
non-peer dependencies.  (This is similar to the **Conflict Internal to the
Peer Set** case above.)

Example 1:

```
project -> (x@1, y@2)
x@1 -> PEER(z@1)
y@2 -> PEER(z@2)
```

In this case, the only place we can put the dependencies is a location
where the peer dependencies will conflict with one another.  If `project`
is not the root project, but instead a dependency, it is _possible_ that it
might be resolvable via duplication.  For example:

```
root
+-- project
|   +-- x@1
|   +-- z@1
+-- y@2
+-- z@2
```

However, there are situations where this is not the case.

Example 2:

```
root -> (project, y@3, x@3)
project -> (x@1, y@2)
x@1 -> PEER(z@1)
x@3 -> PEER(z@3)
y@2 -> PEER(z@2)
y@3 -> PEER(z@3)
```

In this case, the root project will require that `x`, `y`, and `z` all are
in the first `node_modules` folder at version 3.  This leaves `project` as
the only place where its dependencies can be placed, causing the conflict.

- **Strict mode**: Raise an error and halt the ideal tree building process.
- **Force mode**: Warn about the conflict.  Arbitrarily keep the first peer
  dependency which was added to the tree.
- **Non-strict mode**: If the source of the conflicting peer dependencies
  is the root project, raise an error and halt.  Otherwise, warn and
  arbitrarily keep the first peer dependency that was added to the tree.

### Summary

In all cases, conflicts will _at least_ generate a warning if a correct
package tree cannot be calculated.  The behavior can be summarized as:

- **Strict mode**: Enforce all peer dependency contracts fully, at all
  levels, and fail to build a dependency tree when this is not possible.
  Do not install dependencies which have conflicts within their
  dependencies, even if these conflicts could potentially be resolved.
- **Force mode**: Guarantee that _some_ dependency solution will be generated,
  albeit one that might be incorrect, even arbitrarily so, even if the
  problem is the fault of the root project.
- **Non-strict mode**: Enforce peer dependency contracts in the root
  project, and allow violations of those contracts deeper in the dependency
  graph, choosing the best solution possible.

## Rationale and Alternatives

The simplest approach is to behave in strict mode at all times, and indeed,
this was the behavior of the first few npm v7 beta releases.  However, in
practice, this was deemed to be overly restrictive, and placed undue burden
on developers to halt their work due to problems that they were not in a
position to fix.

Another approach would be to allow _all_ peer dependency conflicts,
effectively defaulting to "force" mode at all times.  However, this would
result in incorrect package trees being installed without explicit user
consent or knowledge, even when the user is in a position to correct the
error.

By effectively behaving in "strict" mode whenever we are dealing with a
package's _own_ direct dependencies, we surface the problems where they can
be addressed.

An alternative that was explored was to _only_ override conflicting
`peerDependencies` of transitive dependencies when there was a non-peer
dependency to use as an indication of intent.  This would be less
potentially hazardous, but more disruptive, and violates the npm design
principle of only erroring on cases that the user can reasonably be
expected to fix.

Since the previous behavior (that is, of npm v2 through v6) in such cases
would have been to install _no_ peer dependency in those cases, the current
proposal is not any worse than the previous behavior.  By erroring in cases
caused by the root project, we guide the npm userbase towards more correct
use of `peerDependencies`, thus reducing the occurrence of these cases over
time.

## Implementation

This is implemented in the `_loadPeerSet`, `_problemEdges`, `_canPlace`,
and `_canPlacePeers` methods in `Arborist.buildIdealTree`, as of npm
v7.0.2.
