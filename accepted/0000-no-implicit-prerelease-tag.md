# No implicit tagging for non-latest release versions.

## Summary

`npm publish` should only tag the version as `latest` if the semver version of a package is a normal (non-pre-release) version with a higher precedence than the current `latest`-tagged version, or if the `latest` tag is set implicitly. Otherwise, the command should fail.

## Motivation

If one was to publish their NPM package via the standard ways — that is, by running `npm publish` — unless one has set an explicit tag with the `--tag` option, the default tag will always be `latest`. This allows for rather unexpected things to happen:

1. The developer may publish an older version of the package (for example, a backport), and it will "override" the newest version
2. The developer may publish a pre-release version of the package, and it will be downloaded by default, although it's not finished and may contain bugs. (reported [here](https://github.com/npm/npm/issues/13248) and [here](https://github.com/npm/cli/issues/7553))

This behavior is counterintuitive; especially for the newcomers, who might expect a more nuanced handling of semver-compliant pre-release versions when publishing.

The first problem was already tackled in [RFC 7](./0007-publish-without-tag.md) ([#26](https://github.com/npm/rfcs/pull/26)), but the second one persists (although RFC 7 has not yet been implemented).

## Detailed Explanation

If, when running `npm publish`, the `tag` configurations setting (or `--tag` CLI option) is not explicitly set, AND the resulting NPM version is either:

- a pre-release version, as defined in [SemVer 2.0.0, §9](https://semver.org/#spec-item-9); OR
- a release version with lower precedence, as defined in [SemVer 2.0.0, §11](https://semver.org/#spec-item-11), than the currently published version that is tagged as `latest`,

then the NPM CLI should abort the publish task and ask the user to set the tag explicitly. This would match the behavior of `safe-publish-latest` (see Prior Art).

## Rationale and Alternatives

An alternative to aborting the operation would be to set some tag value by default, that is not `latest`. Values seen in the wild are `next`, `pre`, `alpha`/`beta`/`rc` (for pre-releases), and `vN`, where `N` is a number (for backports). One could go as far as to detect the tag name from the first non-numeric pre-release identifier from the semver (e.g., `1.0.0-alpha.1` => tag `alpha`). This, however, will introduce way too big of a behavior change, that can impact the use of NPM for the experienced package maintainers.

One can also consider to not abort the operation when publishing an older version, mirroring the behavior proposed in RFC 7. This is probably a reasonably safe choice, since the RFC 7 is already accepted and because publishing an older version as `latest` is a rare occasion with an almost never desired outcome.

## Implementation

The only affected code would be the `release` CLI command of the NPM CLI. The section of the `#publish` method that is currently used to check the validity of the tag ([L75–77](https://github.com/npm/cli/blob/7d89b55341160459e0fcd3374c3720d758b16339/lib/commands/publish.js#L75-L77)) can be extended to also check the tag value in regard to the semver version.

It's important to distinguish the `latest` (set by default if no option is present) from `latest` (set implicitly by user via npmrc or CLI options). In the latter case, we should allow publishing the package, even if the tag value seems intuitively wrong.

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

- [scott113341/npm-publish-safe-latest](https://github.com/scott113341/npm-publish-safe-latest) only tags pre-release versions as `pre-release` by default and does not throw errors. Scott was also the author of the [initial issue](https://github.com/npm/npm/issues/13248) proposing this behavior.
- [ljharb/safe-publish-latest](https://github.com/ljharb/safe-publish-latest) will throw an error when trying to publish a pre-release or an older version as `latest`
- [sindresorhus/np](https://github.com/sindresorhus/np) does a lot more to `npm publish`, like checking for the default branch, Git tree cleanliness, running tests, etc. It will also disallow implicitly publishing pre-release versions as `latest`

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
