# Refreshing the `npm link` command

## Summary

Remove `npm install --link`. Change `npm link` behavior to directly create symlinks for dependencies that already exist and record this fact to the lock-file. Make `npm unlink` stop being an alias for `npm rm` and instead undo what the new `npm link` does, restoring a non-linked copy of the dependency.

Note: This is a breaking change due to the all new `npm link`, the splitting of `npm unlink` from `npm rm` and the removal of `npm install --link`.

## Motivation

The introduction of lock files and a synchronization workflow in `npm@5` broke certain assumptions that the `npm link` and `npm install --link` commands took advantage of.  They expected that they could replace a real module with a symlink to one of the same version and `npm install` would leave their symlink alone.

Starting with `npm@5`, any symlink is expected to be recorded in the `package.json` or lock-file as a `file:` type dependency.

The result is that any run of `npm install` after creating a symlink with `npm link` or `npm install --link` when you have a lock-file results in the symlink being removed and a copy of the module installed in the usual way.

## Detailed Explanation

### USE CASES FOR DEVELOPMENT ONLY LINKING

When fixing a bug in a dependency or transitive dependency, it is often desirable to be able to test it directly in the project that consumes it.  With `npm link` you can create a symlink to the under-development dependency while continuing to otherwise work with your module normally.  By persisting this to your lock-file it allows this decision to be branch specific.

When working with a project with a number of tightly coupled dependencies it is often desirable to work on all of them simultaneously.  `npm link` provides a facility for symlinking them and keeping them symlinked and the lock-file persistence means that new member of the project can get this configuration with little ceremony.

### PACKAGE-LOCK

lock-file files have a new lockfile property on dependency objects: `link`

The value of `link` is a path relative to the lock-file.

### CHANGES TO COMMANDS

#### `npm link`

With no subcommand, it is an alias for `npm link create`.  With an invalid subcommand the error message should note the change and behavior and point the user at `npm help link`.

#### `npm link create`

Create all development links referenced in the lock-file.  Failures due to missing link sources or missing package data (or invalid package data) are WARNINGs that result in no link being created.  Version mismatches in linked modules are also warnings but they still create a link.

With no development links in lock-file warn with usage, but exit without error code.

#### `npm link create module-name[@version-spec]`

Search the lock-file for modules matching `module-name` and optionally `version-spec`, create links for those.  If no modules match, exit with an error.

#### `npm link clear`

Remove all development links from your `node_modules`.  This does not modify your lock-file, it just undoes what `npm link create` does.

#### `npm link clear module-name[@version-spec]`

Remove development links for modules matching the `module-name` and if provided the `version-spec`.

#### `npm link add /path/to/module-name`
#### `npm link add /path/to/module-name version-spec`

Create a new development link in your project for the module contained in `/path/to/module-name`.  If a version specifier is included (eg `^1.0.0`) then only modules that match it are replaced with a link.  If no version specifier is included then ALL modules with the same name are replaced.

Links are saved in new `link` field on the dependency record they replace in your lock-file.  The dependencies in the lock-file do not take into account any development links.  Linked dependencies have their own separate dependency tree installed inside their own `node_modules` and their own lock-file.

#### `npm link remove module-name`
#### `npm link remove /path/to/module-name`

(Aliases: `npm link rm`, `npm unlink`)

Remove an existing development link from your project.  This does not remove `module-name`—it removes the `link` field from the dependency record and replaces any symlinks to `module-name` with a normally installed copy of it.

#### `npm install`

`npm install --link` is no longer be a valid option.

`npm install` leaves any development links created by `npm link create` in place.

`npm install module-name@latest` where `module-name` is currently a development link, will update your `package.json` and lock-file but will not do anything on disk.  It warns that the link was left in place.

#### `npm outdated`
#### `npm update`

Outdated and update run against your lock-file and thus use the unlinked versions when determining what needs doing.  Because `npm update` is built on top of `npm install` it gets the "don't clobber links" behavior automatically.

#### `npm ls`

Listing your install tree reports development linked dependencies as fulfilling their requirements.  In the case where the version of the development linked dependency doesn't match the version in your `package.json` they are flagged visually.

#### `npm pack` and `npm publish`

`npm pack` and `npm publish` fail if any bundled dependencies are currently installed as a development link.

#### `npm unlink`

Is an alias for `npm link clear`.  (Previously this was an alias for `npm rm`.)

### CAVEATS

This specification of the new `npm link` command provides no facility for replacing a specific transitive instance of a dependency.  Concretely:

If you depend on `module-a` and `module-b` and both of them depend on the same version of `module-shared`, there is NO facility for linking `module-a`'s `module-shared` without ALSO linking `module-b`'s `module-shared`.  It SHOULD be possible to build a stand alone tool to support this, but it's out of scope for the initial `npm link` implementation.

## Rationale and Alternatives

Alternative options:

1. Not do anything. This means `npm link` and `npm install --link` with a lock-file are not useful as links will immediately be erased.
2. Leave all links alone. This would restore previous behavior around `npm link` and `npm install --link` but would make it impossible for npm to do the right thing if a `package.json` dependency changed from a `file:` specifier to a registry one as that would be indistinguishable from a link created with `npm link`.

The second option is appealing for existing users, but introduces an inconsistency with how npm models it's use. npm views its job as synchronizing your `node_modules` with your `package.json` and lock-file.

## Implementation

Broken out by command:

### `npm link`
### `npm unlink`

All new commands that inherit from the `Installer` class. They do the normal load of the existing tree and lock-file and then mutate that to include their new kinds of links. They rely on changes to `npm install` to propagate their changes to the user's `node_modules` and lock-file.

### `npm outdated` 
### `npm update`

Likely these will not require changes, as the changes to the resolver will make the implementation transparent.

### `npm ls`

Currently `file:` type specifiers are displayed as:

```
name@version -> /path/to/thing
```

They will be changed to display as:

```
name@file:/path/to/thing
```

Dev linked items will be displayed as:

```
name@version -> /path/to/thing
```

Where `version` is the version from the lock-file that would have been used without the link.

### `npm pack` & `npm publish`

Will scan the tree after reading it to look for any dev linked bundled items. If any are found they will abort with an error.

### The resolver: `install/deps.js`

Has three new modes of operation when selecting new dependencies to resolve (via `loadDeps` or `loadDevDeps`) and matching existing real deps to requested deps (`doesChildVersionMatch`).

1. Ignore the `link` lock-file property and only match and install the `package.json` and `lock-file` specifiers. This is the current behavior.
2. Match existing dependencies based on the `link` lock-file property OR the specifiers, but when installing missing dependencies use the specifier. This is the new `npm install` behavior.
3. Match existing dependencies based on the `link` lock-file property, and when installing missing dependencies use the `link` lock-file property. This is the `npm link create` behavior.


### `npm link create`

A subclass of the `Installer` class that uses the third mode for the resolver as discussed above.

### `npm link create module-name[@version-spec]`

Not quite the same flow as `npm i module-name[@version-spec]`. The `install` variant removes any existing copy of `module-name` then installs a new one. By contrast `create link` needs to request that just that dependency be made available via `link` metadata, without mutating the lock-file.

### `npm link clear`
### `npm link clear module-name[@version-spec]`

A subclass of the `Installer` class that uses the first mode for the resolver as discussed above.

### `npm link add /path/to/module-name`
### `npm link add /path/to/module-name version-spec`

As with `npm link create` but edits the lock-file prior to resolving the ideal tree.

### `npm link remove module-name`

As with `npm link clear` but edits the lock-file prior to resolving the ideal tree.

## Prior Art

This provides development time only linking similarly to _workspaces_. The primary difference is that _workspaces_ are built for use with monorepos and `npm link` is not. We intend to implement _workspaces_ separately in the future.

## Out of scope

Previous discussion of this RFC discussed the needs of some users to not prune extraneous dependencies of any kind. Supporting that use case is out of scope for this RFC and should be addressed separately.

## Open Discussion

How to integrate this with the use case raised by @giltayar:

> Ephemeral style, where you want to `npm link` elsewhere, just for trying things out. This can be to a package that resides in a totally different git repo. This is where you must _not_ persist this link in `package-lock.json` as it is relevant only for that certain developer on that certain computer, and therefore should not be commited to source control. This is also relevant for people not using `package-lock.json`.
