# Add Types Metadata to the Registry [Packument](https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md#package-endpoints)

## Summary

Add an unambiguous notation to the derived package.json whether a dependency includes types.

## Motivation

It would be great to know from the NPM API if a library included type definitions. This would allow the npm website, and other tooling to be able to help people make decisions about which dependencies they would like to use and support for types plays into that.

## Detailed Explanation

Working with one of my libraries which ships with both Flow and TypeScript types:

[Package.json](https://github.com/danger/danger-js/blob/e7d9b6a515eabe0488a5f0ec196319c7fbe479b0/package.json)

```json5
{
  "name": "danger",
  "version": "10.1.0",
  "description": "Unit tests for Team Culture",
  "main": "distribution/danger.js",
  "typings": "distribution/danger.d.ts",
  "bin": {
    // 
  }
  "prettier": {
    // ...
  },
  "scripts": {
    // ...
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/danger/danger-js.git"
  },
  "keywords": [
    "danger",
    "ci"
  ],
  "author": "Orta Therox",
  "license": "MIT",
  "bugs": {
    "url": "https://github.com/danger/danger-js/issues"
  },
  "homepage": "https://github.com/danger/danger-js#readme",
  "devDependencies": {
    // ...
  },
  "dependencies": {
    // ...
  },
}
```

This `package.json` unambiguously declares that it has TypeScript types. However, a flow user has no idea that I put the time in [to maintain](https://unpkg.com/browse/danger@10.1.0/distribution/danger.js.flow) support for them!

I propose that [the packument version of this package](https://registry.npmjs.org/danger/10.1.0) have a new field `"_types"` which would look like:

```json5
{
  // ...
  "dependencies": {
    // ...
  },
  "gitHead": "66e18daae5286ea64ed49484fd5835685684c156",
  "_id": "danger@10.0.0",
  "_types": {
    "ts": "included",
    "flow": "included"
  }
}

```

The shape of this copies the work we did in [Algolia's npm search index](https://github.com/algolia/npm-search/pull/346). 

This RFC would explicitly _exclude_ information on 3rd party types hosted on [DefinitelyTyped](https://github.com/DefinitelyTyped/) and [FlowTyped](https://github.com/flow-typed/flow-typed) - the assumption is that anyone wanting to provide comprehensive type information for _any_ package would check their registries if no type information is present in the packument.

### "Unambiguous"

Both flow and TypeScript types work on projects which don't declare that they have types inside them. I could remove `"typings"` in the above `package.json` and TypeScript would exhibit the same behavior. That would mean that the current package.json would not have any indication that there is typed support for either tools.

### Downside of Recommendation

1. This would mean that only newly shipped packages with the latest CLI would have that information. In theory, you could backport the logic and re-run it across the whole registry... That's quite a bit of work though.
1. The naive recommendation of "check for *.d.ts / *.js.flow" could mean that projects which have types setup incorrectly could be triggered as a false positive. Personally, I think this is a tiny edge case and one likely a human would intervene on with fixing their types. The project could "have types", just not in the right places.

## Rationale and Alternatives

1.  Don't have that metadata on the site. Both TS/Flow represent unofficial extensions of JavaScript and who knows what the future holds.
1.   Ping the algolia npm index for that information. I would expect you to want to keep your server side dependencies low, and including this information in the registry would allow you to keep one source of information.

## Implementation

Personally, I think a simple check for the inclusion in the package tarball for any `.d.ts` file should be enough for TypeScript, and _I believe_ that a check for `.js.flow` would be enough for Flow typings. 

These can happen during `npm package` in the CLI.

## Prior Art

[The algolia npm-search index](https://github.com/algolia/npm-search/) - which I believe powers the search on https://www.npmjs.com
