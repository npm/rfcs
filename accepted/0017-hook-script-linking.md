# Hook Script Linking

## Summary

Provide a declaritive method to allow packages to specify hook scripts to be linked upon installation, and subsequently executed during npm lifecycle events.

## Motivation

The [hook scripts feature](https://docs.npmjs.com/misc/scripts#hook-scripts) already supported by npm allows executable scipts to be placed in node_modules/.hooks/ and have them run for npm lifecycle events. But there is currently no declarative way for a package to specify any particular scripts that should be linked from there.

## Detailed Explanation

Define a `hooks` field for use in package.json that can specify one or more scripts to be linked from `node_modules/.hooks/`, which will then be executed during npm lifecycle events. The field is similar to the existing `bin` field. Property names correspond to the available npm lifecycle events. Hook scripts are not linked when the package is installed globally.

e.g. `package.json`

```
{
    "name": "example-hooks",
    ...
    "hooks": {
        "preinstall": "./hooks/preinstall"
    }
}
```

When this package is installed as a dependency, the specified preinstall script will be symlinked from `node_modules/.hooks/preinstall.js` and subsequently executed during that lifecycle event in the future.

## Rationale and Alternatives

Packages wishing to utilise the hooks feature currently need to write custom scripts to add their own hook scripts when their package is installed. This is error prone and is easy to forget about or make errors with cross-platform approaches to symlinking, or fail to handle the difference between being installed globally or as a package dependency.

Providing a declaritive feature in package.json, that works similarly to the existing `bin` and `man` fields, is easy to understand and use. The code to support cross-platform symlinking and to detect global installs already exists for those features and can be reused.

## Implementation

The bin-links repository has the code to handle the existing `bin` and `man` fields. This can be extended easily to link scripts in the appropriate `.hooks` folder based on the `hooks` field in package.json.

See [pull request #5](https://github.com/npm/bin-links/pull/5) in the bin-links repo for a working implementation.
