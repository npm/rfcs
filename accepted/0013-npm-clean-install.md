# clean-install

## Summary

`npm clean-install` command which would `rm -rf node_modules && rm package-lock.json && npm install`

## Motivation

Due to various reasons we endup clean installing the modules in our projects, it would great to have that as an `npm` CLI command.

## Detailed Explanation

`clean-install` should provide easier way to remove the `node_modules`, `package-lock.json`, clear cache if needed and `install`

## Rationale and Alternatives

* `npm clean-install` 
* `npm install --clean`

## Implementation

If we opt for `npm install --clean`, then `cli/lib/install.js` would need changes to execude the chain of commands, plus doc and help message updates.

If we opt for `npm clean-install` it would be fresh set of files in the `lib`, `doc` and messages.


## Unresolved Questions and Bikeshedding

Many might suggest a shell alias to do this, but it would be great to have this as a `npm` CLI command/flag? 
