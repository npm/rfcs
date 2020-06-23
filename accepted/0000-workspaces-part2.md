# npm workspaces: Running commands

## Summary

Introduces basic support to running **npm commands** across nested **workspaces**.

## Motivation

The need for running **npm commands** across nested **workspaces** was sourced from the community during the ellaboration of the [original **npm workspaces** RFC](https://github.com/npm/rfcs/pull/103).

## Detailed Explanation

Following up from the original **npm workspaces** RFC are the following command-related changes:

- A subset of the standard **npm commands** needs to be made aware of **npm workspaces**
- It's desired to have a standard way to filter out **workspaces** in which to run specific **npm commands**

## Rationale and Alternatives

The ability to run **npm commands** across defined **workspaces** is essential to successfully manage a **npm workspaces** workflow. That makes the following alternatives much less desireable:

- Do not implement further support to manage running commands across **workspaces**
- Implement only _some_ of the implementation changes described in this document

**Note:** Alternative ways of executing each of the described features are defined along with their implementation details below.

## Implementation

### 1. Run commands across all child packages

Make **npm cli** subcommands **npm workspaces**-aware, so that running a command tries to run it within all **workspaces** as long as a **workspaces configuration** field is properly defined in `package.json`.

Only a subset of commands are to be supported:

- `fund` List funding info for all **workspaces**
- `ls` List all packages including **workspaces**
- `outdated` List outdated **dependencies** including **workspaces** and its **dependencies**
- `run-script` Run arbitrary **scripts** in all **workspaces**, skip any **workspace** that does not have a targetting **script**
- `rebuild` Rebuild all **workspaces**
- `restart`
- `start`
- `stop`
- `test` Run test **scripts** in all **workspaces**
- `update` Updates a **dependency** across the entire installation tree, including **workspaces**
- `view` View registry info, also including **workspaces**

#### Test example:

```
├── package.json { "name": "foo", "workspaces": ["dep-a", "dep-b"] }
├── dep-a
│   └── package.json { "version": "1.0.0" }
└── dep-b
    └── package.json { "version": "1.3.1" }

$ npm test

> foo@1.0.0 test /Users/username/foo
> echo "Error: no test specified" && exit 1

Error: no test specified
npm ERR! Test failed.  See above for more details.

> dep-a@1.0.0 test /Users/username/foo/dep-a
> done

> dep-b@1.3.1 test /Users/username/foo/dep-b
> done
```

**NOTE:** `publish` and `version` are very special cases in a **npm workspaces** setup and are outside of the scope of this RFC. These features will live in userland in the form of popular modules such as [Lerna](https://lerna.js.org/) for the foreseeable future.

### 2. Filter a subset of workspaces

Filter is done via positional argument and here are some of the reasons why we decided to go that route:
- [Lerna filters](https://www.npmjs.com/package/@lerna/filter-options) were the starting point but early in the discussion some other considerations were brought forward
- npm configs have some baggage, configs might apply to the larger behavior of the cli or to a specific subcommand and they're all mixed together
- defining a subset of workspaces in a `.npmrc` file might be just a footgun leading users into confusion
- Yarn v1 uses positional arguments for filter in the form of `yarn workspace <workspace_name> <cmd>`, so there's precedent

Leading this RFC to a proposal using positional arguments. Rather than defining a strict UX, the current proposal is to adhere to a `workspace` command prefix in the form of either: `npm workspace <workspace_name> <command>` OR `npm ws <workspace_name> <command>` OR an even shorter shortcut using a symbol `npm :<workspace_name> <command>`, for example running `test` in a specific **workspace** named `foo` with these different ideas:

- `npm workspace foo test`
- `npm ws foo test`
- `npm :foo test`

Leaving space to gather feedback from the community on whether to introduce one of this proposed commands or even introducing some novel interface.

#### Install dependency example:

Add `tap` as a **dependency** of a **workspace** named `foo`:

```sh
npm workspace foo install tap
npm ws foo install tap
npm :foo install tap
```

Note: **Globs** are not supported as a _subset/filter_ argument, the alternative is to use `npm workspace <alias> <cmd>` in which the `alias` can be defined beforehand in your **workspace** configuration as detailed in the next section.

### 3. Grouping/Aliasing workspaces

One proposed feature that was surfaced during our brainstorm sessions is the ability for users to create arbitrary groups of **workspaces** defined via **workspaces configuration**, e.g:

Given a **npm workspace** setup with the following file structure:

```
/root
├── core
│   ├── foo
│   ├── bar
│   └── util
└── plugins
    ├── helpers
    ├── lorem
    └── ipsum
```

It's possible to define a **groups** property within your **workspaces configuration** that will allow defining named sets of **workspaces** that can be later on used to run commands, e.g:

```
{
    "name": "workspace-example",
    "version": "1.0.0",
    "workspaces": {
        "groups": {
            "core": ["core/*"], // accepts globs
            "plugins": ["lorem", "ipsum"], // also accepts workspaces names
            "common": ["util", "helpers"]
        },
        "packages": [
            "core/*",
            "plugins/*"
        ]
    }
}
```

Following up with the previous configuration example, it would be possible to run tests across all **workspaces** from the `plugins` group, as following:

```
// one of these:
$ npm workspace plugins test
$ npm ws plugins test
$ npm :plugins test

> lorem@1.0.0 test /root/plugins/lorem
> done

> ipsum@1.0.0 test /root/plugins/ipsum
> done
```

Further example, install a **peer dependency** across a group of packages named `core`:

```
$ npm workspace core install react@16 --save-peer
$ npm ws core install react@16 --save-peer
$ npm :core install react@16 --save-peer
```

It should also be possible to define groups as cli arguments, so that the following example will be equivalent to the previous examples:

```
$ npm workspace core install react@16 --save-peer --workspace-group core=core/*
```

## Prior Art

#### Previously

- [npm workspaces](https://github.com/npm/rfcs/blob/de8d71c0453f5cf443d3ef2f47e313f12dd6aaf9/accepted/0000-workspaces.md)

#### Filtering a subset of workspaces

- [lerna filter-options](https://www.npmjs.com/package/@lerna/filter-options)
- [Yarn v1 workspace](https://classic.yarnpkg.com/en/docs/cli/workspace)
- [Yarn v2 foreach include/exclude](https://yarnpkg.com/cli/workspaces/foreach)
- [pnpm recursive --filter](https://pnpm.js.org/en/cli/recursive#filter-lt-package_selector)

## Dictionary

During the discussions around this RFC it was brought up to our attention that a lot of the vocabulary surrounding what the larger JavaScript community understands as "workspaces" can be confusing, for the sake of keeping the discussion as productive as possible we're taking the extra step of documenting what each of the terms used here means:

- **npm cli**: The [npm cli](https://github.com/npm/cli/) :wink:
- **npm commands**: The set of **npm cli** [commands](https://docs.npmjs.com/cli-documentation/)
- **npm workspaces**: The feature name, meaning the ability to the **npm cli** to support a better workflow for working with multiple packages.
- **workspaces**: A set of **workspace**s.
- **workspace**: A nested package within the **Top-level workspace** file system that is explicitly defined as such via **workspaces configuration**.
- **Top-level workspace**: The root level package that contains a **workspaces configuration** defining **workspaces**.
- **workspaces configuration**: The blob of json configuration defined within `package.json` that declares where to find **workspaces** for this **Top-level workspace** package.
- **dependency**: A package that is depended upon by another given package.
- **[peer dependency](https://docs.npmjs.com/files/package.json#peerdependencies)**: A special **dependency** relationship between packages.
- **dependent**: A package which depends on another given package.
- **symlink**: A [symbolic link](https://en.wikipedia.org/wiki/Symbolic_link) between files.
- **[globs](https://en.wikipedia.org/wiki/Glob_(programming))**: String patterns that specifies sets of filenames with special characters.
- **[Arborist](https://github.com/npm/arborist)**: The npm@7 install library
- **hoisting packages**: Bringing packages up a level in the context of an installation tree.

## Unresolved Questions and Bikeshedding

- Filter syntax:
    - `npm workspace foo test`
    - `npm ws foo test`
    - `npm :foo test`
    - `npm --workspace=foo test`
    - `npm -w=foo test`
- Groups as a cli argument: `--workspace-group`
    - how to define the `key=value` nature of it?
    - is there any arg currently in the cli using key/value pairs?
    - maybe it's not worth having it?
