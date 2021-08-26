# Pure mode

## Summary

This RFC is a proposal to add a new opt-in installation mode.

This mode would be the missing ingredient to make workspaces truly scalable.

## Motivation

The introduction of workspaces in npm v7 brought the ability to split large codebases into smaller pieces of code with declared dependencies between them.

Several build tools took advantage of these declared dependencies to split the builds into multiple steps (one per workspace) which could be cached or run in parallel. This caching and parallelism usually improves significantly build performance.

The current default installation strategy does not properly communicates to Node.js the information about the dependency graph. Node.js having an inaccurate view of the dependency graph leads the build systems to wrongly skip build operations, leading to risk of bugs slipping through.

The installation mode proposed by this RFC would communicate accurately to Node.js the dependency graph, allowing build tools to correctly reason about it.

## Naming

The proposed name for this mode is `pure-mode`, meaning "pure" as in "no side effects". This name comes from the parallel with functional programming; in functional programming, functions are called `pure` because they don't have side effects. In `pure-mode`, workspaces can be seen as pure function:

- The output/behavior of a workspace is fully determined by the inputs (code in the workspace and declared dependencies).
- A workspace output/behavior only affects other workspaces which have a declared dependency to it.

To make the discussions more efficient, we could also name the current default installation mode of npm. We will call this mode `hoisted-mode` as packages are shared across workspaces by hoisting them to the root of the project.

## More on the problem

Packages and workspaces declare their dependencies to npm by using special fields in their `package.json`. The Node.js runtime is unaware of these special fields, instead it uses a [module resolution algorithm](https://nodejs.org/api/modules.html) to determine the meaning of a module importing another module. npm bridges this gap by converting the declared dependency graph into a folder structure which makes sense to Node.js. This operation is call `reification`.

When converting the dependency graph to a folder structure, `hoisted-mode` loses information. Multiple different dependency graphs can be converted to an identical folder structure. Since the folder structure is all that Node.js uses to resolve modules, Node.js misses some information about dependencies. This loss of information is most frequently visible through the fact that workspaces are able to successfully import the dependencies declared by other workspaces.

### Forgetting to declare dependencies

When workspaces can successfully use code of a package without having a dependency on it, people forget to declare their dependencies. This lead to situations where updating the dependencies of one workspace breaks a seemingly unrelated workspace.

It is worth noting that static code analysis tools can help significantly reduce the frequency of these mistakes.

### Duplication

The `hoisted-mode` is not always successful at sharing common dependencies. Conflicts in versions lead to packages being installed multiple times on disk. These conflicts become more frequent when the project scales. The frequency of these conflicts can be reduced by an effort to align dependencies' versions across the project.

These duplications come with the following cost:

- Performance degradation of the installation phase
- Inneficient disk usage
- Performance and memory cost at runtime as Node.js sees duplicated modules as two different modules.

### Tools crawling the node_modules folders

Certain tools implement their own module resolution algorithm instead of the one provided by Node.js. One of the motivation for a tool to implement its own resolution algorithm is that it can add more features to it.

Crawling the `node_modules` folder is such a feature used by certain build tools. This feature means that the mere presence of a package in a `node_modules` folder will have an impact on the output of a workspace. This means that any modification of a project's `node_modules` folder is possibly a breaking change to every workspaces in this project, regardless of the dependency graph.

For example, the TypeScript compiler by default includes to its compilation _every_ package in the folder `node_modules/@types` without any explicit import statement needed.

## Rationale

The [import-maps](https://github.com/WICG/import-maps) standard is a very good tool to communicate the dependency graph to Node.js. But because this standard is not yet implemented in Node.js, npm needs an alternative way to solve the problems stated earlier.

The goal is to provide an accurate dependency graph to Node.js while still relying on Node.js current module resolution algorithm.

We deem valuable to invest the time implementing the `pure-mode` now knowing that import-maps are coming because most of the implementation will be re-usable to implement a `import-maps-mode`.

There are already two competing solutions out there which implement a `pure-mode` ([pnpm](https://pnpm.io) and [yarn](https://yarnpkg.com)). We decided to choose the pnpm approach for the following reasons:

- _Works with current ecosystem_, the pnpm `pure-mode` does not require any modification to Node.js or to the various build tools.
- _Battle tested_, Microsoft has successfully used pnpm to manage large monorepo for years.
- _Recommended by Node.js_, this approach is actually the recommended approach by [the Node.js documentation](https://nodejs.org/api/modules.html#modules_addenda_package_manager_tips).

# Implementation

## Simple Explanation

The packages are laid out on disk with a flat structure in a folder called the "package store". The dependencies between packages will be expressed by creating symlinks between the various packages.

## How does it work?

This strategy is based on the fact that [Node.js module resolution algorithm](https://nodejs.org/api/modules.html#modules_all_together) follows symlinks and works with them exactly the same as if they were real folders.

Additionally, once a module is resolved, the resolution algorithm calls 'realpath()' on the result. This means that the resolution algorithm always returns a real path. This allows to setup an arbitrary complex dependency graph while making sure Node.js does not create more than one instance of a given module.

## Detailed Explanation

### Structure

In the workspaces:

- Each workspace has its own `node_modules` folder.
- Each `node_modules` folder contain symlinks.
- The symlinks in a `node_modules` folder correspond to the matching workspace's dependencies.
- Each symlink is given the same name as the dependency it represents.
- Each symlink points to a location in the package store where the corresponding package is installed.

In the package store:

- The package store is a folder stored in the root/project level `node_modules` folder.
- The package store is named `.npm`.
- The package store contains folders, one for each dependency installed. These dependencies can be direct workspace dependencies or transitive dependencies.
- These folders have a name containing the name of the package, its version and a hash of its content plus the hash of its dependencies.
- These folders contain a `node_modules` folder.
- These `node_modules` folders contain multiple folders, one for each dependency of that package and one for the package itself.
- All these folders are named based on their respective package names.
- The folder representing the package itself contains the code of that package. 
- The folders representation the dependencies of the package are symlinks to the corresponding package in the store.
- The dependencies of each packages are installed exactly the same way as workspaces' dependencies are installed.

This structure may seem more complicated than necessary. The reasons for this complexity are:

- to make it possible for a package to import itself using its own name. For example, the following code `require.resolve("foo");` in `node_modules/.npm/foo@1.0.0-1234/node_modules/foo/bar.js` will correctly return `node_modules/.npm/foo@1.0.0-1234/node_modules/foo/index.js`.
- to prevent creating circular symlinks, even when packages have circular dependencies.

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

When a peerDependency can be resolved by more than one version, virtual packages will be created, as many as they are versions resolving the peer dependency. These virtual packages will be the same, with the difference that their dependencies will be different and as a consequence their hash-based name will be different.

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

Since the hash of a package contain its dependencies, circular dependencies make the calculation of this hash more complicated. Here is [an article](https://www.fugue.co/blog/2016-05-18-cryptographic-hashes-and-dependency-cycles.html) explaining how to hash a graph with cycles.

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
                     │                                └─> B ( synlink to ../../../node_modules/.npm/B@1.0.0-0d98ab/node_modules/B )
                     │
                     └─> bar / ─┬─> [ content of workspace bar ]
                                │
                                └───> node_modules / ─┬─> A ( symlink to ../../../node_modules/.npm/A@1.0.0+B@2.0.0-66fe689/node_modules/A )
                                                      │
                                                      └─> B ( synlink to ../../../node_modules/.npm/B@2.0.0-a2ia56/node_modules/B )

```

## Performance

Compared to the current npm installation strategy, this proposal reduces package duplication, making the installation process faster. On a prototype, this installation strategy brought down the install time from 6 to 2 minutes on a large monorepo of 500+ workspaces.

## Configuration

The `pure-mode` is a project level setting, it does not make much sense to install some dependencies in `pure-mode` and others in `hoisted-mode`. For this reason, to configure a project in `pure-mode`, a setting has to be added to the `.npmrc` of the project and the lockfile has to be re-generated. A tool may be made available to convert `hoisted-mode` lockfiles to `pure-mode` lockfiles.

## Compatibility

### Different versions of npm

As workspaces are supported only from npm version 7, there is no concern about making `pure-mode` compatible with versions olders than 7.0.0. 

The tree structure will be serialized to the lockfile in a way that any version of npm 7.0.0 can understand. This means that any version of npm 7 will be able to install a project configured in `pure-mode`.

Modifying a dependency in a `pure-mode` project with a version of npm not supporting `pure-mode` is likely going to leave the project in a broken state and should be avoided.

When using `pure-mode` it will be recommended to properly configure the `engines` field of the `package.json` to make sure developers who want to modify the dependencies don't shoot themselves in the foot and put the project in an instable state.

### Projects not using workspaces

Non-workspace projects _will_ be able to use the `pure-mode` reification. This is useful as a library author, using `pure-mode` gives me the guarantee that my library will work as intended when consumed by projects which use `pure-mode`.

## Prior Art and Alternatives

### [pnpm](https://github.com/pnpm/pnpm)

Package manager with a `pure-mode`.
This RFC is mostly inspired by pnpm.

### [ied](https://github.com/alexanderGugel/ied)

Package manager with a `pure-mode`.
Similar to pnpm but unmaintained.

### [nix](https://nixos.wiki/wiki/Nix)

Functional package manager. Can work with npm packages (eg. [node2nix](https://github.com/svanderburg/node2nix) or [nixfromnpm](https://github.com/adnelson/nixfromnpm) )

### [yarn](https://yarnpkg.com/)

Package manager with a `pure-mode` and project manager.

### [Import maps](https://github.com/WICG/import-maps)

Standard supported by [a few browsers](https://caniuse.com/import-maps) and [deno](https://deno.land/) which makes it possible to implement `pure-mode`.

## Unresolved Questions and Bikeshedding

- Should we use symlinks or junctions on Windows? Both of them have drawbacks:

  - Junctions have to be representated by an absolute path, this means that junctions cannot be committed to git or packed into a package.
  - Symlinks can only be created in elevated shell [or when Windows is in "developer mode"](https://blogs.windows.com/windowsdeveloper/2016/12/02/symlinks-windows-10/#LCiVBWTgQF5s7fmL.97).

  - answer: junctions by default and symlinks as opt-in

- How much community code will break when the system forbids access to undeclared dependencies? In other words, how much code needs to be fixed to work properly in pure mode?
