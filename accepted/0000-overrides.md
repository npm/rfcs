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

When the value of an override rule is a string, it is a replacement
resolution target for resolutions matching the key.  String values _must_
be a dependency specifier without a name.  (Aliases are supported using the
`npm:` alias specifier.)

String overrides within a given overrides object are applied in definition
order, stopping at the _first_ rule to match.  For example:

```js
{
  "overrides": {
    "y@1": "1.2.3",
    "y@1.2.3": "2.3.4" // <-- this will never match anything
  }
}
```

In this case, the `y@1.2.3 -> 2.3.4` rule will never be applied, because
any `y@1` dependency will be written to `1.2.3`, and stop evaluating string
override rules.

This prevents infinite regresses and loops, and greatly simplifies the
feature both from an implementation and user experience point of view.

For example:

```json
{
  "overrides": {
    "foo@1.0.0": "2.0.0",
    "foo@2.0.0": "3.0.0",
    "foo@3.0.0": "1.0.0"
  }
}
```

In this case, a package that depends on `foo@1.0.0` will instead be given
`foo@2.0.0`.  A package that depends on `foo@2.0.0` will instead be given
`foo@3.0.0`.  What it will _not_ do is apply the `foo@1.0.0` override to
`foo@2.0.0`, and then consider whether any other overrides apply to it, and
so on.  (In this case, it would create an infinite regress.)

A more realistic and less contrived case where a cascade could be
_desirable_ would be something like this:

```js
{
  "overrides": {
    "webpack@1.x": "2.x", // <-- maybe 2.7.0, maybe some other 2.x
    "webpack@2.x": "2.7.0"
  }
}
```

In this case, we are saying that any `webpack@1` dependencies should be
bumped up to `webpack@2`, and furthermore, that any `webpack@2`
dependencies should be pinned to `webpack@2.7.0`.

In practice, since rules are applied once and not stacked or cascaded, any
webpack dependency that would resolve to a version matched by `2.x` will be
overridden to `2.7.0`.  But, any dependency that resolves to a version
matched by `1.x` will be set to whichever version happens to be the latest
`2.x` at the time of installation.

In order to produce the intended behavior described, the user would have to
either specify it twice:

```json
{
  "overrides": {
    "webpack@1.x": "2.7.0",
    "webpack@2.x": "2.7.0"
  }
}
```

Or make the dependency matching range wider:

```json
{
  "overrides": {
    "webpack@1.x || 2.x": "2.7.0"
  }
}
```

### Object Overrides

An object value in an overrides object defines a _child rule set_.

If the first match for a given resolution is an object, then the object is
a new rule set applied to all resolutions down that path in the dependency
graph.

For example, this override rule will set all versions of `bar`, but only
those depended upon by `foo`.

```json
{
  "foo": {
    "bar": "1.2.3"
  }
}
```

Like string overrides, object overrides are _only_ applied if they are the
first rule in the set to match a given package.

```js
{
  "foo": "1.2.3",
  "foo@1.2.3": {
    "bar": "2.3.4" // <-- this is never applied anywhere!
  }
}
```

In this case, because the `foo` rule will always match before the
`foo@1.2.3` rule, it takes precedence.

### `"."` Key Within Object Overrides

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

The `"."` key is not relevant in the root overrides rule set, as the root
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
    ".": { // <-- raises error, "." must be a string value
      "bar": "1.0.0"
    },
    "bar": "2.0.0"
  }
}
```

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
|       (x@1 -> y@1 dep overridden by `"y@1": "2"` rule, and deduped above)
+-- x@2 (inherits {"y": "1"} rule set)
    +-- y@1 (overridden by "x@2 > y" rule)
        (y@1 -> x@1 dep overridden by `"x@1": "2"` rule, and deduped above)
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
bump _only_ that dependency (but anything that resolves to `1.2.2` or
`1.2.4` should be left alone.)

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

It is possible to "swap" versions.  This will not cause an infinite
regress, because only the first rule will be applied.

```json
{
  "overrides": {
    "swap@1": "2",
    "swap@2": "1"
  }
}
```

In this case, any version matching `swap@1` will be overridden to `swap@2`.
Any version initially matching `swap@2` will be overridden to `swap@1`.
Because rules do not stack, there is no infinite regress.

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
