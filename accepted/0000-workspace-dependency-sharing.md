# Change which dependencies are shared among workspace projects

## Summary

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

Implementation details are out of scope for this RFC.  This proposal
focuses exclusively on the user experience and expectations for which
packages are shared between workspaces in a project.

## Motivation

There are use cases where the naive workspaces implementation, while
simple, does not provide the ideal user experience.

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

When a user runs `npm install my-reacrt-plugin`, it'll try to install all
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
cause problems!  So, while we need a way to support this, it should not be
the default behavior.

## Detailed Explanation

The following expectations should not be silently violated without explicit
user intent.

1. A workspace package that has a dependency on another workspace package
   within the same project, should have its dependency met by the
   package within the workspace, and not by fetching the dependency from
   the registry.  If the workspace package does not satisfy the dependency
   specification from another workspace package, and has not been
   explicitly marked for isolation, then a warning will be displayed.
2. A workspace that has a peer dependency should share the same instance of
   that peer dependency with all other workspace projects, unless
   explicitly marked for isolation.
3. A workspace should not be able to load any package that it does not have
   an explicit dependency on, with the exception of dependencies declared
   explicitly at a level higher than them in the directory tree.
4. A user should be able to declare at the root level that certain
   workspace dependencies should not be shared, even if they normally would
   be.

## Rationale and Alternatives

In the initial naive workspaces implementation in npm, all dependencies are
shared if possible, because workspaces are treated more or less the same as
local `file:` link dependencies.

Thus:

1. Workspaces that depend on other workspace package will resolve to
   the other workspace within the project if and only if the dependency is
   satisfied, without warning that their dependency is being met by a
   version of a workspace package outside the project.
2. Workspaces with conflicting peer dependencies cannot coexist within a
   project.  (But they do share peer dependencies by default.)
3. Workspaces share many (or all) of their dependencies, since any
   dependency that can be deduplicated to the root project level will be,
   and can load any dependency installed in the root project.
4. There is no way to explicitly declare which dependencies should be
   shared or isolated.

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

The implementation proposed here describes the way in which a user can make
explicit declarations about shared or isolated dependencies.

```js
// package.json in the project root
{
  "name": "my-workspace-project",
  "version": "1.2.3",
  "workspaces": {
    "packages": [
      // four packages in the folder
      // w: should share peer and intra-project deps with other workspaces
      // x: has peerDependency on react-native, should be isolated
      // y: depends on z, but at a different version, by design
      // z: should not share any of its dependencies with anyone else
      "packages/*"
    ],

    // this is just enough like overrides to be confusing... hmmm......
    "dependencyIsolation": {
      // nothing for w, we just want the default behavior

      // isolate the x>react-native peer dep, even though it's a peer
      "x": {
        "react-native": true
      },

      // isolate y's dependency on z, even though it's intra-project
      "y": {
        "z": true
      },

      // isolate z's dependencies entirely, do not hoist any of them.
      // OR, does this isolate z when it IS a dependency?  Or both?
      "z": true,

      // isolate all deps on react-native
      "react-native": true
    }

    // maybe isolate *all* workspace deps with `"dependencyIsolation": true`
  }
}
```

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

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
