# No Caret Ranges for Prerelease Installs

## Summary

This proposal changes the default behavior of the install command to pin the package version, but only for a package that is tagged with a version that is a [prerelease](https://github.com/npm/node-semver#prerelease-tags) (and not add the [caret range](https://github.com/npm/node-semver#caret-ranges-123-025-004), `^`)

```sh
# if this resolves to a prerelease such as 7.0.0-beta.52
npm install @babel/core
```

results in

```diff
"devDependencies": {
-   "@babel/register": "^7.0.0-beta.52"
+   "@babel/register": "7.0.0-beta.52"
}
```

## Motivation

{{Why are we doing this? What pain points does this resolve? What use cases does it support? What is the expected outcome? Use real, concrete examples to make your case!}}

As mentioned in the `node-semver` [readme](https://github.com/npm/node-semver#prerelease-tags), package authors may intentionally use prerelease tags to signify instability and breaking changes (`-alpha`, `-beta`).

However, when a user tries to install a package like `@babel/core` from the cli with `npm install`, the default behavior of `--save` or `--save-dev` to `package.json` applies the `^` in front of the version which will install the latest prerelease in subsequent installs.

This may be an unexpected experience for end users, as they may not realize they have installed the prerelease version initially, or don't understand that a package author maybe in the midst of other breaking changes that a user would not want to automatically have to deal with on CI or locally.

By changing the default behavior to pin to the latest version, a user won't be automatically opted into the latest version and will have to explicitly do it themselves. This way an end-user can decide when to upgrade.

## Detailed Explanation

`npm install`, when writing to `package.json` (like with `--save` or `--save-dev`), should check with semver and only add the `^` if the version isn't a prerelease. I don't believe it should affect anything else.

## Rationale and Alternatives

One alternative is for package authors to not actually use prerelease versions at all: they might always stick to a `0.x` versioning system, or only make major version bumps.

Otherwise, each time someone reports an issue with different/incompatible versions the package author would tell them to change their `package.json` to remove `^`.

## Implementation

Have not started on it.
