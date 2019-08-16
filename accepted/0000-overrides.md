# overrides to replace local dependencies for specific versions of node.js

## Summary

Provide a way for a module to allow upgrade to the latest version of a dependency which
no longer supports all versions of node.js supported by the local package.

## Motivation

npm does not currently provide a method for a package which supports `node.js >=4` to
allow upgrade of a dependency which requires `node.js >=6` unless they also drop support.
This often results in package duplication when dealing with packages which support old
versions of node.js.  This would be used when the upgraded dependency is only a breaking
change due to drop of support for a version of node.js, or when other breaking changes do
not apply to the local module.

Take `make-dir` for example.  Maybe you maintain a package which still needs to support
node.js 4.x.  This restricts you to `make-dir@1.3.0`.  This proposal allows a maintainer
of such a package to allow use of `make-dir@3.0.0` when running under node.js 8+.

## Detailed Explanation

npm would support reading `overrides` array from package.json.  Each array element would
support filtering and overlay fields.  Filter fields would be `engines.node`, `os` and
`cpu`.  When specified these would control which deployments get the overriden values.

Primary overlay fields:
* dependencies
* devDependencies
* peerDependencies
* bin
* main
* directories
* optionalDependencies

## Rationale and Alternatives

1. `resolutions` field of yarn.
2. System-wide `.npmresolutions` to allow global upgrade / remapping to specific versions.

Both of these options can be more powerful than the idea of `overrides`.  The problem is
that they would only work if users of a module determine that the dependency can and should
be upgraded.  This can result in footguns, takes control out of the maintainers hands.  With
`overrides` the maintainer would explicitly enable the package to use upgraded versions
depending on the node.js version, so when someone posts a bug and says "X happens in
node.js 8 installed by npm 7", the maintainer can know exactly what dependencies were
installed.

## Implementation

Example `package.json` contents:
```js
{
    "name": "my-package-with-old-support",
    "dependencies": {
        "make-dir": "^1.3.0",
        "object.fromentries": "^2.0.0",
        "object-values": "^1.0.0"
    },
    "overrides": [
        {
            "engines": {
                "node": ">=8"
            },
            "dependencies": {
                "make-dir": "^3.0.0",
                "object-values": null
            }
        },
        {
            "engines": {
                "node": ">=12"
            },
            "dependencies": {
                "object.fromentries": null
            }
        }
    ]
}
```

This example package would install of `make-dir@1.3.0`, `object.fromentries@2.0.0` and
`object-values@1.0.0` by default on versions of npm which do not support `overrides` or
node.js older than 8.  For new versions of npm and node the dependencies list would be
altered.  For node.js 8+ `make-dir@1.3.0` would be replaced with `make-dir@3.0.0` and
`object-values` would not be installed.  When running node.js 12+ `object.fromentries`
would not be installed.  The following is an example of corresponding code:
```js
const makeDir = require('make-dir');
const objectValues = Object.values || require('object-values');
const fromEntries = Object.fromEntries || require('object.fromentries');
```

Assuming this becomes a feature for npm v7 which will not support node.js 6, it will be
pointless to provide `overrides` matching versions of node.js older than 8.  It will also
be important initially that the default options provide settings for the oldest supported
version with `overrides` providing for newer versions of node.

## Unresolved Questions and Bikeshedding

* Should filtering fields and manipulation fields be placed in a separate sub-objects?
  I feel like this would be too verbose.
* Should overridden scripts be allowed to include `npm pack` / `npm publish` hooks?
* Exactly how to expand overrides in package-lock.json is difficult.
