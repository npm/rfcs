# Consider reading JSON5 and JSONL for package.json

## Summary

If a `package.json5` or a `package.jsonl` is present, then read that if `package.json` isn't there.

## Motivation

`JSON5` allows comments and multiple more features for `JSON`. `JSONL` isn't really required since the `manifest` isn't a list, but could be a little enhancement.

## Detailed Explanation

Read the `manifest` in the following order for files (important to least important):
- `package.json`
- `package.json5`
- `package.jsonl`

## Rationale and Alternatives

- I could just use `package.json`
- I could generate a `JSON` file from my `JSON5` file

## Implementation

1. Create a helper function for looking for the manifest in the order given above
2. Implement this helper function in the commands and code

## Prior Art

`JSON5` makes it easier to write `JSON` so that was some inspiration. Other then that I don't really know other tools that use them so far out of the top of my head.
