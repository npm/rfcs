# npm workspaces

## Summary

Add a set of features to the npm cli that provide support to managing multiple packages from within a singular top-level, root package.

## Motivation

This feature has been requested by the community for a long time. The primary motivation behind this RFC is to fully realize a set of features/functionality to support managing multiple packages that may or may not be used together.

The name “workspaces” is already established in the community with both Yarn and Pnpm implementing similar features under that same name so we chose to reuse it for the sake of simplicity to the larger community involved.

## Detailed Explanation

After sourcing feedback from the community, there are 2 major implementations/changes required in the cli in order to provide the feature set that would enable a better management of nested packages.
- Install: In a workspaces setup users expect to be able to install all nested packages and perform the associated lifecycle scripts from the root-level, it should also be aware of sibling packages that depend on one another and link them appropriately
- Run some npm subcommands in the context of each nested workspace

## Rationale and Alternatives

First and foremost there’s the alternative of leaving the problem set for userland to solve, there’s already the very popular project Lerna that provides some of these features.

Also available is the alternative of supporting only the install (or bootstrap as Lerna names it) aspect of this proposal, following a less feature-rich approach but one that would still enable the basic goal of improving the user experience of managing multiple child packages but from all the feedback collected during the research phase of this RFC, this alternative is much less desirable to the community of maintainers involved.

## Implementation

### 1. Make npm workspace-aware

We're following the lead of Yarn in supporting the `workspaces` `package.json` field which defines a list of paths, each of these paths may be a workspace itself but it also support globs.

`package.json` example:

```
{
    "name": "workspace-example",
    "version": "1.0.0",
    "workspaces": {
        "packages": [
            "packages/*"
        ]
    }
}
```

`package.json` shorthand example:

```
{
    "name": "workspace-example",
    "version": "1.0.0",
    "workspaces": [
        "packages/*"
    ]
}
```


### 2. Installing dependencies across child packages

Change `npm install` ([arborist](https://www.npmjs.com/package/@npmcli/arborist)) behavior to make it install every nested package by default once a valid configuration is defined.

Arborist should also be aware of all nested workspaces and correctly link to an internal workspace should it match the required semver version of an expected dependency anywhere in the installing tree. e.g:

```
// Given this package.json structure:
├── package.json { "workspaces": ["dep-a", "dep-b"] }
├── dep-a
│   └── package.json { "dependencies": { "dep-b": "^1.0.0" } }
└── dep-b
    └── package.json { "version": "1.3.1" }

$ npm install

// Results in this symlinking structure:
├── node_modules
│   ├── dep-a -> ./dep-a
│   └── dep-b -> ./dep-b
├── dep-a
│   └── node_modules
│       └── dep-b -> ../../../node_modules/dep-b
└── dep-b
```

NOTE: The final implementation of the symlinking structure might differ from the examples laid out here (which are trying to be as illustrative as possible). Arborist might end up resolving all symlinks up to the actual place instead of creating a chain of symlinks.

### 3. Run commands across all child packages

Make npm commands workspace-aware, so that running a command tries to run it within nested packages as long as a workspaces field is defined in `package.json`.

Only a subset of npm commands are to be supported:

- `fund` List funding info for all packages
- `ls` List all packages
- `outdated` List outdated deps for all packages
- `publish` Publishes all packages
- `run-script` Run arbitrary scripts for all packages
- `rebuild` Rebuild all packages
- `restart`
- `start`
- `stop`
- `test` Run tests in all packages
- `update` Update a dependency in all packages
- `version` Bump versions for all packages
- `view` View registry info for all packages

A new config value should be introduced in order to allow for filtering out a subset of the packages in which to run these commands. e.g: `--filter`

#### Test example:

```
├── package.json { "name": "foo", "workspaces": ["dep-a", "dep-b"] }
├── dep-a
│   └── package.json { "version": "1.0.0" }
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


### 4. Publishing workspaces

A workspace may not be published to the registry and for all publishing purposes having a valid `"workspace"` entry in a `package.json` is going to be the equivalent of `"private": true`.


## Examples

### 1. Simplistic example expanding on symlinking structure and `package-lock` file shape.

Given a workspaces setup with the following contents:

```
$ cat ./package.json
{
    "name": "foo",
    "version": "1.0.0",
    "workspaces": [
        "./core/*",
        "./packages/*"
    ],
    dependencies: {
        "lodash": "^4.x.x",
        "libnpmutil": "^1.0.0"
    }
}

$ cat ./core/libnpmutil/package.json
{
    "name": "libnpmutil",
    "version": "1.0.0",
    "dependencies": {
        "lodash": "^4.x.x"
    }
}

$ cat ./packages/workspace-a/package.json
{
    "name": "workspace-a",
    "version": "1.7.3",
    "peerDependencies": {
        "react": "^16.x.x"
    },
    "dependencies": {
        "workspace-b": "^2.0.0"
    }
}

$ cat ./packages/worskpace-b/package.json
{
    "name": "workspace-b",
    "version": "2.1.1",
    "peerDependencies": {
        "react": "^16.x.x"
    }
}
```

Will result in the following symlinking structure:

```
$ tree
.
├── package-lock.json
├── node_modules
│   ├── lodash
│   ├── libnpmutil -> ./core/libnpmutil
│   ├── workspace-a -> ./packages/workspace-a
│   ├── workspace-b -> ./packages/workspace-b
│   └── react
├── core
│   └── libnpmutil
│       ├── package-lock.json
│       └── node_modules
│           └── lodash -> ../../../node_modules/lodash
└── packages
    ├── workspace-a
    │   ├── package-lock.json
    │   └── node_modules
    │       ├── react -> ../../../node_modules/react
    │       └── worspace-b -> ../../../node_modules/workspace-b
    └─ worspace-b
        ├── package-lock.json
        └── node_modules
            └── react -> ../../../node_modules/react
```

And the following `package-lock.json` files:

```
$ cat ./package-lock.json
{
  "name": "foo",
  "version": "1.0.0",
  "lockfileVersion": 2,
  "requires": true,
  "packages": {
    "": {
      "name": "foo",
      "version": "1.0.0",
      "dependencies": {
        "lodash": "^4.17.15",
        "libnpmutil": "^1.0.0"
      }
    },
    "core/libnpmutil": {
      "name": "libnpmutil",
      "version": "1.0.0"
    },
    "node_modules/lodash": {
      "name": "lodash",
      "version": "4.17.15",
      "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.15.tgz",
      "integrity": "sha512-8xOcRHvCjnocdS5cpwXQXVzmmh5e5+saE2QGoeQmbKmRS6J3VQppPOIt0MnmE+4xlZoumy0GPG0D0MVIQbNA1A=="
    },
    "node_modules/libnpmutil": {
      "resolved": "core/libnpmutil",
      "link": true
    },
    "node_modules/workspace-a": {
      "resolved": "packages/workspace-a",
      "link": true
    },
    "node_modules/workspace-b": {
      "resolved": "packages/workspace-b",
      "link": true
    },
    "packages/workspace-a": {
      "name": "workspace-a",
      "version": "1.7.3"
    },
    "packages/workspace-b": {
      "name": "workspace-b",
      "version": "2.1.1"
    }
  },
  "dependencies": {
    "lodash": {
      "version": "4.17.15",
      "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.15.tgz",
      "integrity": "sha512-8xOcRHvCjnocdS5cpwXQXVzmmh5e5+saE2QGoeQmbKmRS6J3VQppPOIt0MnmE+4xlZoumy0GPG0D0MVIQbNA1A=="
    },
    "libnpmutil": {
      "version": "file:core/libnpmutil"
    },
    "workspace-a": {
      "version": "file:packages/workspace-a"
    },
    "workspace-b": {
      "version": "file:packages/workspace-b"
    }
  }
}

$ cat ./packages/workspace-a/package-lock.json
{
  "name": "workspace-a",
  "version": "1.7.3",
  "lockfileVersion": 2,
  "requires": true,
  "packages": {
    "": {
      "name": "workspace-a",
      "version": "1.7.3",
      "dependencies": {
        "react": "^16.x.x",
        "workspace-b": "^2.0.0"
      }
    },
    "../../../node_modules/workspace-b": {
      "name": "workspace-b",
      "version": "2.1.1"
    }
    "node_modules/react": {
      "name": "react",
      "version": "16.12.0",
      "resolved": "https://registry.npmjs.org/react/-/react-16.12.0.tgz",
      "integrity": "sha512-fglqy3k5E+81pA8s+7K0/T3DBCF0ZDOher1elBFzF7O6arXJgzyu/FW+COxFvAWXJoJN9KIZbT2LXlukwphYTA=="
    },
    "node_modules/workspace-b": {
      "resolved": "../../../node_modules/workspace-b",
      "link": true
    }
  },
  "dependencies": {
    "react": {
      "version": "16.12.0",
      "resolved": "https://registry.npmjs.org/react/-/react-16.12.0.tgz",
      "integrity": "sha512-fglqy3k5E+81pA8s+7K0/T3DBCF0ZDOher1elBFzF7O6arXJgzyu/FW+COxFvAWXJoJN9KIZbT2LXlukwphYTA=="
    },
    "workspace-b": {
      "version": "file:../../../node_modules/workspace-b"
    }
  }
}

$ cat ./packages/workspace-b/package-lock.json
{
  "name": "workspace-b",
  "version": "2.1.1",
  "lockfileVersion": 2,
  "requires": true,
  "packages": {
    "": {
      "name": "workspace-b",
      "version": "2.1.1",
      "dependencies": {
        "react": "^16.x.x"
      }
    },
    "node_modules/react": {
      "name": "react",
      "version": "16.12.0",
      "resolved": "https://registry.npmjs.org/react/-/react-16.12.0.tgz",
      "integrity": "sha512-fglqy3k5E+81pA8s+7K0/T3DBCF0ZDOher1elBFzF7O6arXJgzyu/FW+COxFvAWXJoJN9KIZbT2LXlukwphYTA=="
    }
  },
  "dependencies": {
    "react": {
      "version": "16.12.0",
      "resolved": "https://registry.npmjs.org/react/-/react-16.12.0.tgz",
      "integrity": "sha512-fglqy3k5E+81pA8s+7K0/T3DBCF0ZDOher1elBFzF7O6arXJgzyu/FW+COxFvAWXJoJN9KIZbT2LXlukwphYTA=="
    }
  }
}
```

### 2. Expanded example using nested workspaces

Given a workspaces setup:

```
$ cat package.json
{
    "workspaces": [
        "apps/*",
        "packages/*"
        "plugins",
        "ws2"
    ]
}
```

In which `apps/` and `packages/` are folders that contain nested packages within. While `plugins/` and `ws2/` are folders that contains a `package.json` file that describes a nested workspace for each. e.g:

```
$ cat ./ws2/package.json
{
    "workspaces": [
        "apps/*",
        "packages/*"
    ]
}
```

The following output illustrates the resulting symlinking structure. With special attention to the hoisting characteristic of each workspace that will centralize deps at the top-level `node_modules` folder for each workspace in order to symlink it for all its nested packages.


```
$ tree
.
├── apps
│  ├── x
│  │  └── node_modules
│  │     ├── bar -> ../../../node_modules/bar
│  │     ├── baz -> ../../../node_modules/baz
│  │     └── foo -> ../../../node_modules/foo
│  ├── y
│  │  └── node_modules
│  │     ├── bar -> ../../../node_modules/bar
│  │     ├── baz -> ../../../node_modules/baz
│  │     └── foo -> ../../../node_modules/foo
│  └── z
│     └── node_modules
│        ├── bar -> ../../../node_modules/bar
│        ├── baz -> ../../../node_modules/baz
│        └── foo -> ../../../node_modules/foo
├── node_modules
│  ├── bar -> ../packages/bar
│  ├── baz -> ../packages/baz
│  ├── foo -> ../packages/foo
│  ├── x -> ../apps/x
│  ├── y -> ../apps/y
│  └── z -> ../apps/z
├── package.json
├── packages
│  ├── bar
│  │  └── node_modules
│  │     ├── baz -> ../../../node_modules/baz
│  │     └── foo -> ../../../node_modules/foo
│  ├── baz
│  │  └── node_modules
│  │     ├── bar -> ../../../node_modules/bar
│  │     └── foo -> ../../../node_modules/foo
│  └── foo
│     └── node_modules
│        ├── bar -> ../../../node_modules/bar
│        └── baz -> ../../../node_modules/baz
├── plugins
│  ├── a
│  │  └── node_modules
│  │     ├── baz -> ../../node_modules/baz
│  │     └── foo -> ../../node_modules/foo
│  ├── b
│  │  └── node_modules
│  │     ├── baz -> ../../node_modules/baz
│  │     └── foo -> ../../node_modules/foo
│  ├── c
│  │  └── node_modules
│  │     ├── baz -> ../../node_modules/baz
│  │     └── foo -> ../../node_modules/foo
│  ├── d
│  │  └── node_modules
│  │     ├── baz -> ../../node_modules/baz
│  │     └── foo -> ../../node_modules/foo
│  ├── node_modules
│  │  ├── baz -> ../../node_modules/baz
│  │  └── foo -> ../../node_modules/foo
│  └── package.json
└── ws2
   ├── apps
   │  └── twoapp
   │     └── node_modules
   │        └── two -> ../../../node_modules/two
   ├── node_modules
   │  ├── bar -> ../../node_modules/bar
   │  ├── big-external-dep
   │  ├── two -> ../packages/two
   │  └── twoapp -> ../apps/twoapp
   ├── package.json
   └── packages
      └── two
         └── node_modules
            ├── bar -> ../../../node_modules/bar
            └── big-external-dep -> ../../../node_modules/big-external-dep
```


## Prior Art

- [Lerna](https://github.com/lerna/lerna)
- [Yarn workspaces](https://classic.yarnpkg.com/en/docs/workspaces/)
- [Pnpm workspaces](https://pnpm.js.org/en/workspaces)

## Unresolved Questions and Bikeshedding

- Should we add a Workspace class (subclass of Node) in Arborist?
- For this initial implementation there's no intention of adding a more ellaborate version/publish subcommand/workflow that would allow for bumping versions of nested packages + updating dependency references elsewhere across a workspace (similar to `lerna --independent` publish workflow).
