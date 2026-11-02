# Topological Sort

## Summary

Add a pair of options for performing operations on workspaces in a configurable order.

## Motivation

Currently, workspaces that have large dependency graphs must maintain the ordering of the workspaces they specify in `package.json` manually. If dependencies within workspaces change, a maintainer has to perform a graph traversal of their dependency graph by inspecting the `package.json` of every package in the project, and record a correct order in the array provided to `workspaces`.

For example, consider a project with the following structure

```shell
example-project
├── package.json
└── workspaces
    ├── dependency
    ├── dependent
    └── transitive-dependency
```

Currently, we can add

```json
{
  "workspaces": [
    "workspaces/transitive-dependency",
    "workspaces/dependency",
    "workspaces/dependent"
  ]
}
```

to our `package.json` to run commands in the correct order. For simple examples, like ours above, keeping the list of workspaces in a correct order is not particularly difficult, but for projects with dozens or hundreds of workspaces, maintaining this list as dependencies within the workspace can become onerous.

The use case that this feature is most important for is when you host a workspace inside your project that exports assets which are used when running scripts for other workspaces in the same project. One such case this would be useful for is having a compiled workspace that contains scripts for reuse across multiple workspaces, or export a compiled client (for example for contacting a third-party api) for shared use in your web, mobile, and command-line applications. Similarly, in strongly-typed systems, the types exported from a dependency are required when type-checking the dependent. In all cases, you would want to ensure that the dependency has the appropriate script (to generate types or to output compiled code) is called before its dependent.

## Detailed Explanation

We add a pair of command-line arguments to the npm cli, and a new top-level key to package.json, which enables configuring the sort of workspaces when performing operations on the full dependency graph.

A fully configured package.json might be configured as follows

```json
{
  "workspaces": [
    "workspaces/transitive-dependency",
    "workspaces/dependency",
    "workspaces/dependent"
  ],
  "workspaces-sort": {
    "algorithm": "topological-parallel",
    "include": [
      "dependencies",
      "bundleDependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies"
    ]
  }
}
```

Where the following keys are allowed

- `algorithm` -- one of "topological" or "linear"
- `includes` -- a list of the keys listed in package.json to consult when calculating the sort order

In the cli, we would introduce two corresponding options

```shell
npm run test --workspaces --workspaces-sort-algorithm=topological-parallel --workspaces-sort-include=dev,bundle,optional,peer
```

The `workspaces-sort-algorithm` would allow the following options

- linear -- runs commands on workspaces in the order specified in package.json. This is the current behavior.
- topological-serial -- runs commands on workspaces specified in topological order, one at a time.
- topological-parallel -- runs commands on workspaces specified in topological order. When possible, commands are executed simultaneously on multiple workspaces.

We propose that this option be introduced initially in a minor version of npm, with the default value set to `linear`, but that in a subsequent major version, the default value be changed to `topological-parallel`, to match the

The `workspaces-sort-include` would take a list of top-level `package.json` fields that contain lists of dependencies to use when calculating the command execution order. Must be one of the well-known dependency closures supported by the npm client: `dependencies`, `bundleDependencies`, `devDependencies`,`optionalDependencies`, `peerDependencies`.

## Rationale and Alternatives

### Rationale

We find that this solution has a number of strengths to recommend it.

#### Can be release in stages

This design allows us to ship these options piecemeal. For instance, the `topological-serial` algorithm can be added before the `topological-parallel` algorithm, so that we don't have to solve parallelism before we can release a solution that unblocks globs and reduces the amount of time maintainers spend ordering their `workspaces` arrays. Similarly, we could ship without the `includes` array, and instead always include the `devDependencies` and `dependencies`, or just the `dependencies`, when calculating the dependency graph when we add topological sorting.

#### Can be released in a minor version

This design is strictly additive, introducing new keys and options without changing existing configuration in `package.json` or existing cli options.

### Alternatives

We considered two alternatives when preparing this RFC.

#### Provide a `graph` command for updating package.json

We add a new top-level npm command that makes it easier to update the workspaces list to match the intended order of script execution.

A maintainer would run the command at the root of the project

```shell
npm graph
```

Which would output a valid ordering of workspaces for the maintainer to copy-paste into package.json

```shell
$ npm graph
{
  "workspaces": [ "workspaces/transitive-dependency", "workspaces/dependency", "workspaces/dependent" ]
}
```

To make it easier to use, we could also add a flag that updates the `package.json` for the maintainer

```shell
npm graph --update-package-json
```

This alternative, however, requires regular human intervention to maintain correctness in a large project, so we are not recommending this solution.

#### Provide a `pipeline` key in package.json

In Nx and Turborepo, there is a key called `pipeline`, which allows the expression of arbitrary relationships between script dependencies. This is particularly useful for when you have one script that uses a compiled tool that is hosted within a monorepo. For instance, if you ship an eslint plugin written in Typescript, and you would like to compile the eslint plugin before linting the other workspaces in your workspace, you could express a relationship between the `lint` script of dependent workspaces and the `build` script of the dependencies, so that before the `lint` script is executed for the workspaces being linted, the `build` script is executed on the eslint plugin.

While such a feature might be useful for ordering script execution in npm, it requires much more design and implementation efforts than the other alternatives, and as such we are not recommending this solution.

## Implementation

The first step in the implementation would be to update the [`workspacePaths` as defined in `BaseCommand`](https://github.com/npm/cli/blob/b1c3256d62250b5dca113dd99bf1bd99f2500318/lib/base-command.js#L162) to be an array of arrays, rather than an array of strings. For example, in our simple example, `workspacePaths` would be

```javascript
[["transitive-dependency"], ["dependency"], ["dependent"]];
```

regardless of the settings in the `workspaces-sort` configuration. However, for topological-parallel, some child arrays may have multiple entries, representing a "batch" of packages that can be operated on in parallel.

```javascript
[
  ["workspace-a"],
  ["workspace-b1", "workspace-b2", "workspace-b3"],
  ["workspace-c"],
];
```

Next will be to find all places that we access `workspacePaths`, and change it to operate in batches. While this does introduce considerable complexity to call sites, it does not require checking the `workspace-sort-algorithm`, since all existing algorithms can be represented with a two-dimensional array with appropriate batching.

For instance, we will change the implementation of [`run-script.js`](https://github.com/npm/cli/blob/b1c3256d62250b5dca113dd99bf1bd99f2500318/lib/commands/run-script.js#L200) to operate on batches of workspaces in parallel

```javascript
for (const workspacePathBatch of this.workspacePaths) {
  await Promise.all(
    workspacePathBatch.map(async (workspacePath) => {
      const { content: pkg } = await pkgJson.normalize(workspacePath);
      const runResult = await this.run(args, {
        path: workspacePath,
        pkg,
      });

      // etc.
    })
  );
}
```

[A repository search](https://github.com/search?q=repo%3Anpm%2Fcli%20this.workspacePaths&type=code) shows 9 such places that would have to be modified.

## Prior Art

Something similar was suggested in [a github issue](https://github.com/npm/feedback/discussions/579) in the npm feedback repository.

Yarn provides a pair of options, [`-t,--topological` and `--topological-dev`](https://yarnpkg.com/cli/workspaces/foreach/#options-t%2C-topological).

Lerna provides a pair of options, [`--sort` and `--no-sort`](https://lerna.js.org/docs/lerna6-obsolete-options#--sort-and---no-sort).

Pnpm does topological sorting by default, and provides a [`--parallel`](https://pnpm.io/cli/run#--parallel) option to disable the topological sorting.

Turborepo does [topological sorting by default](https://turbo.build/repo/docs/core-concepts/monorepos/running-tasks#defining-a-pipeline).

Nx does [topological sorting by default](https://nx.dev/core-features/run-tasks#run-tasks-for-multiple-projects).

## Unresolved Questions and Bikeshedding

### Changing the shape of `workspaces` in package.json

We could also consider changing the shape of the value associated with the `workspaces` key of package.json.

```json
{
  "workspaces": {
    "sort": "linear",
    "workspaces": [
      "workspaces/transitive-dependency",
      "workspaces/dependency",
      "workspaces/dependent"
    ]
  }
}
```

This solution might, in particular, make sense if this was shipped in conjunction with support for globs in the `workspaces` key

```json
{
  "workspaces": "workspaces/*"
}
```

This might even be considered a pre-requisite to allowing globs, since npm cannot guarantee build correctness if we to execute scripts in the order returned by our glob implementation.

Which, in turn, might further enable a boolean option to accept the defaults for the all of the keys in the configuration object associated with the `workspaces` key

```json
{
  "workspaces": true
}
```

Where

Making the `workspaces` key support string and boolean values is, strictly-speaking, out-of-scope for this rfc, but might provide some argument in favor of allowing `workspaces` to be associated with types other than array.

### Support multiple sorts in package.json

It may be the case that different scripts require different sorts. For instance, it may be that different commands, like `publish` and `run`, have different requirements -- you might want to publish your workspaces in a linear order, but run your scripts in topological order, for instance. Similarly, it might be that different `scripts` that can be run might include different kinds of dependencies when calculating the dependency closure for graph traversal when using the topological sort algorithm. If such use cases do turn out to exist within the user base, we could consider adding a `commands` key to the `workspaces-sort` configuration option, and accept an array of sorts. A fully configured sort array might be configured as follows in package.json

```json
{
  "workspaces": [
    "workspaces/transitive-dependency",
    "workspaces/dependency",
    "workspaces/dependent"
  ],
  "workspaces-sort": [
    {
      "algorithm": "linear",
      "command": "publish"
    },
    {
      "algorithm": "topological-serial",
      "command": ["run lint", "test"]
    },
    {
      "algorithm": "topological-parallel",
      "command": "*"
    }
  ]
}
```

Where the first sort that matches pattern(s) in the `command` array is used when a npm cli command is executed. Adding this key to package.json does not change the npm cli options, as the command is already provided.

### Adding a separate option for parallel execution

We could consider making the choice between parallel execution and serial execution into a separate option, configured alongside the `algorithm` and `includes` keys

```json
{
  "workspaces-sort": {
    "algorithm": "topological",
    "parallel": true
  }
}
```

This also expands the cli command quite a bit. This is particularly important _if_ it turns out that different scripts might require different sorts, and we _also_ decide not to add a `scripts` or `commands` option to package.json.

```shell
npm run compile --workspaces --workspaces-sort-algorithm=topological --workspaces-sort-parallel=true --workspaces-sort-includes=dev,bundle
```

Note that adding this requires the implementation of parallelism for all sort algorithms, which is not required otherwise.

### Change the default value for `includes`

We have proposed that all kinds of dependencies be included in the closure when calculating sort order, but there are a couple of other default values that might also make sense, namely limiting it to only `dependencies` or to both `dependencies` and `devDependencies`.

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
