# Alternative Format for `package.json`

## Summary

A long-standing issue with `package.json` is its lack of support for comments. This RFC proposes supporting `package.json5` as an *optional* alternative to `package.json`.

## Motivation

Users *really* want to be able to write comments in `package.json`, but the JSON format does not support comments. There are various workarounds, but they all have serious issues, for example only allowing a single comment, only working with the `scripts` key, relying on duplicate JSON keys, etc.

## Detailed Explanation

When NPM runs and tries to read `package.json` it would now perform these steps:

1. Check to see if `package.json5` exists instead. If not fall back to the current behaviour.
2. If `package.json5` exists, read that file instead of `package.json` (which is ignored).
3. If the `write_package_json` key is set to `true` then it would also write out the config as `package.json` (excluding the `write_package_json` key), overwriting any existing file. `write_package_json` defaults to `false`.

## Rationale and Alternatives

There are several possible alternatives that are worse:

### Just allow comments in `package.json`

Microsoft has several `.json` config files that are not strictly JSON because they support comments, e.g. `tsconfig.json` or `.vscode/settings.json`. In VSCode they added a "JSONC" editor mode to support editing this files. So one possibility is to redesignate `package.json` as JSONC. However there are some serious downsides:

1. [Microsoft views JSONC as an internal format]() and does not want anyone else to use it. Lots of people didn't know that - or didn't care - so there are now at least [two]() [attempts]() to formally specify JSONC. The problem is there was never really a proper specification for it so implementations vary a lot in whether they support trailing commas.
2. Changing the format without changing the filename is going to be quite confusing and break a lot of tools in confusing ways.

The upside to this approach is that "JSONC" is so common that many JSON parsers do actually support parsing it.

### Use a different format

There are a small number of alternatives to JSON5 that would also be an option. However I think JSON5 wins based on a few features:

* It's similar to JSON (and backwards compatible with it), using syntax rules that everyone already knows from Javascript.
* It's moderately popular.
* It doesn't have any surprising or janky behaviour (like YAML).

See the Bikeshedding section for more.

### Don't tie it to a specific format

One other option is to somehow allow the user to specify their own custom command that generates `package.json` that NPM runs automatically. But I can't think of a good way to make this work and it introduces extra security questions.

## Implementation

TODO

## Prior Art

I'm not aware of any prior art.

## Unresolved Questions and Bikeshedding

### Which format?

There are a some other formats that may be suggested instead of JSON5.

* JSONC - even though it isn't standard, it could be used as `package.jsonc`.
* TOML - a decent format that is quite popular. Despite the claims its name makes it is only "obvious" for very simple config formats with little nesting, but `package.json` does fit that bill. The syntax is very different to JSON though.
* YAML - clearly an insane option but some people like it.
* Dhall, Cue, Jsonnet, Pkl - new kids on the block but they're generally more complex and don't have as wide support as the other langauges.

### Exactly when does NPM generate `package.json`

Under what exact conditions does NPM write out `package.json` (if enabled)? I think most people would agree that `npm install` and `npm run` should. What about other situations?
