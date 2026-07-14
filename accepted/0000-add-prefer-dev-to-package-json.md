# Add field "preferDev" to package.json

## Summary

Add `preferDev` field to `package.json` to indicate that libraries setting this field to `true` are intended as development dependencies.

## Motivation

It's usually mistake to include packages like `typescript`, `eslint`, `webpack` as normal dependencies. It unnecessary increases size of `node_modules` and potentially bundle size.

## Detailed Explanation

When installing library with `preferDev=true` as production dependency, throw error, unless `--save-prod` flag is **explicitly** set.

## Rationale and Alternatives

Alternative behaviours:

* Print warning to user about installing `preferDev` dependency as production one
* Ask user for confirmation before proceeding

## Implementation

It looks like simple `if` in `npm install package` code in `npm/cli/lib/install.js`.

## Unresolved Questions and Bikeshedding

???
