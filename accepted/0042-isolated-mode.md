# Isolated mode

## Summary

This RFC is a proposal to add a new opt-in installation mode.

This mode aims at preventing workspaces from over-sharing their
dependencies. With this mode, two workspaces will share a dependency only
if both have declared it in their package.json.

While this RFC aims at improving projects with workspaces, isolated-mode
could be valuable for any project, whether or not it uses workspaces.

## Motivation

The introduction of workspaces in npm v7 brought the ability to split large
code-bases into smaller pieces of code with declared dependencies between
them. This pattern is sometimes referred to as a "monorepo."

Several build tools took advantage of these declared dependencies to split
the builds into multiple steps (one per workspace). These build tools take
advantage of the declared dependencies between workspaces to only rebuild
the workspaces that have not changed since the last build. With the current
way npm works, any dependency change to any workspace may affect any other
workspace. This means that the build systems need to rebuild the entire
project every time a single workspace modifies a dependency. This is
inefficient and does not scale.

## Naming

This mode is called `isolated-mode` because it makes the boundaries between
packages and workspaces stronger, making them more isolated.

To make the discussions more efficient, we could also name the current
default installation mode of npm. We will call this mode `hoisted-mode` as
packages are shared across workspaces by hoisting them to the root of the
project. This term is already known by developers familiar with yarn or
pnpm.

## More on the problem

Packages and workspaces declare their dependencies to npm by using special
fields in their `package.json`. The Node.js runtime is unaware of these
special fields, instead it uses a [module resolution
algorithm](https://nodejs.org/api/modules.html) to determine the meaning of
a module importing another module. npm bridges this gap by converting the
declared dependency graph into a folder structure which makes sense to
Node.js. This operation is call `reification`.

When converting the dependency graph to a folder structure, `hoisted-mode`
loses information. Multiple different dependency graphs can be converted to
an identical folder structure. Since the folder structure is all that
Node.js uses to resolve modules, Node.js misses some information about
dependencies. This loss of information is most frequently visible through
the fact that packages in the tree are able to successfully import packages
that they have not explicitly declared as dependencies.

When packages import dependencies that are not explicitly declared, they
are do not take advantage of the dependency contracts enforced by npm.
Thus, when installed in a different environment, the dependency may be
missing, or may be a version that they cannot use properly, causing errors
at run time.

In a monorepo project using workspaces, this means that a dependency of any
workspace may be imported by all other workspaces, making it difficult to
detect such errors at development time.

### Forgetting to declare dependencies

When workspaces can successfully use code of a package without having a
dependency on it, people forget to declare their dependencies. This leads
to situations where updating the dependencies of one workspace breaks a
seemingly unrelated workspace.

It is worth noting that static code analysis tools can help significantly
reduce the frequency of these mistakes. While static code analysis tools
can help fix many issues regarding missing dependencies, there are several
classes of issues that cannot be detected by static code analysis.
"isolated-mode" not only helps get the dependencies right but also _proves_
that the dependencies are correct. This proof is essential to build
trustable build systems which use caching, scoped installations.

### Duplication

The `hoisted-mode` is not always successful at sharing common dependencies.
Conflicts in versions lead to packages being installed multiple times on
disk. These conflicts become more frequent when the project scales. The
frequency of these conflicts can be reduced by an effort to align
dependencies' versions across the project.

These duplications come with the following cost:

- Performance degradation of the installation phase
- Inefficient disk usage
- Performance and memory cost at runtime as Node.js sees duplicated modules
  as two different modules.

### Tools crawling the node_modules folders

Certain tools implement their own module resolution algorithm instead of
the one provided by Node.js. One of the motivation for a tool to implement
its own resolution algorithm is that it can add more features to it.

Crawling the `node_modules` folder is such a feature used by certain build
tools. This feature means that the mere presence of a package in a
`node_modules` folder will have an impact on the output of a workspace.
This means that any modification of a project's `node_modules` folder is
possibly a breaking change to every workspaces in this project, regardless
of the dependency graph.

For example, the TypeScript compiler by default includes to its compilation
_every_ package in the folder `node_modules/@types` without any explicit
import statement needed.

## Rationale

The [import-maps](https://github.com/WICG/import-maps) draft standard is a
very good tool to communicate the dependency graph to Node.js. But because
this feature is not yet implemented in Node.js, npm needs an alternative
way to solve the problems stated earlier.

The goal is to provide an accurate dependency graph to Node.js while still
relying on Node.js current module resolution algorithm.

We deem it valuable to invest the time implementing `isolated-mode` now,
knowing that import-maps are coming, because most of the implementation
will be re-usable to implement an `import-maps-mode`.

There are already two competing solutions out there which implement an
`isolated-mode`: ([pnpm](https://pnpm.io) and [yarn](https://yarnpkg.com)).
We decided to choose the pnpm approach for the following reasons:

- _Works with current ecosystem_, the pnpm `isolated-mode` does not require
  any modification to Node.js or to the various build tools.
- _Battle tested_, Microsoft has successfully used pnpm to manage large
  monorepo for years.
- _Recommended by Node.js_, this approach is actually the recommended
  approach by [the Node.js
  documentation](https://nodejs.org/api/modules.html#modules_package_manager_tips).

# Implementation

The packages are laid out on disk with a flat structure in a folder called
the "package store". The dependencies between packages will be expressed by
creating symlinks between the various packages.

## How does it work?

This strategy is based on the fact that [Node.js module resolution
algorithm](https://nodejs.org/api/modules.html#modules_all_together)
follows symlinks and works with them exactly the same as if they were real
folders.

Additionally, once a module is resolved, the resolution algorithm calls
'realpath()' on the result. This means that the resolution algorithm always
returns a real path. This allows to setup an arbitrary complex dependency
graph while making sure Node.js does not create more than one instance of a
given module.

## Detailed Explanation

### Structure

In the workspaces:

- Each workspace has its own `node_modules` folder.
- Each `node_modules` folder contain symlinks.
- The symlinks in a `node_modules` folder correspond to the matching
  workspace's dependencies.
- Each symlink is given the same name as the dependency it represents.
- Each symlink points to a location in the package store where the
  corresponding package is installed.

In the package store:

- The package store is a folder stored in the root/project level
  `node_modules` folder.
- The package store is named `.npm`.
- The package store contains folders, one for each dependency installed.
  These dependencies can be direct workspace dependencies or transitive
  dependencies.
- These folders have a name containing the name of the package, its version
  and a hash of its content plus the hash of its resolved peer dependency
  set.
- These folders contain a `node_modules` folder.
- These `node_modules` folders contain multiple folders, one for each
  dependency of that package and one for the package itself.
- All these folders are named based on their respective package names.
- The folder representing the package itself contains the code of that
  package.
- The folders representation the dependencies of the package are symlinks
  to the corresponding package in the store.
- The dependencies of each packages are installed exactly the same way as
  workspaces' dependencies are installed.

This structure may seem more complicated than necessary. The reasons for
this complexity are:

- to make it possible for a package to import itself using its own name.
  For example, the following code `require.resolve("foo");` in
  `node_modules/.npm/foo@1.0.0-1234/node_modules/foo/bar.js` will correctly
  return `node_modules/.npm/foo@1.0.0-1234/node_modules/foo/index.js`.
- to prevent creating circular symlinks, even when packages have circular
  dependencies.

#### Peer dependencies

Peer dependencies are resolved by npm and treated as normal dependencies.

For instance, the following dependency graph,

```
 foo@1.0.0  ────┬─────> bar@2.0.0 ──( peer dependency )──> baz@^1.0.0
                │
                └─────> baz@1.3.0
```

will be converted to the following:

```
 foo@1.0.0  ────┬─────> bar@2.0.0 ────> baz@1.3.0
                │
                └─────> baz@1.3.0
```

### Edge cases

#### Peer dependency conflict

When a peerDependency can be resolved by more than one version, virtual
packages will be created, as many as they are versions resolving the peer
dependency. These virtual packages will be the same, with the difference
that their dependencies will be different and as a consequence their
hash-based name will be different.

For instance, the following dependency graph,

```
 cat@1.0.0  ────┬─────> baz@1.5.0
                │
                └─────>
                        bar@2.0.0 ──( peer dependency )──> baz@^1.0.0
                ┌─────>
                │
 foo@1.0.0  ────┴─────> baz@1.3.0
```

will be converted to the following:

```
 cat@1.0.0  ────┬─────> baz@1.5.0
                │
                └─────> bar@2.0.0 ────> baz@^1.5.0

                ┌─────> bar@2.0.0 ────> baz@^1.3.0
                │
 foo@1.0.0  ────┴─────> baz@1.3.0
```

#### Circular dependencies

Circular dependencies are supported.

Since the hash of a package contains its dependencies, circular
dependencies make the calculation of this hash more complicated. Here is
[an
article](https://www.fugue.co/blog/2016-05-18-cryptographic-hashes-and-dependency-cycles.html)
explaining how to hash a graph with cycles.

### Simple example

#### Dependency graph

```
  root
   ┬
   │
   ├───> foo (workspace)
   │      ┬
   │      │
   │      └───> A @ 1.0.0
   │              ┬
   │              │
   │              └───> B @ 1.0.0
   │
   ├───> bar (workspace)
   │      ┬
   │      │
   │      └───> A @ 1.0.0
   │              ┬
   │              │
   │              └───> B @ 1.0.0
   │
   └───> cat (workspace)
          ┬
          │
          └───> B @ 1.0.0
```

#### Installation on disk

```
  root /
   ┬
   │
   ├─> node_modules / .npm / ─┬─> A@1.0.0-21f95f7 / node_modules / ─┬─> A /  [content of package A]
   │                          │                                     │
   │                          │                                     └─> B ( symlink to ../../B@1.0.0-0d98566/node_modules/B )
   │                          │
   │                          └─> B@1.0.0-0d98566 / node_modules / B / ───> [content of package B]
   │
   └─> workspaces / ─┬─> foo / ─┬─> [content of workspace foo]
                     │          │
                     │          └─> node_modules / A ( symlink to ../../../node_modules/.npm/A@1.0.0-21f95f7/node_modules/A )
                     │
                     ├─> bar / ─┬─> [content of workspace bar]
                     │          │
                     │          └─> node_modules / A ( symlink to ../../../node_modules/.npm/A@1.0.0-21f95f7/node_modules/A )
                     │
                     └─> cat / ─┬─> [content of workspace cat]
                                │
                                └─> node_modules / B ( symlink to ../../../node_modules/.npm/B@1.0.0-0d98566/node_modules/B )
```

### More complex example: peer dependencies

#### Dependency graph

```
  root
   ┬
   │
   ├───> foo (workspace)
   │      ┬
   │      │
   │      ├───> A @ 1.0.0
   │      │       ┬
   │      │       │
   │      │       └───> B @ * (peer dependency)
   │      │
   │      └───> B @ 1.0.0
   │
   └───> bar (workspace)
          ┬
          │
          ├───> A @ 1.0.0
          │       ┬
          │       │
          │       └───> B @ * (peer dependency)
          │
          └───> B @ 2.0.0
```

#### Installation on disk

```
  root /
   ┬
   │
   ├─> node_modules / .npm / ─┬─> A@1.0.0+B@1.0.0-21f95f7 / node_modules / ─┬─> A [ content of package A ]
   │                          │                                             │
   │                          │                                             └─> B ( symlink to ../../B@1.0.0-0d98ab/node_modules/B )
   │                          │
   │                          ├─> A@1.0.0+B@2.0.0-66fe689 / node_modules / ─┬─> A  [ content of package A ]
   │                          │                                             │
   │                          │                                             └─> B ( symlink to ../../B@2.0.0-a2ea56/node_modules/B )
   │                          │
   │                          ├─> B@1.0.0-0d98ab / node_modules / B / ───> [ content of package B (v1) ]
   │                          │
   │                          └─> B@2.0.0-a2ea56 / node_modules / B / ───> [ content of package B (v2) ]
   │
   └─> workspaces / ─┬─> foo / ─┬─> [ content of workspace foo ]
                     │          │
                     │          └───> node_modules / ─┬─> A ( symlink to ../../../node_modules/.npm/A@1.0.0+B@1.0.0-21f95f7/node_modules/A )
                     │                                │
                     │                                └─> B ( symlink to ../../../node_modules/.npm/B@1.0.0-0d98ab/node_modules/B )
                     │
                     └─> bar / ─┬─> [ content of workspace bar ]
                                │
                                └───> node_modules / ─┬─> A ( symlink to ../../../node_modules/.npm/A@1.0.0+B@2.0.0-66fe689/node_modules/A )
                                                      │
                                                      └─> B ( symlink to ../../../node_modules/.npm/B@2.0.0-a2ia56/node_modules/B )
```

### Implementation Within `npm` and `@npmcli/arborist`

In order to support the design goals of (a) providing a project
`package-lock.json` file which is interoperable between `hosted-mode` and
`isolated-mode` projects, (b) allowing developers to freely switch between
modes, and (c) minimizing the changes in existing package dependency
contracts, the following implementation approach will be used when reifying
the package tree.

1. Create the `idealTree` as npm currently does for `hoisted-mode`, reading
   from the `package-lock.json`, applying user requests to add and remove
   packages, searching for updates, and so on.  That is, no changes to
   this step.  Thus any dependency graph which is unresolvable in
   hosted-mode will fail at this step, as it currently does, _even if
   isolated-mode could potentially satisfy it_.
2. Capture the `idealTree` lockfile metadata prior to any modifications to
   the tree.
3. If in `isolated-mode`, apply transforms to the tree to create a
   representation of the paths and symbolic links that will be reified to
   disk in isolated mode.
4. Calculate the diff between the `actualTree` and (transformed)
   `idealTree`, as we currently do.  (No change to this step.)
5. Reify the `node_modules` folder, making the requisite changes based on
   the calculated diff.
6. Save the (hoisted-mode) lockfile metadata captured in step (2) to the
   project lockfile.
7. Save the (isolated-mode) lockfile metadata to the hidden lockfile in
   `node_modules/.package-lock.json` (as this is a cache of the
   `actualTree` state for performance benefits when reading the actual tree
   on disk).

The specific transforms required to convert a hoisted-mode tree into an
isolated-mode tree will be determined during implementation. Early
investigation indicate that it is a relatively straightforward sprocess.

## Performance

Compared to the current npm installation strategy, this proposal reduces
package duplication, making the installation process faster. On a
prototype, this installation strategy brought down the install time from 6
to 2 minutes on a large monorepo of 500+ workspaces.

## Configuration

The `mode` can be enabled by a CLI option when running `npm install` or by
a setting in `.npmrc`.

## Compatibility

### Different versions of npm

The `isolated-mode` will use the same lockfile as `hoisted` mode.
Developers can use either mode without changing the lockfile. This makes
`isolated-mode` backward compatible and easy to implement. The
implementation of `isolated-mode` will reside in the reification, it will
take the ideal-tree and apply it on disk using symlink instead of hoisting.

### Projects not using workspaces

Non-workspace projects _will_ be able to use the `isolated-mode`
reification. This is useful as a library author, using `isolated-mode`
gives me the guarantee that my library will work as intended, without
unexpected run-time errors caused by undeclared dependencies.

## Prior Art and Alternatives

### [pnpm](https://github.com/pnpm/pnpm)

Package manager with a `isolated-mode`.  This RFC is mostly inspired by
pnpm.

### [ied](https://github.com/alexanderGugel/ied)

Package manager with a `isolated-mode`.  Similar to pnpm but unmaintained.

### [nix](https://nixos.wiki/wiki/Nix)

Functional package manager. Can work with npm packages (eg.
[node2nix](https://github.com/svanderburg/node2nix) or
[nixfromnpm](https://github.com/adnelson/nixfromnpm) )

### [yarn](https://yarnpkg.com/)

Package manager with a `isolated-mode` and project manager.

### [Import maps](https://github.com/WICG/import-maps)

Standard supported by [a few browsers](https://caniuse.com/import-maps) and
[deno](https://deno.land/) which makes it possible to implement
`isolated-mode`.

## Unresolved Questions and Bikeshedding

- **Should we use symlinks or junctions on Windows? Both of them have
  drawbacks**:
  - Junctions have to be representated by an absolute path, this means that
    junctions cannot be committed to git or packed into a package.
  - Symlinks can only be created in elevated shell [or when Windows is in
    "developer
    mode"](https://blogs.windows.com/windowsdeveloper/2016/12/02/symlinks-windows-10/#LCiVBWTgQF5s7fmL.97).
  - answer: junctions by default. support for symlinks can be added later
    as an opt-in if we see value for it.
- **How much community code will break when the system forbids access to
  undeclared dependencies? In other words, how much code needs to be fixed
  to work properly in `isolated-mode`**?
  - Regarding packages with missing dependencies in the `package.json`
    file. In many cases, package owners are willing to fix such issues. If
    there are a significant number of issues encountered around this, we
    can likely expect the of packages with missing dependencies is expected
    to drop fast after npm release `isolated-mode`. We may want to later
    add a feature to npm which allows users to locally declare dependencies
    on behalf of packages as a stop-gap, if existing solutions to this are
    not enough.
  - There are packages out there that depend on the way hoisting works as a
    feature. These packages can work in `isolated-mode` by simply adding
    whichever dependency is assumed to be hoisted as a dependency of the
    root's `package.json`.
  - Some dev-environments don't support symlinks.
    - AWS Lambdas -> a repository can a be installed with isolated mode
      locally and on CI but then deployed in hoisted mode.
    - React native -> There are plugins existing to make react-native work
      with symlinks
  - If a package is missing a dependency, it can be temporarily fixed
    (while waiting for the package owner to fix this issue, or if it’s
    working as designed) by declaring this missing dependency as top level
    dependency of the repository.
- **What should the opt-in option be for this mode?**
  - Something like `--install-mode=isolated`. This would allow us to add
    other modes (like an `import-map` mode) in a similar way.
- **Should the default hoisted mode be more aggressive with symlinks?**
  - @isaacs has considered it in the past, and may revisit this.
