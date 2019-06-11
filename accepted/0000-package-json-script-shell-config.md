# Allow [`script-shell`] config in `package.json`

## Summary

Add the ability to configure [`script-shell`] directly in `package.json`.

## Motivation

It would be useful to be able to specify the [`script-shell`] config option somewhere in `package.json`, without having to have a separate one-line `.npmrc` just for this.

## Detailed Explanation

Following on from https://github.com/npm/npm/issues/20336, and as mentioned in https://github.com/npm/npm/pull/16687#issuecomment-315263454, this is a simple proposal to allow [`script-shell`] to be configured directly in `package.json`. Currently this option can be set in `.npmrc`, but this forces an extra file which otherwise might not be necessary.

~~~ ini
# .npmrc
script-shell = /bin/bash
~~~

## Rationale and Alternatives

The ability to configure the [`script-shell`] option in `package.json` would alleviate the need to have a separate one-line `.npmrc` just for this. Additionally, being able to configure a different [`script-shell`] based on the platform, perhaps mirroring the [`os` key], would also be useful.

## Implementation

Something like:
~~~ js
// package.json
"script-shell": "/bin/bash",
// or
"script-shell": {
  "!win32": "/bin/bash",
  "win32": "c:\Program Files\git\bin\bash.exe"
},
~~~

## Unresolved Questions and Bikeshedding

The config option could alternatively be defined under the [`scripts`] object:
~~~ js
// package.json
"scripts": {
  "shell": "/bin/bash",
  // or
  "shell": {
    "!win32": "/bin/bash",
    "win32": "c:\Program Files\git\bin\bash.exe"
  }
},
~~~

[`os` key]:       https://docs.npmjs.com/files/package.json#os
[`script-shell`]: https://docs.npmjs.com/cli/run-script#description
[`scripts`]:      https://docs.npmjs.com/files/package.json#scripts
