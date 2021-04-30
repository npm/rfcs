# npm Workspaces: Running commands

## Summary

Introduces basic support for running **npm commands** across a project's **workspaces**.

## Motivation

The need for running **npm commands** across a project's **workspaces** was surfaced by the community during the discourse spun out of the [initial **npm workspaces** RFC](https://github.com/npm/rfcs/pull/103).

## Detailed Explanation

Following up on the original **npm workspaces** RFC are the following command-related additions/changes:

- A subset of the standard **npm commands** need to be made aware of **npm workspaces**
- It's desired to have a standard way to filter out **workspaces** in which to run specific **npm commands**

## Rationale and Alternatives

The ability to run **npm commands** across a project's **workspaces** is essential to effecient management of, & enabling, complex developer workflows.

The following are possible alternatives to unlock this functionality:

- Do not implement further support to manage running commands across **workspaces**, keep the **npm workspaces** set of features to a minimum
- Defer to other tools from the ecosystem - such as **Lerna** - to solve the problem of running top-level commands across **workspaces**
- Implement the proposed features of this RFC as a standalone package apart from the **npm cli**

## Implementation

### 1. Run commands across all child workspaces

Create a new **npm cli** config, `--workspaces` (aliased to `--ws`), that can route any of the supported subcommands to run in the context of the configured **workspaces** as long as a **workspaces configuration** field is properly defined in `package.json`

There are currently five distinct categories of _"workspace-awareness"_ that existing subcommands will belong to:

#### 1. Commands that _just_ need context from `package.json`

Commands that, from a user's point of view, are the equivalent of: `cd <workspace-name> && npm <cmd>`.

- `docs`
- `doctor`
- `diff`
- `dist-tag`
- `pack`
- `publish`
- `repo`
- `set-script`
- `unpublish`
- `view`

#### 2. Custom implementation

##### 2.1. Reads from installed dependency tree

General class of helper commands that load from the installed tree to produce some form of useful output.

- `audit`
- `explain`
- `fund`
- `ls`
- `outdated`

##### 2.2. Modify installed dependency tree

The set of commands that will modify an install tree (from an implementation stand-point, these are just [arborist.reify](https://github.com/npm/arborist/) proxies).

- `ci`
- `dedupe|find-dupes`
- `install-ci-test`
- `install-test`
- `install`
- `link`
- `rebuild`
- `update`
- `uninstall`

##### 2.3. Other

Commands that need a special/custom _"workspace-aware"_ implementation outside of the context of reading/writing to the install tree.

- `exec`
- `init`
- `run-script|restart|start|stop|test`
- `version`

#### 3. Unsupported

This category of **npm cli** commands is completely unrelated to anything that the current working directory could affect. This includes a number of registry-specific helper/management operations which don't make sense/have no effect within the context of a workspace. Trying to run these commands with a workspace flag/config will exit with a descriptive error code.

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

$ npm test --workspaces

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

### 3. Examples

Given the results of all this preliminar investigation, the preferred way to run a command in the context of a single workspace is to use the named `--workspace` argument or its `-w` short alias, e.g:

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
npm test --workspace=foo
```


#### Install dependency example:

Add `tap` as a **dependency** for all of your configured **workspaces**:

```sh
npm install tap --workspaces
```


> Note: **Globs** are not supported as a valid `--workspace` argument value, the proposed alternative is to use `npm <cmd> --workspace=<dir>` in which `<dir>` is a folder containing multiple workspaces.

## Prior Art

#### Previously

- [npm workspaces](https://github.com/npm/rfcs/blob/de8d71c0453f5cf443d3ef2f47e313f12dd6aaf9/accepted/0000-workspaces.md)

#### Filtering a subset of workspaces

- [lerna filter-options](https://www.npmjs.com/package/@lerna/filter-options)
- [Yarn v1 workspace cmd](https://classic.yarnpkg.com/en/docs/cli/workspace)
- [Yarn v1 workspaces cmd](https://classic.yarnpkg.com/en/docs/cli/workspaces)
- [Yarn v2 foreach include/exclude](https://yarnpkg.com/cli/workspaces/foreach)
- [pnpm Filtering](https://pnpm.js.org/en/filtering)

