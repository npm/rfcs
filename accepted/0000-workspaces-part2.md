# npm workspaces: Running commands

## Summary

Introduces basic support to running **npm commands** across nested **workspaces**.

## Motivation

The need for running **npm commands** across nested **workspaces** was sourced from the community during the elaboration of the [original **npm workspaces** RFC](https://github.com/npm/rfcs/pull/103).

## Detailed Explanation

Following up from the original **npm workspaces** RFC are the following command-related changes:

- A subset of the standard **npm commands** needs to be made aware of **npm workspaces**
- It's desired to have a standard way to filter out **workspaces** in which to run specific **npm commands**

## Rationale and Alternatives

The ability to run **npm commands** across defined **workspaces** is essential to successfully manage a **npm workspaces** workflow.

Following are possible alternatives to provide this functionality:

- Do not implement further support to manage running commands across **workspaces**, keep the **npm workspaces** set of features to a minimum
- Defer to other tools from the ecosystem such as Lerna to solve the problem of running top-level commands across **workspaces**
- Implement the proposed features of this RFC as a standalone package / separated tool from the **npm cli**

## Implementation

### 1. Run commands across all child packages

Create a new **npm cli** subcommand named **workspaces** (aliased to **ws**) that can route any of the supported subcommands to run in the context of the configured **workspaces** as long as a **workspaces configuration** field is properly defined in `package.

We identified 5 different categories of subcommands based on how they're expected to work:

#### 1. Commands that just need context from package.json

Commands that, from an user point of view, are the equivalent of: `cd <workspace-name> && npm <cmd>`.

- `docs`
- `doctor`
- `diff` Package diff in the context of specific **workspaces**
- `dist-tag` List dist-tags for specific **workspaces**
- `pack` Run pack in the context of specific **workspaces**
- `publish` Run publish in the context of specific **workspaces**
- `repo`
- `set-script`
- `unpublish`
- `view` View registry info, also including **workspaces**

#### 2. Custom implementation

##### 2.1. Reads from installed dependency tree

General class of helper commands that load from the installed tree to produce some form of useful output.

- `audit`
- `explain`
- `fund` List funding info for all **workspaces**
- `ls` List all packages including **workspaces**
- `outdated` List outdated **dependencies** including **workspaces** and its **dependencies**

##### 2.2. Modify installed dependency tree

The set of commands that will modify an install tree (from an implementer point of view, these are just [arborist.reify](https://github.com/npm/arborist/) proxies).

- `ci`
- `dedupe|find-dupes`
- `install-ci-test`
- `install-test`
- `install`
- `link`
- `rebuild` Rebuild all **workspaces**
- `update` Updates a **dependency** across the entire installation tree, including **workspaces**
- `uninstall`
- `update`

##### 2.3. Other

A command that needs a special/custom workspace-aware implementation outside of the context of reading/writing to the install tree (using **Arborist**).

- `exec` Run exec in the context of specific **workspaces**
- `init` Initialize a new **workspace**
- `run-script|restart|start|stop|test` Run arbitrary **scripts** in all **workspaces**, skip any **workspace** that does not have a targetting **script**
- `version` Run version in the context of specific **workspaces**, needs tweaked commit msg, tag

#### 3. Unsupported

This category of **npm cli** subcommand is completely unrelated to anything that the current working directory could affect. All registry helper/management types of commands fall into this category and it's a best UX to just exit with an error code in order to let the end user aware that trying to run these in the context of workspaces don't have any effect.

- `adduser|login`
- `bin`
- `birthday`
- `cache`
- `completion`
- `config|get|set`
- `deprecate`
- `edit`
- `explore`
- `help`
- `help-search`
- `hook`
- `logout`
- `org`
- `owner`
- `ping`
- `prefix`
- `profile`
- `search`
- `shrinkwrap`
- `star`
- `team`
- `token`
- `unstar`
- `whoami`
- `workspaces`

#### Example:

Running tests across all configured **workspaces**:

```
├── package.json { "name": "foo", "workspaces": ["dep-a", "dep-b"] }
├── dep-a
│   └── package.json { "version": "1.0.0" }
└── dep-b
    └── package.json { "version": "1.3.1" }

$ npm ws test

> foo@1.0.0 test /Users/username/foo
> echo "Error: no test specified" && exit 1

Error: no test specified
npm ERR! Test failed.  See above for more details.

> dep-a@1.0.0 test /Users/username/foo/dep-a
> done

> dep-b@1.3.1 test /Users/username/foo/dep-b
> done
```

### 2. Filter a subset of workspaces

Filter is done via named argument (`--workspace`, short: `-w`) and here are some of the reasons why we decided to go that route:
- [Lerna filters](https://www.npmjs.com/package/@lerna/filter-options) were the starting point but early in the discussion some other considerations were brought forward, specially the many pitfalls of supporting globs in the variety of supported shells and operational systems.
- npm configs do have some baggage, configs might apply to to other cli commands and can also possibly be defined project or system-wide so the most sure way to avoid these pitfalls is for configs to only be used in the context of a single **npm cli** subcommand.

### 3. Examples

Given the results of all this preliminar work, the preferred way to run a command in the context of a single workspace is to use the named `--workspace` argument or its `-w` short alias, e.g:

In a project with the following structure:
```
./
├── package.json { "name": "root", "workspaces": ["packages/foo", "packages/bar"] }
└── packages/
    ├── foo/
    │   └── package.json { "name": "foo", "version": "1.0.0" }
    └── bar/
        └── package.json { "name": "foo", "version": "1.0.0" }
```

You can run tests for the `foo` workspace from the root of your project, with the following syntax:

```
npm ws test --workspace=foo
```


#### Install dependency example:

Add `tap` as a **dependency** of all your configured **workspaces**:

```sh
npm ws install tap
```


Note: **Globs** are not supported as a valid `--workspace` argument value, the proposed alternative is to use `npm ws <cmd> --workspace=<dir>` in which `<dir>` is a folder containing multiple workspaces.

## Prior Art

#### Previously

- [npm workspaces](https://github.com/npm/rfcs/blob/de8d71c0453f5cf443d3ef2f47e313f12dd6aaf9/accepted/0000-workspaces.md)

#### Filtering a subset of workspaces

- [lerna filter-options](https://www.npmjs.com/package/@lerna/filter-options)
- [Yarn v1 workspace cmd](https://classic.yarnpkg.com/en/docs/cli/workspace)
- [Yarn v1 workspaces cmd](https://classic.yarnpkg.com/en/docs/cli/workspaces)
- [Yarn v2 foreach include/exclude](https://yarnpkg.com/cli/workspaces/foreach)
- [pnpm Filtering](https://pnpm.js.org/en/filtering)

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
