# Withdrawal Amendment

- The particular implementation this RFC was based on no longer exists, links are handled differently now that `npm install` is handled by [Arborist](https://github.com/npm/arborist/).

## Relevant Resources

Withdrawn consensus achieved during the [Wednesday, June 16, 2021 OpenRFC meeting](https://github.com/npm/rfcs/issues/399)
- Meeting Notes: https://github.com/npm/rfcs/blob/515b8f310eb4605022c8b25849dfc9941f321885/meetings/2021-06-16.md
- Video Recording: https://youtu.be/N6cEmHKPRfo

# Refreshing the `npm link` command

## Summary

Remove `npm install --link`. Change `npm link` behavior to directly create symlinks for dependencies that already exist and record this fact into a local project file. Make `npm unlink` stop being an alias for `npm rm` and instead undo what the new `npm link` does, restoring a non-linked copy of the dependency.

Note: This is a breaking change due to the all new `npm link`, the splitting of `npm unlink` from `npm rm` and the removal of `npm install --link`.

## Motivation

The introduction of lock files and a synchronization workflow in `npm@5` broke certain assumptions that the `npm link` and `npm install --link` commands took advantage of.  They expected that they could replace a real module with a symlink to one of the same version and `npm install` would leave their symlink alone.

Starting with `npm@5`, any symlink is expected to be recorded in the `package.json` or lock-file as a `file:` type dependency.

The result is that any run of `npm install` after creating a symlink with `npm link` or `npm install --link` when you have a lock-file results in the symlink being removed and a copy of the module installed in the usual way.

## Detailed Explanation

### USE CASES FOR DEVELOPMENT ONLY LINKING

When fixing a bug in a dependency or transitive dependency, it is often desirable to be able to test it directly in the project that consumes it. With `npm link` you can create a symlink to the under-development dependency while continuing to otherwise work with your module normally.

When working with a project with a number of tightly coupled dependencies it is often desirable to work on all of them simultaneously.  `npm link` provides a facility for symlinking them and keeping them symlinked.

### NEW FILE & LINK PERSISTENCE

We will introduce a new file for tracking local install specific metadata with `node_modules/.dependency-info.json`. This file is not intended to be committed.

Links will be recorded in a `links` property that is an object mapping package names to link paths.

### CHANGES TO COMMANDS

#### `npm link /path/to/module-name`
#### `npm link /path/to/module-name [module-name@]version-spec`

(Aliases: `npm ln`)

With no arguments or `.`, display usage.

Create a new development link in your project for the module contained in `/path/to/module-name`.  If a version specifier is included (eg `^1.0.0`) then only modules that match it are replaced with a link.  If no version specifier is included then ALL modules with the same name are replaced.

Links are saved in the `links` field in the dependency-info file.  Linked dependencies have their own separate dependency tree installed inside their own `node_modules` and their own lock-file.

#### `npm unlink`
#### `npm unlink module-name[@verson-spec]`
#### `npm unlink /path/to/module-name`

Without arguments, removes all links.

Remove an existing development link from your project.  This does not remove `module-name`—it removes the `link` field from the dependency record and replaces any symlinks to `module-name` with a normally installed copy of it.

If no further links remain in the dependency-info file and no other information is contained in it, it should be unlinked.

Removal should indicate how to recreate the link should the user wish to do so.

#### `npm install`

`npm install --link` is no longer be a valid option.

`npm install` creates an links specified in the dependency-info file, along side the usual install results.

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
3. Save links to the package-lock to persist them between users.

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

Changes the selection of  new dependencies to resolve (via `loadDeps` or `loadDevDeps`) and matching existing real deps to requested deps (`doesChildVersionMatch`):

Match existing dependencies based on the `links` dependency-info property, and when installing missing dependencies use the `links` dependency-info property.

### `npm link /path/to/module-name`
### `npm link /path/to/module-name [name@]version-spec`

A subclass of the `Installer` class that edits the dependency-info links property before doing ideal tree resolution.

### `npm unlink [module-name[@version-spec]]`

As with `npm link`. If no links remain and no other data is in the dependency-info file then it should be removed.

With no arguments removes ALL the links.


## Prior Art

This provides development time only linking similarly to _workspaces_. The primary difference is that _workspaces_ are built for use with monorepos and `npm link` is not. We intend to implement _workspaces_ separately in the future.

## Out of scope

Previous discussion of this RFC discussed the needs of some users to not prune extraneous dependencies of any kind. Supporting that use case is out of scope for this RFC and should be addressed separately.
