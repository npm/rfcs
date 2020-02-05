# RFC: Multiple Funding Sources

## Summary

Allow the `funding` field, which currently can contain a string or an object, to contain an array of those things as well.

## Motivation

 - One package author can have more than one source of funding - GitHub Sponsors and Tidelift, for example.
 - One package can have multiple authors, each with their own source(s) of funding: two different GitHub Sponsors, for example.
 - This mirrors how GitHub's own sponsor button works as well: a repo can have multiple funding sources, and any source whose model is not a single project typically can have an array of multiple users.

Being forced to create a landing page - especially on an unknown domain, defeating any inference of the `type` from the URL - is a high burden for anyone in this scenario.

## Detailed Explanation

 - the `funding` field, which currently can have an X, will also be able to have an array of X.
 - the `npm fund` output will display all URLs in the array.

## Rationale and Alternatives

One alternative is to make no changes. The tradeoff made here would be, npm and package.json stay simpler; in exchange for maintainers who need funding to have to incur more burden.

Another alternative is for npm to *host* a funding page that consolidates multiple URLs - however, this would both still require multiple URLs, and is something that could be enhanced later if the command line UI for multiple URLs becomes untenable.

I believe this RFC is the simplest and most intuitive choice to meet the needs of maintainers.

## Implementation

The `package.json` side is surely trivial; the difficulty will be in `npm fund` output. There will be a bit of UI design needed, and that will determine the implementation difficulty.

The `--json` output of `npm fund` will also change when there's an array, but this should be trivial for consumers - change `process(fundingValue)` to `[].concat(fundingValue).map(process)`, or something equivalent. Since this sort of change was considered acceptable for https://github.com/npm/cli/pull/472, I presume it would be acceptable here as well.

Expected code that will need to change is the same as in this PR: https://github.com/npm/cli/pull/472/files

## Prior Art

 - The `repository` field works in this same manner; it can be a string, an object, or an array of either.
 - the GitHub Sponsor button and `FUNDING.yml` has affordances for multiple funding sources as well.

## Unresolved Questions and Bikeshedding

As part of this change, it'd be spiffy to colorize the URL and package name output, but that's also fine to defer to a separate RFC/PR.

Here's some example `npm fund` output in the `resolve` repo:
```sh
resolve@1.12.0, @ljharb/eslint-config@15.0.2, safe-publish-latest@1.1.4, es-to-primitive@1.2.1, has-symbols@1.0.1
├── url: https://github.com/sponsors/ljharb
└─┬ glob@7.1.6
  └── url: https://github.com/sponsors/isaacs
```

I'd expect this to change to something like:
```sh
resolve@1.12.0, @ljharb/eslint-config@15.0.2, safe-publish-latest@1.1.4, es-to-primitive@1.2.1, has-symbols@1.0.1
├── url: https://github.com/sponsors/ljharb
@ljharb/eslint-config@15.0.2
├── url: https://tidelift.com/funding/github/npm/@ljharb/eslint-config
resolve@1.12.0
├── url: https://tidelift.com/funding/github/npm/resolve
└─┬ glob@7.1.6
  └── url: https://github.com/sponsors/isaacs
```

The deduping might get a bit tricky since instead of a package name either being "by itself" or "grouped with others that have the same funding source", two packages could share one funding source, and then *not* share another funding source.

## Update: resolution to above bikeshedding

While working out the implementation with @ruyadorno, we decided the following:

 - No longer display top-level package funding information, since this information is both useless to the maintainer of that package (since they provided the funding information) and also to avoid some tricky problems around deduping
 - Invert the human output: instead of a deduped list of package names being the "key", the URL will be the "key"
 - JSON output will be unchanged, except that the `funding` info, when specified as an array, will be an array in the output

Here's some example `npm fund` output in the `resolve` repo:
```sh
resolve@1.12.0, @ljharb/eslint-config@15.0.2, safe-publish-latest@1.1.4, es-to-primitive@1.2.1, has-symbols@1.0.1
├── url: https://github.com/sponsors/ljharb
└─┬ glob@7.1.6
  └── url: https://github.com/sponsors/isaacs
```

With the `@ljharb/eslint-config` package adding an array with two URLs, the `resolve` output will change to (modulo archy formatting):
```sh
resolve@1.12.0
├─┬ https://github.com/sponsors/ljharb
│ └── @ljharb/eslint-config@15.0.2, safe-publish-latest@1.1.4, es-to-primitive@1.2.1, has-symbols@1.0.1
├─┬ https://tidelift.com/funding/github/npm/@ljharb/eslint-config
│ └── @ljharb/eslint-config@15.0.2
└─┬ https://github.com/sponsors/isaacs
  └── glob@7.1.6
