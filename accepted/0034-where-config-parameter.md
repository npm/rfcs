# {{TITLE: Add a `where` parameter for `npm config` commands}}

## Summary

The `npm config set` command currently has the ability to modify the user-level npmrc as well as the global npmrc, but not a project level one.

Adding an explicit `--where=<global|user|project>` parameter would provide for this in a reliable and unsurprising way.

## Motivation

Aside from being missing functionality that we should provide, the lack of this feature can also lead to unexpected behavior when using `npm config set` within a project that includes an `.npmrc` file.

## Detailed Explanation

Currently, there are 4 places we will read an `npmrc` config from.

- Built-in
- Global
- User
- Project

However, the `npm config set` command only allows modifying either the User (default) or Global (pass `--global`) config.
This can lead to unexpected behavior for users who want to edit their Project config as there is currently no way to do so with the CLI.
(NOTE: Editing the Built-in config is not exposed either, but should remain that way)

This change would allow a user to run `npm config set --where=project key=value` to inform the CLI of exactly which config to modify.

## Rationale and Alternatives

An alternative to this would be to introduce multiple flags. We already have `--global` but would need (for example) `--user` and `--project` flags to allow for the other locations.
The problems with this approach are that it adds two flags that may overlap with other future features, as well as introducing ambiguity when multiple flags are specified (i.e. user types `npm config set --global --user key=value`)

Having one flag that accepts multiple values gives us a deterministic way for users to inform us of which config file they would like to make changes to. It would also allow a user to set their own default config file location by running `npm config set --where=user where=project` causing future `npm config set` commands to create and/or modify a project level config. A future change would allow us to change this default to `project` to more closely emulate how commands like `git config` work.

## Implementation

This change should only impact the `npm config` command. The value of the parameter will be used to determine which file location we save your configuration change to or read your configuration from. Currently we create an implicit `where` variable in the implementation (seen here: https://github.com/npm/cli/blob/latest/lib/config.js#L122). The implementation would involve creating `where` as a variable in the config and using it directly instead of assigning it locally based on a condition.

By setting the default value of `where` to `'user'` the current behavior will be unchanged.

The `adduser` and `logout` commands currently are hardcoded to use `'user'` instead of referencing a variable, which is behavior I believe should remain as-is in order to avoid users accidentally saving credentials into project-level config files.

## Unresolved Questions and Bikeshedding

Should we prevent a user from setting protected fields like `_auth` or `_token` to a project level config?

Are there other fields that are undesirable at the project level?
