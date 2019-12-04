# `acceptDependencies` to allow deduplication of conditionally compatible dependency versions.

## Summary

Provide a way for a module author to declare alternative versions of dependencies
that can be used.

## Motivation

npm does not currently provide a method for a package which supports `node.js >=4` to
allow upgrade of a dependency which requires `node.js >=6` unless they also bump their
own minimum verion.  This proposal would allow such authors to declare that an alternative
version of the dependency can be used if that version is already being installed by another
dependency.  Generally this would be used when the dependency is only a breaking change due
to dropping support for old node.js versions or when other breaking changes do not apply to
the local module.

Take `make-dir` for example.  Maybe you maintain a package which still needs to support
node.js 4.x.  This restricts you to `make-dir@1.3.0`.  This proposal allows you to
declare that `make-dir@2.x` or `make-dir@3.x` will also work.  When users install your
module they will get `make-dir@1.3.0` by default, but if they also install another
dependency which requires `make-dir@3.0.0` your project will use the upgraded version
as well.  The idea is that if the updated version is being installed by the application
it is no longer necessary to function on node.js 4.x.

## Detailed Explanation

npm would support reading `acceptDependencies` object from package.json.  This object
would declaring alternative versions of packages listed in `dependencies`,
`devDependencies`, `optionalDependencies` or `peerDependencies`.

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

Creating a node.js 8 application and installing this package alone would produce the
following `npm ls`:
```
example-app@0.1.0 /usr/src/npm/example-app
└─┬ my-node4-package@0.1.0
  └─┬ make-dir@1.3.0
    └── pify@3.0.0
```

Now suppose you are also going to use `make-dir` directly, so you run `npm i make-dir`,
installing the latest, 3.0.0.  With current versions of npm this will result in `npm ls`
showing:
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


## Rationale

Some maintainers want to provide support for the oldest possible version of node.js.
This often causes a large number of duplicate packages to be installed.  Older versions
of the dependencies may be slower at runtime and cause a large expansion of install size
for applications that largely require up to date dependencies.  This proposal intends to
reduce the trade-off required to support old versions of node.js.

## Alternatives

1. `resolutions` field of yarn.
2. System-wide `.npmresolutions` to allow global upgrade / remapping to specific versions.
3. Proposed `overrides` field of npm (ref #39)

All of these options can be more powerful than the idea of `acceptDependencies`.  The
with `resolutions` and `.npmresolutions` is that they would only work if users of a
module determine that the dependency can and should be upgraded.  This can result in
footguns, takes control out of the maintainers hands.  `overrides` shifts the authority
from users to module authors but would require introducing condition expansion into
`package-lock.json`.

## Implementation

I could use advice on this section.  Some thoughts:

* npm must prevent `acceptDependencies` from breaking `peerDependencies`.  For example
  if a `pkg1` depends on `lib1` and `lib1-plugin1`, `lib1-plugin1` has a peerDependency
  on `lib1`.  It is valid for `pkg1` to specify an allowed semver-major upgrade to both
  `lib1` and `lib1-plugin1`.  If `app1` installs `pkg1` and the upgraded version of
  `lib1` but not `lib1-plugin1`, this may mean that `pkg1` has to continue using the
  original version of `lib1` to satisfy the peer dependency of `lib1-plugin1`.
* A `--force-latest` flag would probably be nice - if I'm running the latest release of
  node.js I may want to assume all `acceptDependencies` are compatible with my platform.

## Unresolved Questions and Bikeshedding

* Should `acceptDependencies` explicitly reject anything that is not a semver-range?
  What should happen if other values are used for `acceptDependencies` versions?
  Install from git, etc.
* Handling of module groups could use more thought.  `peerDependencies` should help
  ensure improper deduplication does not occur.  Open to suggestions on how to better
  support groups of modules - allow `module1@2.x` and `module1-plugin@2.x` to both be
  installed if either is otherwise used.
* What should be done with modules listed in `acceptDependencies` that are not
  dependencies of the local module?
* Should `null` have special meaning for optional dependencies of direct dependents? Lets
  say I want to use `small-pkg1` but it has an optional dependency on `huge-module`.
  Could we say that this optional module is unwanted by adding `"huge-module": null` to
  our own `acceptDependencies`?  Would need to determine scope of these nullified optional
  dependencies.
