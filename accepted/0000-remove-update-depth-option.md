# Remove support for `--depth` option to `npm update`

## Summary

`npm update` will always update all nodes in the tree, at every depth.
Essentially, make `npm update` equivalent to `rm -rf node_modules
package-lock.json && npm install`.

`npm update <name>` will update all instances of `name` in the tree, except
those in a bundled or shrinkwrapped tree.

## Motivation

There is currently no way to get a fully "fresh" install that updates all
instances of every package in the `node_modules` tree as if it was a fresh
install.  `npm update` should do this.

Attempting to limit the depth of `npm update` is ambiguous: in practice
this refers to logical depth within the dependency graph.  However, because
dependencies form a _graph_ rather than a strict _tree_, a single deduped
node may exist at multiple "depths" within the dependency graph.

Performing an update with a limited depth has some unfortunate effects on
ones ability to reason about the impact of the action, as it results in a
lack of determinism in the result, and complicates the algorithm used to
resolve and place dependencies.

## Detailed Explanation

Consider the package tree:

```
root
+-- foo@1.0.1
|   +-- bar@1.0.0
+-- bar@1.1.0
```

Where `root` depends on `bar@1.x` and `foo@1.x`.  `foo@1.0` depends on
`bar@1.0`.  `foo@1.1` depends on `bar@1.1`.  Since the initial
installation, `foo@1.1.0` has been published, as has `bar@1.1.2`.

When a user runs `npm update foo`, it's unclear whether the module at
`node_modules/foo/node_modules/bar` will be deduped out, left in place,
or updated to `bar@1.1.2`.  (The optimal choice is to dedupe, and not
update, since `bar` was not on the update list, and the existing `bar`
module is satisfactory to `foo@1.1.0`.)

If a `foo` module exists much deeper in the tree, or has many more nested
dependencies, this resolution gets even more convoluted.

One fairly easy approach is to scan the tree for all modules named `foo`
(which is a trivial O(1) operation in `@npmcli/arborist`'s data structure),
and create a queue of all the nodes with dependency edges resolving to that
node.  Having compiled that list, we can check all of those nodes for the
possibility of updating `foo`, and replace it with a newly resolved version
if possible, and then update any of `foo`'s dependencies that are now
invalid (or remove any that are dupes).

When updating _all_ dependencies, this results in simply throwing away the
existing shrinkwrap data, and resolving all dependencies from scratch,
which is a frequent need, and for which there is no current npm command.

Updating all nodes within a limited depth will often not result in the same
tree as throwing away the existing virtual tree and starting over, because
it does not preserve the depth-then-alphabetical sorting order of the
Maximally Naive Resolution algorithm.  This discrepancy is surprising to
users.

## Rationale and Alternatives

Track logical depth while walking the package tree for updates.  If
updating all or a named set, continue walking even if dependency is not
required.

However, this quickly ran into problems when updating packages in the
context of peer dependencies and other conflicts, resulting in unnecessary
duplicates.  Even though the resulting package tree was not in error, it
nested unnecessarily, especially when peer dependencies were in play,
because it wasn't clear which nodes of the existing tree would later be
updated, and thus safe to overwrite, and which nodes were placed
intentionally, and thus should be left untouched.

This isn't a problem with the existing `buildIdealTree` algorithm in npm
v7, because any node in the tree at any given point _should_ be in the
tree.  It's also not a problem if we merely remove and re-evaluate any
nodes by a given name, because anything _not_ named can be assumed to be
left in place.

## Implementation

This is implemented in @npmcli/arborist as `Arborist.buildIdealTree({
update: updateSettings })` where `updateSettings` can contain the following
fields:

- `all` - Boolean.  Whether to throw away the virtual tree and update all
  the things.
- `names` - Array of Strings.  Names of packages to check for updates.

## Prior Art

npm v6 will only update the root package's dependencies when `npm update`
is executed with no arguments, making this a breaking change.

npm v6 will limit deep updates to the logical depth specified by the
`--depth` command, but exhibits the nondeterministic behavior described
above as a result.
