# `acceptDependencies` to allow deduplication of conditionally compatible dependency versions

## Summary

Provide a way for a module author to declare alternative versions of
dependencies that can be used.

## Motivation

npm does not currently provide a method for a package which supports
`node.js >=4` to allow upgrade of a dependency which requires `node.js >=6`
unless they also bump their own minimum version.  This proposal would allow
such authors to declare that an alternative version of the dependency can
be used if that version is already being installed by another dependency.
Generally this would be used when the dependency is only a breaking change
due to dropping support for old node.js versions or when other breaking
changes do not apply to the local module.

Take `make-dir` for example.  Maybe you maintain a package which still
needs to support node.js 4.x.  This restricts you to `make-dir@1.3.0`.
This proposal allows you to declare that `make-dir@2.x` or `make-dir@3.x`
will also work.  When users install your module they will get
`make-dir@1.3.0` by default, but if they also install another dependency
which requires `make-dir@3.0.0` your project will use the upgraded version
as well.  The idea is that if the updated version is being installed by the
application it is no longer necessary to function on node.js 4.x.

## Detailed Explanation

npm would support reading `acceptDependencies` object from package.json.
This object would declare alternative versions of packages listed in
`dependencies`, `devDependencies`, `optionalDependencies` or
`peerDependencies`.

Example `package.json`:

```js
{
    "name": "my-node4-package",
    "engines": {
        "node": ">=4"
    },
    "dependencies": {
        "make-dir": "^1.3.0"
    },
    "acceptDependencies": {
        "make-dir": "2.x - 3.x"
    }
}
```

Creating a node.js 8 application and installing this package alone would
produce the following `npm ls`:

```
example-app@0.1.0 /usr/src/npm/example-app
└─┬ my-node4-package@0.1.0
  └─┬ make-dir@1.3.0
    └── pify@3.0.0
```

Now suppose you are also going to use `make-dir` directly, so you run `npm
i make-dir`, installing the latest, 3.0.0.  With current versions of npm
this will result in `npm ls` showing:

```
example-app@0.1.0 /usr/src/npm/example-app
├─┬ make-dir@3.0.0
│ └── semver@6.3.0
└─┬ my-node4-package@0.1.0
  └─┬ make-dir@1.3.0
    └── pify@3.0.0
```

Future versions with support for `acceptDependencies` would show:

```
example-app@0.1.0 /usr/src/npm/example-app
├─┬ make-dir@3.0.0
│ └── semver@6.3.0
└─┬ my-node4-package@0.1.0
  └── make-dir@3.0.0 deduped
```

### Acceptable `acceptDependencies` package specifiers

Values in the `acceptDependencies` object may be any package specifier that
is allowed in other dependency objects within package.json.

In every case, regardless of the type of dependency, the specifier in the
`acceptDependencies` object will be considered a valid resolution if
already present.

For example:

```js
// will fetch from the registry, unless the git version is present
// note that this will allow ANY version, as long as it comes from that
// git repo, but only 1.x otherwise.
{
  "dependencies": {
    "@user/project": "1.x"
  },
  "acceptDependencies": {
    "@scope/dep": "git+ssh://git@internal-git-host.com:user/project.git"
  }
}
```

```js
// inverse of the above.  fetch from the git repository, UNLESS a 1.x
// version is already present in the tree as a deduplicated option.
{
  "dependencies": {
    "@user/project": "git+ssh://git@internal-git-host.com:user/project.git"
  },
  "acceptDependencies": {
    "@scope/dep": "1.x"
  }
}
```

## Rationale

Some maintainers want to provide support for the oldest possible version of
node.js.  This often causes a large number of duplicate packages to be
installed.  Older versions of the dependencies may be slower at runtime and
cause a large expansion of install size for applications that largely
require up to date dependencies.  This proposal intends to reduce the
trade-off required to support old versions of node.js.

## Alternatives

1. `resolutions` field of yarn.
2. System-wide `.npmresolutions` to allow global upgrade / remapping to
   specific versions.
3. Proposed `overrides` field of npm (ref #39)

All of these options can be more powerful than the idea of
`acceptDependencies`.  The with `resolutions` and `.npmresolutions` is that
they would only work if users of a module determine that the dependency can
and should be upgraded.  This can result in footguns, takes control out of
the maintainers hands.  `overrides` shifts the authority from users to
module authors but would require introducing condition expansion into
`package-lock.json`.

## Implementation

The `Edge` class in `@npmcli/arborist` will track the `acceptDependencies`
value for any type of dependency relationship it tracks.

When testing whether an Edge is valid, check both the spec on the edge, as
well as the `accept` spec, and resolve as valid if either spec is
satisfied.

When resolving a specifier to a new Node in the tree, _only_ use the actual
specifier for the Edge, and ignore the `acceptDependencies` specifier.

Packages listed in `acceptDependencies` are only relevant if they are
_also_ listed as another type of dependency.  Otherwise, they are ignored.

## Known Limitations

This does not address the following use cases, which are out of scope of
this RFC.

### Dependency Groups

A package may wish to indicate that it needs to use both `module` and
`module-plugin`.  It can work with either the `1.x` or `2.x` versions of
these dependencies, but they must be compatible versions in order to work
properly.  That is, it can install _either_ `module@1.x` and
`module-plugin@1.x`, _or_ it can install `module@2.x` and
`module-plugin@2.x`.

This is properly addressed by one of these modules indicating a peer
dependency on the other.  (Typically the plugin indicating that it has a
peer dependency on the core module.)

The tree design algorithm in npm v7 is capable of resolving
`peerDependencies` properly, so it will behave correctly.  Even if peer
dependencies are omitted from the actual reification, the tree will be
designed such that it would not cause a conflict if they _were_ installed.

### Targeted Optional Metadep Omissions

It would be nice to be able to indicate that an optional dependency of an
installed dependency should not be installed, or even attempted.

For example, a package `small-pkg` has an optional dependency on
`huge-pkg`.  A user may wish to install `small-pkg`, but _not_ fetch
`huge-pkg`.

`optionalDependencies` does not provide a way to indicate that anything
should _not_ be installed.
