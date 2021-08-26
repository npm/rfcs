# Dependency resolution overrides

## Summary

Provide a mechanism for users to specify a different dependency resolution
at a specific point in the tree.

This supercedes and replaces [Implement a package override
option](../unaccepted/0009-package-overrides.md).

This feature was discussed in the Open RFC Call on 2020-04-08.

- [Notes](https://github.com/npm/rfcs/blob/latest/meetings/2020-04-08.md)
- [Recording](https://youtu.be/GTocZoiiu4k)

## Motivation

This addresses the following use cases:

- There is a bug that is yet to be fixed in a transitive dependency in our
  project's tree.  While awaiting the bugfix to be published, we wish to
  override any instances of the dependency with a known good version.
- A security vulnerability is identified in a transitive dependency, but we
  are not able to upgrade the direct dependency pulling it in.  An override
  would allow us to address the security issue in an easier way.
- There should only be a single copy of a given dependency in our tree, but
  npm's dependency resolution will result in a duplicate due to version
  conflicts.
- There is a transitive dependency X that exhibits a bug only when used in a
  particular way by another dependency Y.  We wish to replace that instance
  of X, but only when included in the dependency graph of Y.
- A developer working on breaking change to `library` may wish to test it
  in several dependent projects at once within a workspace.  The only way
  to do this today is to point them all at a tarball or git repository,
  which can be tedious.

## Detailed Explanation

Add a field to `package.json` called `overrides`, with the following shape:

```json
{
  "overrides": {
    "<selection specifier>": "<result specifier or overrides set>"
  }
}
```

The key is a package specifier with a name.  The value is either a package
specifier without a name, _or_ a nested overrides object.  Nested override
objects apply to dependency resolutions within the portion of the
dependency graph indicated by the key, and _may_ include a `"."` member
with a string value to be applied to the node matching the override rule
set key.

### Only Root Package May Contain Overrides

The `overrides` key will only be considered when it is in the root
`package.json` file for a project.  `overrides` in installed dependencies
(including workspaces) will _not_ be considered in dependency tree
resolution.  Thus, there is no cascading overrides between multiple
different `package.json` files at any given time.

Published packages may dictate their resolutions by pinning dependencies or
using an `npm-shrinkwrap.json` file.

Applying `overrides` for workspaces and installed dependencies _may_ be
considered in a future RFC.  However, there are considerable challenges in
the implementation, user expectations, and security of such an approach.

### Key Matching

An override key will be considered a match if the named package specifier
would be satisfied by the dependency being considered for resolution.

For example, consider a tagged git dependency
`project@github:user/project#v1.0.0`, which contains a `package.json` file
with the version `1.0.0`.  In this case, the following override rule
_would_ apply:

```json
{
  "project@1.x": "2.0.0"
}
```

### Overridden Value Matching

In order to prevent infinite regressions, and be able to properly interpret
a tree that was reified in the context of overrides, an override rule will
be considered a match if the specifier used as the override value for the
package name would be satisfied by the dependency being considered for
resolution.

For example, consider an override rule set like this:

```json
{
  "project@1.x": "2.0.0"
}
```

In this case, a dependency node of `project@2.0.0` will be considered
"matched" by the rule, since we cannot be sure in a deterministic and
stateless fashion whether it was originally `project@2.0.0`, or was
overridden to that version.

This will become more relevant when considering nested object override
rulesets, where the `"."` rule is in use.

### Overridden Dependencies Are Valid

If a dependency is subject to an override that puts it outside of the
stated dependency range for a dependent, it will still be considered valid
if the overridden version would have satisfied the dependency.

For example, consider a package `foo` that depends on `bar@1.x`, installed
in the context of this override rule:

```json
{
  "bar@*": "2.0.0"
}
```

The resulting package tree on disk will have `foo` loading `bar@2.0.0` when
it does `require('bar')`.  Despite this, it will _not_ be treated as an
invalid dependency, because `bar@1.x` was valid prior to the override being
applied.

### String Overrides

When the value of an override rule is a string, it is treated as if it was
an Object Override, with a `"."` value set to the string provided.

For example, this override rule:

```json
{
  "overrides": {
    "x": "1.2.3"
  }
}
```

is syntactic sugar for:

```json
{
  "overrides": {
    "x": {
      ".": "1.2.3"
    }
  }
}
```

The behavior of the `"."` value in an overrides object is described in the
next section.

### Object Overrides

An object value in an overrides object defines a _child rule set_.

If the first match for a given resolution is an object, then the object is
a new rule set applied to all resolutions down the specified path in the
dependency graph.

For example, this override rule will set all versions of `bar`, but only
those depended upon by `foo`.

```json
{
  "foo": {
    "bar": {
      ".": "1.2.3"
    }
  }
}
```

Overrides are _only_ applied if they are the first rule in the set to match
a given package.

```js
{
  "foo": {
    ".": "1.2.3"
  },
  "foo@1.2": {
    "bar": "2.3.4" // <- this is never applied anywhere!
  }
}
```

In this case, because the `foo` rule will always match before the
`foo@1.2` rule, it takes precedence.

### Special `"."` Key Within Object Overrides

In order to both the package being targeted and its dependents, the special
key `"."` can be used within an object override rule set.  For example, to
set all versions of `foo` to `1.2.3` _and also_ set `bar` to `2.3.4` when
depended upon by `foo`, this ruleset could be used:

```json
{
  "foo": {
    ".": "1.2.3",
    "bar": "2.3.4"
  }
}
```

The `"."` key is not allowed in the root overrides rule set, as the root
package is not ever subject to dependency resolution.

Thus, these two override rulesets are equivalent:

```js
// string-valued rule
{
  "foo": "1.0.0"
}
// object with . member
{
  "foo": {
    ".": "1.0.0"
  }
}
```

The `"."` member _must_ have a string value, to prevent ambiguous
resolutions.

```js
// ambiguous and invalid!
{
  "foo": {
    ".": { // <- raises error, "." must be a string value
      "bar": "1.0.0"
    },
    "bar": "2.0.0"
  }
}
```

### `"."` Value Is A Second Selector Key

In order to maintain consistency and reasonably examine package trees on
disk, without needing to re-resolve dependencies, the `"."` key's value in
an overrides object is effectively combined with the named specifier key.

Consider a project `package.json` containing the following:

```json
{
  "dependencies": {
    "foo": "1"
  },
  "overrides": {
    "foo@1.0.0": {
      ".": "1.0.1"
    },
    "foo@1.0.1": {
      ".": "1.0.2"
    }
  }
}
```

Consider what would happen if this constraint was not present.

At install time, if `foo@1` resolves to `1.0.0`, then it would be
overridden to `1.0.1`.  If it had resolved to `1.0.1`, then would be
overridden to `1.0.2`.

Some time later, the following `node_modules` tree is examined, without
a lockfile or any other indicators as to how it got into this state.

```
project
+-- node_modules
    +-- foo (1.0.1)
```

This results in ambiguity.  Is this (a) an instance of a dependency that
resolved to `foo@1.0.0` and was overridden?  Or is it (b) an instance of a
dependency that resolved to `foo@1.0.1` and _should_ have been overridden,
but wasn't?

If (a), this is a valid state.  If (b), it is invalid.

Compounding the problem, we may have different sub-dependencies specified
within the override ruleset.  For example:

```json
{
  "dependencies": {
    "foo": "1"
  },
  "overrides": {
    "foo@1.0.0": {
      ".": "1.0.1",
      "bar": "1.0.0"
    },
    "foo@1.0.1": {
      ".": "1.0.2",
      "bar": "2.0.0"
    }
  }
}
```

If we matched the first rule to get into this state, then we would expect
to see `bar@1.0.0` in the tree, and anything else would be considered
invalid.  However, if not, then we would expect to see `bar@2.0.0`.  This
would introduce non-determinism and be impossible to reason about after
install time.

In order to avoid this class of problems, the following additional
constraint is applied:

**If a dependency matches the `key` in an overrides object _or_ it matches
the `"."` value specifier, then the override ruleset will apply.**

This combines with the "first match stops the process" rule to mean that in
the override ruleset above, the second rule can never be applied anywhere.

Thus, when considering a dependency `foo@1.0.1` against this override set,
it matches the _first_ set, because it matches the `"."` value.  The second
ruleset can never match anything, because `foo@1.0.1` will always be
matched by the first rule set, and nodes can only be matched once.

Thus, the correct state is clear both at install time and when examining
the tree later.

If feasible, the npm CLI _should_ log warnings when an override rule set
would appear to match, but is being skipped because the dependency was
subject to an earlier override rule.

This constraint can result in confusion in cases like the following:

```
{
  "dependencies": {
    "foo": "1 || 2"
  },
  "overrides": {
    "foo@1": {
      ".": "2",
      "bar": "1.2.3"
    }
  }
}
```

In this situation, the `bar` dependencies of `foo` will be overridden to
`bar@1.2.3` for versions of `foo` resolving to _either_ `foo@1` _or_
`foo@2`.

### Rules in Nested Rule Sets Override Parent Rules

Parent rules are inherited by nested rule sets, applied _after_ the child
rules.

For example:

```json
{
  "foo": {
    ".": "1.0.0",
    "bar": {
      ".": "2.3.4",
      "baz": "3.0.0"
    },
    "baz": "2.0.0",
    "boo": "3.0.0"
  },
  "boo": "1.0.0"
}
```

In this case,

1. All versions of `foo` are set to `1.0.0` by the `foo > .` rule.
2. All versions of `bar` depended upon by `foo` are set to `2.3.4` by the
   `foo > bar > .` rule.
3. All versions of `baz` depended upon by `bar` dependend upon by `foo` are
   set to `3.0.0` by the `foo > bar > baz` rule.
4. All versions of `baz` depended upon by `foo` are set to `2.0.0`,
   _except_ those depended upon by `bar`.
5. All versions of `boo` depended upon by `foo` (including those also
   depended upon by `bar`) are set to `3.0.0`.
6. All versions of `boo` in the tree are set to `1.0.0`, _except_ those
   depended upon by `foo`.

A valid resolution might look like this:

```
project
+-- boo (1.0.0) (overridden)
+-- bar (2.3.4) (not overridden, depends on baz@4)
+-- baz (4.8.9) (not overridden, satisfies bar's dependency)
+-- foo (1.0.0) (overridden)
    +-- bar (2.3.4) (overridden, cannot dedupe due to override)
    |   +-- baz (3.0.0) (overridden)
    +-- boo (3.0.0) (overridden)
```

### Rules Apply To All Transitive Dependencies

The assumption throughout this RFC is that nested dependency resolutions
will be applied to _all_ direct and transitive dependencies throughout the
dependency graph from a given point.

In other words, the override `{"x":{"c":"1.2.3"}}` will apply to any `c`
that exists anywhere in the dependency graph starting from any `x`, without
differentiating between `x -> a -> c` vs a direct dependendency `x -> c`.

While this makes the override more powerful, and simplifies the
implementation, it also increases the risk that an override may apply to
packages that the user did not intend it to.

Supporting _both_ overrides for an entire branch of the package tree
_and_ overrides limited to a direct dependency, would significantly
increase the complexity of this feature.

Using a nested object expression that does not support `**` or some
equivalent, it would be extremely tedious and error-prone to expect the
user to specify every path on the dependency graph where a module might
be found.  Furthermore, it is arguably better in most cases to apply
the override too broadly rather than too narrowly.

### Impact on Deduplication

Because the set of overrides that apply to a given node in the dependency
graph will affect how its dependencies are resolved, a dependency _must
not_ be deduplicated against another instance that is subject to different
override rules.

For example, consider the following dependency graph:

```
root -> (a@1, b@1)
a@1 -> c@1
b@1 -> c@1
c@1 -> d@1
```

Without any overrides in place, the tree on disk might look like this, with
the `c` and `d` dependencies deduplicated:

```
root
+-- a@1
+-- b@1
+-- c@1
+-- d@1
```

However, consider the following override rule applied at the root project
level:

```json
{
  "overrides": {
    "b": {
      "d": "2"
    }
  }
}
```

The `b` package will still depend on `c@1`, just like `a`, but the `c@1`
that it depends on will in turn depend on `d@2` rather than `d@1`.

Thus, the `c` dependency cannot be deduplicated.  The tree on disk would
look something like this:

```
root
+-- a@1
+-- b@1
|   +-- c@1
|   +-- d@2
+-- c@1
+-- d@1
```

Because the dependency at `root > b > c` has a different set of overrides
applied, it cannot be deduplicated against the dependency at `root > a >
c`.

### No Way to Remove Overrides

There is no way to _remove_ an override for a portion of the tree.  If an
override rule causes problems for a portion of the dependency graph, then
the user must either:

1. Apply the override more narrowly, limiting the dependency paths where it
   is applied.
2. Apply additional override rules for the dependency paths where the
   higher-level override causes problems.

### Only Dependency Resolution is Considered or Mutated

The overrides rules are _only_ used to modify the effective resolution
target for dependencies, and _only_ dependency resolution is used to match
rules.

There is no facility for overriding based on other factors, such as
platform, operating system, or other package metadata.

There is no facility for mutating package metadata.

### Caveat: Overrides May Cause Duplication

While overrides _can_ be used to reduce duplication, it is not guaranteed.

Consider the following dependency graph:

```
root -> (x@*, y@*)
x@1 -> (y@1)
x@2 -> (y@2)
y@1 -> (x@1)
y@2 -> (x@2)
```

By default, this would result in the following package tree on disk:

```
root
+-- x@2
+-- y@2
```

When installed with the following override rules:

```json
{
  "x@1": {
    "y": "2"
  },
  "y@1": {
    "x": "2"
  },
  "x@2": {
    "y": "1"
  },
  "y@2": {
    "x": "1"
  }
}
```

The resulting package tree looks like this:

```
root
+-- y@2 (inherits {"x":"1"} rule set)
|   +-- x@1 (overridden by "y@2 > x" rule)
|       (x@1 -> y@1 dep overridden by `"y": "2"` rule, and deduped above)
+-- x@2 (inherits {"y": "1"} rule set)
    +-- y@1 (overridden by "x@2 > y" rule)
        (y@1 -> x@1 dep overridden by `"x": "2"` rule, and deduped above)
```

Where previously there were 2 packages installed, now there are 4.

### More Examples

To replace all versions of `x` with a version `1.2.3` throughout the tree:

```json
{
  "overrides": {
    "x": "1.2.3"
  }
}
```

If a bug is found in `x@1.2.3`, which is known to be fixed in `1.2.4`, then
bump _only_ that dependency (but anything that resolves to a version less
than `1.2.3` or greater than `1.2.4` should be left alone.)

```json
{
  "overrides": {
    "x@1.2.3": "1.2.4"
  }
}
```

To replace all versions of `x@1.x` with version `1.2.3`, but only when used
as a dependency of `y@2.x`:

```json
{
  "overrides": {
    "y@2.x": {
      "x@1.x": "1.2.3"
    }
  }
}
```

To replace all instances of `underscore` with `lodash`:

```json
{
  "overrides": {
    "underscore": "npm:lodash"
  }
}
```

Note that this only affects the name in `package.json`.  Dependent code
will still use `require('underscore')` to load it.

To force all versions of `react` to be `15.6.2`, _except_ when used by the
dependencies of `tap` (which depends on `ink` and requires `react@16`):

```json
{
  "overrides": {
    "react": "15.6.2",
    "tap": {
      "react": "16"
    }
  }
}
```

To use a known good git fork of `metameta`, but only when used as a
dependency of `foo` when `foo` is a dependency of `bar`:

```json
{
  "overrides": {
    "bar": {
      "foo": {
        "metameta": "git+ssh://git@gitserver.internal/metameta#known-good"
      }
    }
  }
}
```

### Combining Overrides

This algorithm gives rise to the following behaviors and edge cases when
applying rules throughout the dependency resolution process.

#### Multiple String Value Overrides

A deliberately extreme example:

```js
{
  "overrides": {
    "y@1": "1.2.3",
    "y@1.2": "1.2.4",       // not relevant
    "y@1.2.x": "1.2.5",     // not relevant
    "y@>1.2 <1.3": "1.2.6", // not relevant
    "y@1.2.6": "1.2.3"      // not relevant
  }
}
```

In this case, all the rules after the first are irrelevant, because only
the _first_ rule to match will have any effect.

#### Swapping

It is not possible to "swap" versions, because any match to the key _or_
the string or `"."` value will be considered a match.

Thus, in this example, `swap@2` will be the only version ever in use, and
the second override rule wll never be applied.

```json
{
  "overrides": {
    "swap@1": "2",
    "swap@2": "1"
  }
}
```

#### Combining String Value Overrides with Object Value Overrides

There are cases where it may be desirable to lock a version of a given
package down to a specific version within the tree, _and_ override the
version of one of its dependencies.

Use the `"."` key for this.

For example:

```json
{
  "y": {
    ".": "1.0.2",
    "x": "5.0.3"
  }
}
```

#### Inheriting String Value Overrides Within Child Object Overrides

When a string value override rule is defined at the top level, it is
inherited by child override rule sets.

For example, consider that `y` depends on both `x` and `z`.

```json
{
  "y": {
    "z": "1.2.3"
  },
  "x": "1.2.3"
}
```

Within the `y` branch of the dependency graph, `x` will be overridden to
`x@1.2.3` and `z` will be overridden to `z@1.2.3`.

Elsewhere within the dependency graph, `x` will be overridden to `1.2.3`,
but `z` will not be overridden.

Note that a version of `x` which is a dependency of `y` will not be able to
be deduplicated against the version of `x` at the root level, because it
will have a different set of override rules applied to it.

### Reasoning for Calling This `"overrides"`

The name "overrides" was chosen for the following reasons:

This feature is fundamentally different from Yarn `resolutions`, and closer
in both effect and intent to `overrides` in Bower and Dep.  As there are
fundamental semantic differences, it would not be possible to reliably
translate a Yarn `resolutions` field to the format described here.
Therefor, it ought to be a different key.

Using this feature should be considered a hack in most cases, something
that is done temporarily while waiting for a bug to be fixed, or to avoid
excessive duplication caused by an overly strict meta-dependency specifier.

"Resolutions" sounds resolved and ok; "overrides" sounds like we're going
against the package manager's recommendations.  (Not all npm users are
native English speakers, but enough are that this connotation is worth
considering.)

## Prior Art and Alternatives

* [Yarn Selective Dependency
  Resolutions](https://classic.yarnpkg.com/en/docs/selective-version-resolutions/)

    This feature is very similar to yarn resolutions.  However, it avoids
    the following problems:

    - Using path/glob syntax for a graph traversal is somewhat challenging.
      In particular the `**` and `*` behavior is not well defined, and
      given the other areas where we use paths and globs (`files` and
      `workspaces` in particular) it sets an expectation that negating and
      advanced glob patterns would be supported.
    - Because yarn resolutions must indicate a specific _version_, it
      limits the use cases that we can support.

* [Prior Package Overrides RFC](../unaccepted/0009-package-overrides.md)

    Limiting a package name to only a specific version, and preventing it
    from being used in published projects, is unnecessarily limiting.

    Furthermore, the prior RFC was unclear whether dependencies with a
    `replace` field would have their replacements respected.  Allowing
    replacements in nested dependencies is hazardous, and a warning without
    an action is an antipattern, as it tends to train users out of
    expecting that warnings should be acted upon.

* [Pub
  `dependency_overrides`](https://www.dartlang.org/tools/pub/dependencies#dependency-overrides)

    Pub uses a dependency override option that allows defining a specific
    source or version.  As Dart does not use nested dependencies for
    conflict resolution, this is effectively the same as the feature this
    RFC describes, but without the nested override support.

* [Bower
  `resolutions`](https://github.com/bower/spec/blob/master/json.md#resolutions)

    Bower, like Pub, uses a flat dependency graph, and so conflicts must be
    resolved by the user.  When a user chooses an option in a dependency
    conflict, the resolution is saved to the `bower.json` file in the
    `resolutions` field, and used for future conflicts.  As Bower does not
    use nested dependencies for conflict resolution, this is effectively
    the same as the feature this RFC describes, but without the nested
    override support.

## Questions and Bikeshedding

- Should `bundleDependencies` and `shrinkwrap` dependencies be subject to
  overrides?  It would be a change to those contracts, and impose
  additional implementation challenges, but my suspicion is that the user
  expectation is that they _would_ be overridden.

    If they are not, then it needs to be called out in the `overrides`
    documentation.

    If they are, then the implementation needs to be updated to consider
    the challenges involved.

    This question will be revisited when we have running code to establish
    whether the implementation challenge will be as significant as
    expected.
