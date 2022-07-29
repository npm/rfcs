# Change how `npm update` edits `package.json`

## Summary

`package.json` should not be edited by `npm update` unnecessarily. When updating a package to a newer version that still satisfies the original range, package.json should not change. Only when updating to a range that does not satisfy the range specified in `package.json` should it be changed and saved to `package.json`.

## Motivation

It's not expected that the ranges in `package.json` changes when running `npm update`. This was more clearly shown in `npm@5` when `--save` became the default behaviour. Previously, running `npm update` would not edit `package.json`. This unexpectedness also manifests itself in an especially bad way when updating packages that are specified with a non-standard range. For example, packages using tilde (~) when the project default is caret (^), since this will save the new range with the default.

See https://github.com/npm/npm/issues/16813 for more on this specific issue.

## Detailed Explanation

When given the following dependencies in `package.json`

```json
{
  "tilde-package": "~1.0.0",
  "caret-package": "^1.0.0",
  "rc-with-caret-package": "^1.0.0-rc.0",
  "rc-package": "1.0.0-rc.0"
}
```

and the following available versions for all packages:

```json
["1.0.0-rc.0", "1.0.0", "1.1.0", "2.0.0"]
```

- `npm update` should not edit `package.json` in any way
- `npm update <package-name>` should not edit `package.json` in any way
- `npm update <package-name>@latest` should result in `<package-name>` being updated to `^2.0.0` in `package.json`.

## Rationale and Alternatives

1.  No longer defaulting `npm update` to `--save`. This is not a great idea, since it only hides the problem, it will still result in unexpected behaviour when using `--save`.
2.  Make sure that npm keeps the range when updating. For example, updating `~1.0.0` when `1.0.1` is available will yield `~1.0.1`. This also solves some of the problems, but I don't think there is a good reason to update `package.json` when we are updating to a version that is compatible with our current range.

## Implementation

I have not looked into the code yet, and would appreciate help or guidance with this.

<!--
Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.

THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted
-->

## Prior Art

### Yarn

Yarns `upgrade` command does pretty much the same thing. It never edits `package.json` unless a range (or `--latest`) is supplied when updating. IMO, the usability of `yarn upgrade` is better in this regard.

## Unresolved Questions and Bikeshedding

Maybe at the same time add a `--latest` flag, similar to yarns?

If `update` is to change, should other parts of it also change? Are there any other gripes with how the command works currently? Maybe something to do with how `--depth` works, I've considered that to be a bit weird sometimes?
