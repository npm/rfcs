# Install Peer Dependencies

## Summary

Install `peerDependencies` along with packages that peer-depend on them.

Ensure that a validly matching peer dependency is found at or above the
peer-dependant's location in the `node_modules` tree.

If `peerDependencies` are omitted from the install, then create a tree
which _could_ have `peerDependencies` added correctly.

## Motivation

Due to some of the difficulties that `peerDependencies` present with the
installer as of npm v6, `peerDependencies` are not installed by default
with npm.  Instead, it's on individual consumers to install and manage
`peerDependencies` by themselves, prompted by a warning.

That warning is often misinterpreted as a problem, and reported to package
maintainers, who in response, sometimes omit the peer dependency, treating
it as effectively an optional dependency instead, but with no checks on its
version range or validity.

Furthermore, since the npm installer is not peer dependency aware, it
can design a tree which causes problems when peer dependencies are present.

This proposed algorithm addresses these problems, making `peerDependencies`
a first-class concept and a requirement for package tree validity.

For example, `tap` had a dependency on `ink`, which had a peer dependency on
`react@16`.  In order to meet this peer dependency `tap` also added a
dependency on `react@16`.  However, if a package depends on both `tap` and
`react@15`, then the installer will see the conflicts _only as it relates
to tap's dependency_, resulting in a package tree like:

```
+-- react (15)
+-- ink
+-- tap
    +-- react (16)
```

Because no version of `ink` existed higher in the tree, the installer
moves it up a level, even though this breaks the peer dependency.

To work around this, `tap` currently bundles both `ink` and `react`, but
this is not optimal.  In cases where `ink` and/or `react` _can_ be
deduplicated, they no longer are.

## Detailed Explanation

This extends the "maximally naive deduplication" algorithm that npm
currently uses.

### Validity Test

A peer dependency is valid iff:

- The name resolves from the dependant package to a package which satisfies
  the listed dependency according to standard dependency resolution
  semanatics, and
- The resolved dependency is not found in the dependant's `node_modules`
  tree (ie, it must be at or above it's own parent), _unless_ the dependent
  is the root in its package tree.

### Adding a New Dep

When adding a dependency `D` in a range `R` with a set of peer dependencies
`P` at location `L` in the tree:

- For each `p` in `P`, starting from `L`, find the location in the
  tree closest to the root where `p` can be placed without conflicts.
- If all `p` in `P` can be placed:
    - then: note the location furthest from the root where some `p` was
      placed, as location `L'`
    - else: error, `D` cannot be placed in this tree at location `L`.
- Starting from `L`, find the location in the tree closest to `L'` where
  `D` can be placed without conflicts.
- If `D` can be placed between `L` and `L'`:
  - then: hooray!  it is installed successfully.
  - else: error, `D` cannot be placed in this tree at location `L`.

(Optional failure handling: attempt with other versions of `D` in the range
`R`.)

### Handling Future Tree Munging

If a user installs a new dependency, which will cause a conflict with
`D` or any of `P`, then re-start the placement of `D` and `P` at `L`.

If `D` and `P` cannot be placed in the tree in the presence of the newly
requested dependency, then refuse to install it until the user resolves the
conflict.  Otherwise, move `D` and `P` to their new homes as part of the
installation.

### Tracking and Verifying

When reading from the actual `node_modules` tree (or an inflated
shrinkwrap, ie, any time we have a full manifest), Arborist will flag
`Edge` nodes of the `peer` type with an `INVALID` error if they resolve to
their peer dependant's `node_modules` folder.

## Rationale and Alternatives

### A: Leave it

We could keep not installing peer dependencies, and printing a warning
about it.  It causes problems, but there are workarounds.

The main issue is that, because the use of `peerDependencies` has gotten so
popular in the React community, and because React is extremely popular
among front-end developers who are somewhat new to npm, the hazards of the
current approach affect them the most profoundly, and they are the least
able to know what to do when faced with the error.

### B: Drop Support for Peer Dependencies Entirely

Tempting.  But that ship sailed long ago.  Peer dependencies _do_ address a
valid need for cases where a module adds functionality to a framework or
plugin architecture.  Dropping support would be too disruptive.

### C: Treat Like Regular Dependencies

Most of the time, this would result in the same package tree, and in fact,
many react-using modules (like `ink`) do not need the peer-nature of a
peer dependency.

However, this would be a violation of the contract as it is widely
understood and documented, and so would also be too disruptive.

### D: Treat Like Optional Dependencies

All the problems of B, combined with the problems of C.

### E: Let Authors Declare Which peerDependencies Should Be Installed

Add a dependency to both `dependencies` and `peerDependencies`.  This would
require that the package be installed at or above the dependent's level in
the tree, and be satisfied by anything in the `peerDependencies` specifier.
However, if _not_ found in the tree, then the package specifier in
`dependencies` will be automatically installed.

However, having a package in both peerDependencies and dependencies means
that it would be installed as a normal dependency in npm v6 and before,
which will generate an incorrect tree in many of the cases that the feature
contemplated in this RFC seeks to address.

See: [yarnpkg/berry#1001](https://github.com/yarnpkg/berry/issues/1001)

### F: Use `peerDependenciesMeta` To Trigger Auto-Install

We could do something like this:

```json
{
  "peerDependencies": {
    "foo": "1.x",
    "bar": "2.x"
  },
  "peerDependenciesMeta": {
    "foo": {
      "autoinstall": true
    },
    "bar": {
      "autoinstall": false
    }
  }
}
```

That would enable package authors to be more fine-grained about which peer
dependencies are installed, and which are not, and is not incompatible with
this RFC.  However, it is out of scope for this RFC, and may be
contemplated as a way to address any concerns that arise during the v7 beta
testing process.

The default value of the `autoinstall` field in `peerDependenciesMeta`, and
whether it overrides any `--omit=peer` or `--include=peer` options, is left
as an open question for that future RFC.

## Implementation

This is implemented in `@npmcli/arborist` and included in npm v7.

The `omit` option to `Arborist.reify()` can be used to exclude
`peerDependencies` (or optional or dev dependencies) from the reification
process.

## Unresolved Questions and Bikeshedding

### Issues Relying on peerDeps as "More Optional" `optionalDependencies`

For several years _prior_ to npm v7, peerDependencies were not installed
automatically.  This has led to some cases where users rely on this fact,
and use `peerDependencies` as a sort of more-optional
`optionalDependencies`.  That is, a dependency which is not installed by
default, allowing the user greater control over its resolution.

For example, a package.json file might do this:

```json
{
  "peerDependencies": {
    "secret-thing": "1.x"
  }
}
```

and rely on users to provide `secret-thing` from a private git repository
or other alternative specifier.  Upon seeing this, npm v7 will attempt
to fetch `secret-thing` from the registry if it has a version specifier,
and is not satisfied by something higher up in the dependency tree already.

However, as the default warning on seeing a missing peer dependency is
to tell the user to install it, the status quo could be expected to lead to
the same behavior, albeit without _automating_ that behavior.

In the end, we have decided to release the npm v7 betas with
`peerDependencies` autoinstallation enabled, and judge from early
play-testing whether it's a net improvement in the user experience.  If it
turns out to cause problems, or not be worth the risk, we can default to
omitting `peerDependencies`, and still build trees that _can_ have peer
dependencies correctly installed by explicitly including them.
