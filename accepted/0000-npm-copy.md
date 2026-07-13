# npm copy <destination>

## Summary

`npm copy <destination>` copies the current project's files and dependencies to
`destination`.

## Motivation

When deploying a project (`COPY` into a docker image, `zip` into an archive)
non production dependencies and files should be excluded. npm has some commands
that cover this usecase (`prune`, `pack`, `install -g` but they each have
issues, especially when workspaces are used. 

```
# copy app's production dependencies and packaged files to out
npm copy out --production -w app

# copy all workspace production dependencies and packaged files to archive
npm copy out --production --workspaces
```

### Why not `npm prune`

 - prune can remove dev dependencies from node_modules but it does not remove
excluded [files].
 - prune modifies the project so a developer would have to reinstall
   development dependencies to continue working on the project.
 - prune does not remove dependencies that are hoisted to a workspace
   package [npm/cli#4024].

### Why not `npm pack`

`npm pack` creates an archive of the package's included files. With
[bundledDependencies] the archive will even include prod dependencies.

In non-workspace projects you can approximate `npm copy` with a few commands

```
npm pkg set bundledDependencies true
tarball=$(npm pack | tail -n 1)
tar xzvf "$tarball" --strip-components 1 -C <destination>
```

However npm pack does not bundle workspace package dependencies correctly
[npm/cli#3466]. If a dependency is installed outside the package folder it will
not be included in the bundle.  `npm pack -w a` will not include `prod` in the
archive if `prod` was installed in the workspace root.

### Why not `npm install -g .`
This has the same issues as `npm pack`. You could use `npm install -g .`
without bundling dependencies but you'll have to publish all workspace packages
to the registry first. You'll have to use a shrinkwrap file if you want to use
consistent dependencies as your dev env.

npm global installs ignore project npmrc files, which could ignore a configured
registry.

## Detailed Explanation

`copy` is a workspace aware command, by default it copies the current project,
but the `--workspaces`, and `--workspace` flags direct `copy` to include all
workspace packages or a list of workspace packages. `copy` uses [npm-packlist]
to copy [files] that would be included by `npm pack`. `copy` ignores bundled
dependencies and instead copies all dependencies of included packages. `copy`
respects the `--production` and `--omit` flags so can copy only production
dependencies. `copy` should expect node_modules to be present and correct and
should not fetch dependencies.

## Rationale and Alternatives

### Alternatives 
- A tree shaking bundler like `esbuild` could create an even smaller project
bundle than `npm copy`.
- `npm dedupe`, `npm pack` and `npm install -g` are covered above.
- `npm pack` may be a viable alternative if [npm/cli#3466] is solved but `copy` will still have some advantages.
 - pack bundles each workspace package individually, possibly duplicating
   shared dependencies in each archive, while copy copies the workspace with
   it's hoisted dependencies.
 - pack requires bundledDependencies
 - parsing the pack output to read the archive is a pain
 - pack creates a file that must be cleaned

## Implementation

I've written a test [implementation], I can create a draft pull request.

## Unresolved Questions and Bikeshedding

 - should copy include workspace root dependencies when include-workspace-root is false?
    - should there be another argument?
 - which lifecycle hooks should copy run?
 - should copy create bin links?

[npm-packlist]: https://www.npmjs.com/package/npm-packlist
[files]: https://docs.npmjs.com/cli/v8/configuring-npm/package-json#files
[bundledDependencies]: https://docs.npmjs.com/cli/v8/configuring-npm/package-json#bundleddependencies
[npm/cli#3466]: https://github.com/npm/cli/issues/3466
[npm/cli#4024]: https://github.com/npm/cli/issues/4024
[implementation]: https://github.com/everett1992/cli/pull/1
