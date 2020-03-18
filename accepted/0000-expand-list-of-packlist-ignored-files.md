# Expand list of ignored files

## Summary

Let's expand the default list of ignored files in [packlist](https://github.com/npm/npm-packlist).

## Motivation

A large population of npm users are concerned about package sizes and with the advent of the file explorer now available on [npmjs.com](https://www.npmjs.com/) we can now see a number of common files that are very intrinsic to the JS community that we could start ignoring from package bundles without too much friction to the larger ecosystem.

## Detailed Explanation

Expand the current list of ignored files to also ignore by default:

- `.editorconfig` common plugins
- `.gitattributes` and/or more git things
- `.idea/` (or other editors similar configs/store/etc)
- `.travis.yml`, `.github/` (and/or more ci services)
- `.yo-rc.json` template/boilerplate related files

...and whatever more we think makes sense

## Rationale and Alternatives

Avoiding bundling undesirable files is something we already do today, the idea is only to make it more useful by including some other common files in the JavaScript ecosystem. That said, possible alternatives are:

- Status quo, do not alter the current existing [list of ignored files](https://github.com/npm/npm-packlist/blob/master/index.js#L38).
- More alternatives?

## Implementation

Add some more entries to the already existing [list of ignored files in packlist](https://github.com/npm/npm-packlist/blob/master/index.js#L38) and make sure we have tests asserting it behaves the way we intend.

## Unresolved Questions and Bikeshedding

:warning: **Make sure we don't break the ecosystem** - We should definetily err on the side of caution here.

