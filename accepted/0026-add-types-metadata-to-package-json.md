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
   //... 
  "devDependencies": {
    // ...
  },
  "dependencies": {
    // ...
  },
}
```

This `package.json` unambiguously declares that it has TypeScript types. However, a flow user has no idea that I put the time in [to maintain](https://unpkg.com/browse/danger@10.1.0/distribution/danger.js.flow) support for them!

I propose that [the packument version of this package](https://registry.npmjs.org/danger/10.1.0) we emulate the file resolvers for TS + Flow and ensure their fields are filled if they are not present. For example, when publishing a field for "flow" would be added:

```diff
{
  // ...
  "dependencies": {
    // ...
  },
+  "gitHead": "66e18daae5286ea64ed49484fd5835685684c156",
+  "flow": "./distribution/danger.js.flow"
}
```

- When there is an explicit `"types"` or `"typings"` (for TS explicitly, from reading [their docs](https://flow.org/en/docs/declarations/), do nothing. Flow does not have a field like this) in the manifest, and so this would _add_ that field.

- If there is not the explicit fields: Resolving the `main` with both TypeScript and Flow's extra file resolvers (e.g. when `distribution/danger.js` look for the files `./distribution/danger.js.flow` and `./distribution/danger.d.ts`)

- If we got here then there are no TS/Flow files in the package, do nothing


##### Path handling

This RFC would always add the relative path to an existing file if the fields are empty.  
This allows for downstream consumers to be able to differentiate between a module hosting their types and a file available inside the package.

<details>
  <summary><i>Note:</i> The original version of this proposal used boolean values...</summary>
    
Which assumed that API clients would do some of the work themselves to get the root of the types:

```json
"_types": {
  "ts": "included",
  "flow": "included"
}
```

We can already do the work ahead of time, and `_typeRoots` is less likely to have conflicts in the registry I imagine.
</details>

### "Unambiguous"

Both flow and TypeScript types work on projects which don't declare in the `package.json` that they have types. 

For example, I could remove `"typings"` in the above `package.json` and TypeScript would exhibit the same behavior. That would mean that the current `package.json` would not have any indication that there is typed support for either tools.

This ambiguity makes it hard for someone wanting to build tools which offer information about whether the package offers types.

### Downside of Recommendation

1. This would mean that only newly shipped packages with the latest CLI would have that information. In theory, you could backport the logic and re-run it across the whole registry... That's quite a bit of work though.
1. The naive recommendation of "check for *.d.ts / *.js.flow" could mean that projects which have types setup incorrectly could be triggered as a false positive. Personally, I think this is a tiny edge case and one likely a human would intervene on with fixing their types. The project could "have types", just not in the right places.

## Rationale and Alternatives

1. Use the `npm package` command to make maintainers explicitly fill out the `"types"` field when a `.d.ts` can be inferred from `"main"` via a warning for a few releases, then a fail.  

   This could work, however it would favour TypeScript today. There isn't a similar manifest field for Flow, though they could definitely pick one and roll with it also. 
  
   This would mean that we don't need to add reserved fields to the packument, and these fields becomes a cultural norm. The downside is that this puts work on existing maintainers to amend their package.jsons. 

1. Don't have that metadata on the site. Both TS/Flow represent unofficial extensions of JavaScript and who knows what the future holds.
1. Ping the algolia npm index for that information. I would expect you to want to keep your server side dependencies low, and including this information in the registry would allow you to keep one source of information.

## Implementation

Personally, I think a check for the inclusion in the package tarball for any `.d.ts` file should be enough for TypeScript, and the check for `.js.flow` would be enough for Flow typings. 

These can happen during `npm package` in the CLI.

## Prior Art

[The algolia npm-search index](https://github.com/algolia/npm-search/) - which is currently the best index of what packages have types included in their modules
