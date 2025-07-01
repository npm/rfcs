# Limit dependencies shared between workspaces

## Summary

For all workspaces within a project, the default behavior of dependency
resolution will be as follows:

- Dependencies on other workspaces within the project will _always_ be
  resolved to the corresponding sibling workspace.
- Peer dependencies of multiple workspaces within the project will always
  be shared with one another, raising an `ERESOLVE` if this is impossible.
- All other dependencies will not be hoisted above the workspace location.
  However, if a satisfying version of a dependency is listed as a root
  project dependency, then that will be used.

Thus, all dependencies of workspace projects which are not
`peerDependencies` or dependencies on sibling workspaces within the
project, will never be hoisted above the workspace level _unless_ they are
explicitly listed as a root project dependency.

The ability to load transitive dependencies without an explicit dependency
on them is out of scope for this proposal, and covered by
[`isolated-mode`](https://github.com/npm/rfcs/blob/main/accepted/0042-isolated-mode.md).

### Example

A project contains the following workspace definition:

```json
{
  "workspace": ["packages/*"]
}
```

Workspaces exist at `packages/foo`, `packages/bar`, and `packages/baz`.

`packages/foo/package.json` contains:

```json
{
  "name": "foo",
  "version": "1.0.0",
  "peerDependencies": {
    "react": "16"
  },
  "dependencies": {
    "bar": "1.x"
  },
  "devDependencies": {
    "webpack": "4",
    "webpack-cli": "4.9"
  }
}
```

`packages/bar/package.json` contains:

```json
{
  "name": "bar",
  "version": "1.0.0",
  "peerDependencies": {
    "react": "16"
  },
  "dependencies": {
    "baz": "1.x"
  },
  "devDependencies": {
    "webpack": "5",
    "webpack-cli": "4.9"
  }
}
```

`packages/baz/package.json` contains:

```json
{
  "name": "baz",
  "version": "2.0.0",
  "dependencies": {
    "foo": "1.x"
  }
}
```

In this example:

* The `bar` loaded by `foo` will be the one in `packages/bar`.
* `webpack-cli` is duplicated in both `foo` and `bar` packages, instead of
  only `webpack` being duplicated.
* The `baz` loaded by `bar` will be the one in `packages/bar`, _even though
  this is an invalid version_, because they are sibling workspaces within a
  project.  (This will be flagged as an error in `npm ls`.)
* The `react` loaded by both `foo` and `bar` will be the same instance.
* If `baz` adds a peerDep on `react@17`, then this will cause an `ERESOLVE`
  error, because the peer dependency cannot be resolved.  (This can be
  worked around by `baz` also listing `react` in `devDependencies`.)

## Motivation

A common use case for workspaces is to develop multiple related packages as
a single overarching project, so that they can be more easily kept in sync
and tested with one another.

The current implementation is somewhat naive.  Workspaces are treated
roughly the same as `file:` dependencies from the root project, with some
additional semantics applied.  Any shared dependencies are deduplicated up
to the top-most `node_modules` folder if possible, as they would be if
they were simple `file:` dependencies.

This RFC proposes more specific guidelines for which types of dependencies
are shared in various scenarios.

There are use cases where the naive workspaces implementation, while
simple, does not provide the ideal user experience.

Implementation details are out of scope for this RFC.  This proposal
focuses exclusively on the user experience and expectations for which
packages are shared between workspaces in a project.

### Shadow Dependencies

A naive implementation of workspaces makes it easy to come to rely on
undeclared dependencies.  For example, consider a project with this
`package.json` file:

```json
{
  "workspaces": [
    "packages/*"
  ]
}
```

and this folder structure:

```
root
+-- packages
    +-- a
    |   +-- package.json
    |   +-- index.js
    +-- b
        +-- package.json
        +-- index.js
```

If `a` declares a dependency on `foo`, and `b` does _not_ declare that
dependency, then the code in `b` can call `require('foo')` and it will work
without any errors in development.  But when `b` is published, and
subsequently installed as a standalone project, it fails to find the `foo`
dependency.

### Unexpectedly divergent Intra-Project Dependencies

A common goal of a workspaces project is to ensure that all workspaces in
the project will work together when they depend on one another.

Consider a project containing many workspaces, including a shared library
`foo` which many of the other workspaces depend on.

At some point, the developer bumps the version of `foo` from 1 to 2, with
the intent of testing the new changes within all the other workspaces.
However, as this is no longer a satisfying dependency for those other
workspaces, the naive workspaces implementation will result in a package
tree like this:

```
root
+-- node_modules
|   +-- foo (link: ../packages/foo)
|   +-- bar (link: ../packages/bar) (forgot to update dependency!)
|   +-- ... all other workspaces
+-- packages
    +-- foo (v2)
    +-- bar
    |   +-- node_modules
    |       +-- foo (v1)
    +-- other workspaces
        +-- node_modules (empty, getting foo@2 from top level)
```

If the user does not note the error, and publishes all of their packages
together, they may end up releasing software that is incompatible with
itself, and could have been detected during development.

### Unable to support divergent peer dependencies

It may be valuable in some cases to define multiple packages that each have
a peer dependency on a _different_ version of some common module.

For example, imagine a plugin that is designed to work alongside React, and
has adapters to implement its functionality in different versions of React.

```json
{
  "name": "my-react-plugin",
  "version": "1.2.3",
  "description": "Works with React v15 through v17!",
  "optionalDependencies": {
    "my-react-plugin-15": "*",
    "my-react-plugin-16": "*",
    "my-react-plugin-17": "*"
  }
}
```

Then, each adapter has a `package.json` like this:

```json
{
  "name": "my-react-plugin-15",
  "version": "1.2.3",
  "peerDependencies": {
    "react": "15"
  }
}
```

When a user runs `npm install my-react-plugin`, it'll try to install all
three optional dependencies, but 2 of them will always fail by virtue of
the conflicting `react` peer dependency, and they will get one that works
with their system.

Unfortunately, doing this in a naive workspace implementation, where all
`peerDependencies` are deduplicated to the top level means that the project
will necessarily always fail to install with an `ERESOLVE` error, because
the workspace projects cannot all be installed at the same time in the same
place.

Making this more complicated, if the intent of using workspaces is to
ensure that all the workspaces within the project _may_ be used together,
then isolating all conflicting `peerDependencies` would silently
cause problems!

The workaround for this case is for the packages with divergent
peerDependencies to list their peerDependencies in `devDependencies` as
well, so that they may be nested.

## Detailed Explanation

The following expectations should not be silently violated without explicit
user intent.

1. A workspace package that has a dependency on another workspace package
   within the same project, should have its dependency met by the
   package within the workspace, and not by fetching the dependency from
   the registry.  If the workspace package does not satisfy the dependency
   specification from another workspace package, then a warning will be
   displayed.
2. A workspace that has a peer dependency should share the same instance of
   that peer dependency with all other workspace projects, unless
   marked as a non-peer (ie, dev) dependency as well.
3. A workspace should not be able to load any package that it does not have
   an explicit direct dependency or implicit transitive dependency on, with
   the exception of dependencies declared at a level higher in the
   directory tree.

## Rationale and Alternatives

In the initial naive workspaces implementation in npm, all dependencies are
shared if possible, because workspaces are treated more or less the same as
local `file:` link dependencies.

Thus:

1. Workspaces that depend on another workspace package will resolve to the
   other workspace within the project if and only if the dependency is
   satisfied, without warning that their dependency is being met by a
   version of a workspace package outside the project.
2. Workspaces with conflicting peer dependencies cannot coexist within a
   project.  (But they do share peer dependencies by default.)
3. Workspaces share many (or all) of their dependencies, since any
   dependency that can be deduplicated to the root project level will be,
   and can load any dependency installed in the root project.

The `nohoist` option has been proposed, as implemented in
[yarn](https://classic.yarnpkg.com/blog/2018/02/15/nohoist/) and
[lerna](https://github.com/lerna/lerna/blob/main/doc/hoist.md) workspaces.
Downsides of this approach are discussed in **Prior Art** below, but
if possible, it would be good for any implementation to _also_ support
`nohoist`, even if it is not the preferred/canonical way to express the
user's intent.

## Implementation

Implementation of dependency tree layout is out of scope for this RFC.
There are numerous ways to approach the problem technically, which may be
the subject of future RFCs or iterated on separately from the definition of
the intent.

In its simplest form,

* Any edge from a workspace, with a name matching any other workspace
  within the project, will be satisfied by a link to that workspace (either
  within the workspace itself, or by walking up to the top level).
* For non-peer dependencies, the `PlaceDep` class in `@npmcli/arborist`
  will stop at any target location where `target.isWorkspace` is true,
  rather than continuing its search to a higher level.

## Prior Art

The `nohoist` option has been proposed, and is implemented in
[yarn](https://classic.yarnpkg.com/blog/2018/02/15/nohoist/) and
[lerna](https://github.com/lerna/lerna/blob/main/doc/hoist.md) workspaces.

For example:

```json
{
  "name": "workspace-example",
  "version": "1.0.0",
  "workspaces": {
    "packages": [
      "packages/*"
    ],
    "nohoist": [
      "**/react-native/**"
    ]
  }
}
```

However:

1. This declaration uses glob patterns to refer to packages within the
   dependency graph, which is a UX challenge.  (See discussion regarding
   the [`overrides` feature](https://github.com/npm/rfcs/pull/129).)
2. The wording of "nohoist" is overly specific to a particular
   implementation.  That is, the declaration describes the "what" of
   package folder tree implementation, instead of the "why" of dependency
   graph resolution semantics.
3. Specifying a list of things that are _not_ to be hoisted introduces a
   "double-negative" UX problem, which is best avoided.

## Unresolved Questions and Bikeshedding

* Is it reasonable that a workspace with a dependency on a sibling
  workspace should _always_ resolve to its sibling?  Do we need an escape
  hatch for this, like we have for duplicating peerDeps in devDeps?
* This will lead to more duplication in large workspace projects.  Are we
  comfortable saying "use isolated-mode if you care about that"?
