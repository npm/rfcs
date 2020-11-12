# npm workspaces

## Summary

Add a set of features to the **npm cli** that provide support to managing multiple packages from within a singular top-level, root package.

## Motivation

This feature has been requested by the community for a long time. The primary motivation behind this RFC is to fully realize a set of features/functionality to support managing multiple packages that may or may not be used together.

The name “workspaces” is already established in the community with both Yarn and Pnpm implementing similar features under that same name so we chose to reuse it for the sake of simplicity to the larger community involved.

## Detailed Explanation

After sourcing feedback from the community, there are 2 major implementations/changes required in the **npm cli** in order to provide the feature set that would enable a better management of nested packages.
- Make the **npm cli** **workspace**-aware.
- Install: In a **npm workspaces** setup users expect to be able to install all nested packages and perform the associated lifecycle scripts from the **Top-level workspace**, it should also be aware of **workspaces** that have a **dependency** on one another and **symlink** them appropriately.

The set of features identified in this document are the ones that are essential to an initial [MVP](https://en.wikipedia.org/wiki/Minimum_viable_product) of the **npm workspaces** support. The community should expect further development of this feature based on the feedback we collected and documented at the end of this RFC.

## Rationale and Alternatives

First and foremost there’s the alternative of leaving the problem set for userland to solve, there’s already the very popular project [Lerna](https://github.com/lerna/lerna) that provides some of these features.

Also available is the alternative of supporting only the install (or bootstrap as Lerna names it) aspect of this proposal, following a less feature-rich approach but one that would still enable the basic goal of improving the user experience of managing multiple child packages but from all the feedback collected during the research phase of this RFC, this alternative is much less desirable to the community of maintainers involved.

## Implementation

### 1. Workspaces configuration: Making the npm cli workspace-aware

We're following the lead of Yarn in supporting the `workspaces` `package.json` property which defines a list of paths, each of these paths may point to the location of a **workspace** in the file system but it also support **globs**.

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

The **npm cli** will read from the paths and **globs** defined in this **workspaces configuration** and look for valid `package.json` files in order to create a list of packages that will be treated as **workspaces**.

**Note:** The `packages` property should support familiar patterns from [npm-packlist](https://www.npmjs.com/package/npm-packlist) `files` definition such as negative globs.


### 2. Installing dependencies across child packages

Change `npm install` ([arborist](https://www.npmjs.com/package/@npmcli/arborist)) behavior to make it properly install **dependencies** for every **workspace** defined in the **workspaces configuration** described above.

**Arborist** should also be aware of all **workspaces** in order to correctly link to another internal **workspace** should it match the required semver version of an expected **dependency** anywhere in the installing tree. e.g:

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
└── dep-b
```

For the initial **workspaces** implementation, we're going to stick with **arborist**'s default algorithm that privileges **hoisting packages** but will place packages at nested `node_modules` whenever necessary.


## Examples

### Expanding on symlinking structure and `package-lock` file shape.

Given a **npm workspaces** setup with the following contents:

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

$ cat ./packages/workspace-b/package.json
{
    "name": "workspace-b",
    "version": "2.1.1",
    "peerDependencies": {
        "react": "^16.x.x"
    }
}

$ cat ./packages/workspace-c/package.json
{
    "name": "workspace-c",
    "version": "1.0.0",
    "peerDependencies": {
        "react": "^16.x.x"
    },
    "dependencies": {
        "workspace-b": "^1.0.0"
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
│   ├── workspace-c -> ./packages/workspace-c
│   └── react
├── core
│   └── libnpmutil
└── packages
    ├── workspace-a
    ├── workspace-b
    └── workspace-c
        └── node_modules
            └── workspace-b@1.0.0
```

And the following `package-lock.json` files:

NOTE: The following lockfile is for illustration purpose only and its final shape might differ.

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
    "node_modules/workspace-c": {
      "resolved": "packages/workspace-c",
      "link": true
    },
    "packages/workspace-a": {
      "name": "workspace-a",
      "version": "1.7.3"
    },
    "packages/workspace-b": {
      "name": "workspace-b",
      "version": "1.0.0"
    },
    "packages/workspace-c": {
      "name": "workspace-c",
      "version": "1.0.0"
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
    },
    "workspace-c": {
      "version": "file:packages/workspace-c",
      "dependencies": {
        "workspace-b": {
          "version": "1.0.0",
          "resolved": "https://registry.npmjs.org/workspace-b/-/workspace-b-1.0.0.tgz",
          "integrity": "sha512-8xOcRHvCjnocdS5cpwXQXVzmmh5e5+saE2QGoeQmbKmRS6J3VQppPOIt0MnmE+4xlZoumy0GPG0D0MVIQbNA1A=="
        },
      }
    }
  }
}
```


## Dictionary

During the discussions around this RFC it was brought up to our attention that a lot of the vocabulary surrounding what the larger JavaScript community understands as "workspaces" can be confusing, for the sake of keeping the discussion as productive as possible we're taking the extra step of documenting what each of the terms used here means:

- **npm cli**: The [npm cli](https://github.com/npm/cli/) :wink:
- **npm workspaces**: The feature name, meaning the ability to the **npm cli** to support a better workflow for working with multiple packages.
- **workspaces**: A set of **workspace**.
- **workspace**: A nested package within the **Top-level workspace** file system that is explicitly defined as such via **workspaces configuration**.
- **Top-level workspace**: The root level package that contains a **workspaces configuration** defining **workspaces**.
- **workspaces configuration**: The blob of json configuration defined within `package.json` that declares where to find **workspaces** for this **Top-level workspace** package.
- **dependencies**: A set of **dependency**.
- **dependency**: A package that is depended upon by another given package.
- **dependent**: A package which depends on another given package.
- **symlink**: A [symbolic link](https://en.wikipedia.org/wiki/Symbolic_link) between files.
- **[globs](https://en.wikipedia.org/wiki/Glob_(programming))**: String patterns that specifies sets of filenames with special characters.
- **[Arborist](https://github.com/npm/arborist)**: The npm@7 install library.
- **hoisting packages**: Bringing packages up a level in the context of an installation tree.
- **[scripts](https://docs.npmjs.com/misc/scripts)**: Arbitrary and lifecycle scripts defined in a `package.json`.


## Prior Art

- [Lerna](https://github.com/lerna/lerna)
- [Yarn workspaces](https://classic.yarnpkg.com/en/docs/workspaces/)
- [Pnpm workspaces](https://pnpm.js.org/en/workspaces)
