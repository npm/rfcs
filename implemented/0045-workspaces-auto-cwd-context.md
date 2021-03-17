# npm workspaces: auto switch context based on cwd

## Summary

Running **workspace-aware** commands from the context of a child **workspace** folder should work as expected.

## Motivation

Most users expect to be able to navigate to a **nested workspace** directory and use npm commands in that context.

Unfortunately that might not work as intended depending on the command, for example a user trying to add a new dependency `<pkg>` would expect to `cd ./<workspace-folder>` and `npm install <pkg>` to produce a valid install tree adding the new dependency to that workspace but instead that creates a separate install within that directory, failing to hoist/dedupe dependencies to the top-level and generating an extra and unintended package-lock file.

## Detailed Explanation

Given that the cli currently support **workspace-aware** commands (via `--workspaces` and `--workspace` configs) a potential fix to that mismatch between the expected user experience and the current behavior of the npm cli is to automatically switch the internal context to ensure that if the user is trying to run a command that already support the **workspaces configurations**.

## Rationale and Alternatives

- Use the logic to figuring out if a **workspace-aware** command was run from the context of a child **workspace** folder but only print a warning message to users, similar to our existing set of "Did you mean?" warning messages. Educating the user on the usage of the `--workspace` config rather than automatically switching the context.
- Only implement the auto-switch behavior in arborist-reify related methods. namely: `ci|dedupe|find-dupes|install-ci-test|install-test|install|link|rebuild|update|uninstall|update`
- Make it so that the auto-switch behavior of the cli is disabled by default and needs some type of opt-in mechanism.
- Implement the auto-switch behavior as an opt-in with very explicit ways of activating it (e.g: via a config option that can be set in `.npmrc` or cli)
- Do not implement any auto-switch mechanism

## Implementation

Add a recursive check that walks up the file system structure and validates if the current `prefix` is defined as the **"workspaces"** property of a `package.json` file of a parent directory as part of `@npmcli/config`.

In case that is so, we can then tweak the internal `localPrefix` config value to point to the **top-level workspace** while defining the current working directory as the **workspace configuration** (`-w {cwd}`) to be used.

Since this is going to be the new default behavior inside any workspace folder, a way to opt-out is to use the `--no-workspaces` config option. Another possible way is to have a `.npmrc` file within the workspace folder that sets `workspaces=false` in order to always opt-out of treating that folder as a workspace of the root project.

### More examples:

Given a workspace-configured project as such:

```
.
├── node_modules/...
├── package.json
└── packages
    ├── a
    │   └── package.json
    └── b
        └── package.json
```

These variations should be functional equivalent:

> 1. Running from the top-level using the `workspace` config
> 2. Changing the current working dir and then running the command

- Adding a new dependency to a **nested workspace**:
  - `$ npm install abbrev -w packages/a`
  - `$ cd ./packages/a && npm install abbrev`
- Running a script in a **nested workspace**:
  - `$ npm run lint -w packages/a`
  - `$ cd ./packages/a && npm run lint`
- Bumping the version of a **nested workspace**:
  - `$ npm version patch -w packages/a`
  - `$ cd ./packages/a && npm version patch`
- Adding a new dependency to **all nested workspaces**:
  - `$ npm install english-days --ws`
  - `$ cd packages/a && npm install english-days && cd ../b && npm install english-days`
- Running tests in **all nested workspaces**:
  - `$ npm test --ws`
  - `$ cd packages/a && npm test && cd ../b && npm test`

Note: When auto switching context the `.npmrc` file containing config values located at the root project should be respected. A warning is thrown in case a `.npmrc` file is present in the current working directory when auto-switching.

## Prior Art

- Yarn v1 will make sure to add a new dependency in the top-level `node_modules` folder when running from a child workspace folder, both are equivalent:
  - `yarn worskpace <workspace-name> add <pkg>`
  - `cd <workspace-path> && yarn add <pkg>`
