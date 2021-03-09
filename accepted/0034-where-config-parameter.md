# {{TITLE: Add a `where` parameter for `npm config` and `npm exec` commands}}

## Summary

Several commands in the npm CLI would benefit from the ability to specify `where` the command should act on. The two specific implementations I'd like to propose are:
1. Telling `npm config` which config file you want to modify.
2. Telling `npm exec` explicitly where it should look for binaries.

The `npm config set` command currently has the ability to modify the user-level npmrc as well as the global npmrc, but not a project level one.

The `npm exec` command isn't reliably deterministic about exactly what bin script it will run, especially in the case of overlapping project and global installs as well as its use of an isolated cache. There is additional confusion in that, for example, `npx typescript` will never run a locally installed binary as the parameter must currently match a linked bin rather than a package name as it does for remote resolution.

Adding an explicit `--where=<global|user|project|remote>` parameter would provide for this in a reliable and unsurprising way.

## Motivation

The `npm config set` command currently has the ability to modify the user-level npmrc as well as the global npmrc, but not a project level one. Adding an explicit `--where=<global|user|project>` parameter would provide for this in a reliable and unsurprising way.

For `npm exec` there is currently a lot of ambiguity as to where a binary will be found, the `--where=<global|project|remote>` option would allow a user to specify exactly where we should look, eliminating the current fallback pattern and making the use of project shipped binaries more consistent.

## Detailed Explanation

### `npm config`

Currently, there are 4 places we will read an `npmrc` config from.

- Built-in
- Global
- User
- Project

However, the `npm config` commands (with the exception of `npm config get` and `npm config list` which read from all locations simultaneously) currently only allow modifying either the User (default) or Global (pass `--global`) config. This can lead to unexpected behavior for users who want to edit their Project config as there is currently no way to do so with the CLI. (NOTE: Editing the Built-in config is not exposed either, but should remain that way)

This change would allow a user to run, for example, `npm config set --where=project key=value` to inform the CLI of exactly which config to modify.

Other file modifying commands would gain the same explicit location behavior, while `npm config get` and `npm config list` would be given the ability to read only from the location the user explicitly asks for.

### `npm exec`

Here we have another case of cascading fallbacks when determining where to locate a binary. Today, when you run `npm exec -- tap` (or more likely `npx tap`) we will look for a binary in these locations:

- `${npm bin}/tap` (a bin matching the exact name in your project's `node_modules/.bin`)
- `${npm bin -g}/tap` (a bin matching the exact name in your global `bin`)
- a package in your configured registry matching that name that contains either exactly one `bin` definition, or if more than one a `bin` named for the package minus the scope (i.e. `@foo/bar` must specify a single bin with any name, or multiple bins with one named `bar`)

This can lead to ambiguous results for some common globally installed binaries, like `tsc` or `standard`, where it may be installed locally as well as globally, and potentially already exists in the user's cache as well.

This confusion can be even worse for modules where the installed binary does not match the name of the package. For example, `typescript` installs a bin named `tsc` so if you run `npx typescript` a locally or globally installed binary will not be found and we will go straight to the registry package.

Providing a `--where=<project|global|remote>` parameter would allow a user to choose specifically where we should look for a binary.

A user running `npm exec --where=project -- typescript` would be able to know for certain that we will either execute a binary installed by their project, or fail.

Along with this, we will apply the same binary resolution rules we use for remote packages. Rather than looking for `./node_modules/.bin/tsc`, we would load your actual installed package tree and prioritize by:

1. A package named exactly `tsc` that has only one bin definition, or a bin named `tsc`
2. Any package with a bin definition named `tsc`

If there are no matches for case 1, we would sort a potential list of results from case 2 based on depth within the actual tree. This would ensure that we're running the bin that you are most likely to have dependend on yourself in the case of collisions, eliminating another point of potential inconsistency.

The same logic would apply for global packages, with the caveat that we will not explore bin definitions of packages that were not directly installed (i.e. an additional filter where `depth === 1`).

For remote packages we would maintain the current behavior where the given argument must match a package name that contains only one bin or if multiple bins, one with the same name as the package without its scope. Though there is the potential for proposing to the registry team a means of searching for a package based on a bin name, this is far outside the scope of this RFC.

## Rationale and Alternatives

An alternative to this would be to introduce multiple flags. We already have `--global` but would need (for example) `--user` and `--project` flags to allow for the other locations.
The problems with this approach are that it adds two flags that may overlap with other future features, as well as introducing ambiguity when multiple flags are specified (i.e. user types `npm config set --global --user key=value`)

Having one flag that accepts multiple values gives us a far more deterministic way for users to inform us of where to act.

## Implementation

The first step will be to audit npm commands that define a local `where` variable and determine whether the new config variable is applicable, and if not rename the locally defined variable to reduce confusion.

After that, we must audit npm dependencies that accept a `where` parameter and determine if it can be renamed to something more accurate (typical usage indicates `cwd` is probably better for most current usages).

### `npm config`

Currently we create an implicit `where` variable in the implementation seen [here](https://github.com/npm/cli/blob/8806015fdd025f73ccf4001472370eafd3c5a856/lib/config.js#L122) with one of two values, dependent on the `global` flag. The implementation would involve creating `where` as a variable in the config and using it directly instead of assigning it locally. Effectively it means removing the linked line of code as well as any others that define `where` locally.

By setting the default value of `where` to `'user'` the current behavior will be unchanged.

The `adduser` and `logout` commands currently are hardcoded to use `'user'` instead of referencing a variable, which is behavior I believe should remain as-is in order to avoid users accidentally saving credentials into project-level config files.

### `npm exec`

Implementation here is somewhat more involved. The logic found [here](https://github.com/npm/cli/blob/8806015fdd025f73ccf4001472370eafd3c5a856/lib/exec.js#L99-L117) would be expanded to create an instance of arborist, load your actual tree and iterate its inventory looking for a bin based on the rules detailed above.

For project installed packages, if a bin is found, we would verify that the link and/or shim located in that location's bin directory points to the exact package we matched. If it does not, we would overwrite it with one that does, and then execute the freshly linked/shimmed bin.

For the case of globally installed packages, there is no need to ensure the correct bin is linked as we will only link the bin of a directly installed global package. However, we would still apply the search logic here so that `npm exec --where=global -- typescript` will function as expected.

Remote package behavior would remain exactly as it is today.

When the `where` config is unset, we will maintain the existing behavior of searching locally installed packages, then globally installed packages, then remote packages. The only change would be that the bin we run will be overwritten to the shallowest match in the user's actual tree before executing it, eliminating the current race condition that exists in the case of a conflicting bin in your tree.

There is the potential that when run in interactive mode we can also display a list of everywhere we found something we _could_ run based on the user's request and prompt them to tell us which one.

## Unresolved Questions and Bikeshedding

Is `where` the best name for this config? What if there are too many conflicts in dependencies?

### `npm config`

Should we prevent a user from setting protected fields like `_auth` or `_token` to a project level config?

Are there other fields that are undesirable at the project level?

### `npm exec`

Should we prompt when multiple matches are found? If we would prompt but are unable to, what should we do?
