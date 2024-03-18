# {{TITLE: a human-readable title for this RFC!}}

## Summary

Lifecycle scripts need to have more context passed to them about why an event is being invoked. Due to the way packages are deduped and hoisted, not all use cases are properly covered by simply event names.

## Motivation

Lifecycle scripts such as `preinstall` `install` and `postinstall` are very commonly used, but difficult to reason about due to the way package trees are installed and updated. In the case of `install`, a package could be directly installed as a dependency by a user, installed as a global, indirectly installed as a dependency, or added when dependency versions changed to the point where a dependency could no longer be shared between two packages as a single version. Worst still, `uninstall` could be fired when the package won't be removed at all due to one dependant no longer requiring it, but another still needing to keep it.

An `uninstall` script could assume that the directory will be removed or not used in the future, and put the package into a bad state if it was merely deduped, for example. By providing scripts with more context, like whether a new directory is being made or destroyed, which depenants caused the installation, etc, we could properly cover all use-cases and remove confusion that would lead to destroyed data, bugs, and frustration.

Future versions of npm could use different reify engines and methods, potentially leading to more needed context for these scripts.

The primary reason for this RFC is the lack of `uninstall` lifecycle scripts in npm v7, and how difficult it would be to re-add them in a clear way.

See issue: #3042

## Detailed Explanation

Lifecycle scripts need to be re-engineered and the old approach should be deprecated.

`package.json` will include a new index called `"lifecycle"`

```js
{
  "lifecycle": {
    "install": {
      "pre" "bin/life_install.sh --phase=pre ${dependant} ${depenant_path} ${reify-reason}"
      "pre" "bin/life_install.sh --phase=current ${dependant} ${reify-reason}"
      "pre" "bin/life_install.sh --phase=post ${dependant} ${reify-reason}"
    },
    "publish": {
      "pre": "prepublish" // default
    }
  }
}
```

By default, the lifecycle script sections will reference the old reserved scripts, maintaining compatibility.

## Rationale and Alternatives

We could solve this problem by simply adding more lifecycle scripts, to an extent.

We could solve this problem by clearly documenting exactly when when a lifecycle script happens, and dramatically limiting their scope.

We could have one lifecycle script that we pass a full arborist diff to and let the package maintainer deal with the changes.

This RFC provides a good balance of flexibility, allows the old lifecycle scripts to continue to exist, and solves the problem of lack of context.

## Implementation

### TODO:
 * list all lifecycles
 * provide lists of context keys
 * describe how it could be expanded in the future
 * describe defaults and default behavior
 * describe effect on older packages
 * describe future changes to arborists impact

## Prior Art

### TODO:
 * is there prior art? What other build systems deal with lifecycles in this way?
 * are there lessons to be learned from the likes of grunt, etc?

## Unresolved Questions and Bikeshedding

* will future changes to arborists or additional reify engines change things?
    * can we provide a stable base for future needs?
