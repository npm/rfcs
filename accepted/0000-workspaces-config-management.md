# npm workspaces: Config management

## Summary

Series of subcommands to allow managing what paths/folders should be handled as **workspaces**.

## Motivation

Minimize manual editing of the `package.json` file while providing more resilient and automated workflows for defining **workspaces** within your project.

## Detailed Explanation

- Add positional `workspaces` argument e.g: `lib/workspaces.js` that provides subcommands to enable workflows for **workspaces*** config management.

## Rationale and Alternatives

- The obvious alternative is to choose to not provide subcommands to handle **workspaces** config management.
- Others? TBD

## Implementation

```
# Given a structure:
.
├── package.json { "name": "foo" }
└── packages
    ├── dep-a
    │   └── package.json { "name": "dep-a", "version": "1.0.0" }
    └── dep-b
        └── package.json { "name": "dep-b", "version": "1.3.1" }

$ npm workspaces ls

$ npm workspaces add ./packages/dep-a

$ cat package.json
{
  "name": "foo",
  "workspaces": [
    "./packages/dep-a"
  ]
}

$ npm workspaces ls
dep-a@1.0.0 -> ./packages/dep-a

$ npm workspaces add ./dep-b

$ cat package.json
{
  "name": "foo",
  "workspaces": [
    "./packages/dep-a",
    "./packages/dep-b"
  ]
}

$ npm workspaces ls
dep-a@1.0.0 -> ./packages/dep-a
dep-b@1.3.1 -> ./packages/dep-b

# Remove by name/spec:
$ npm workspaces rm dep-a

# Remove by path:
$ npm workspaces rm ./packages/dep-b

$ cat package.json
{
  "name": "foo",
  "workspaces": []
}

$ npm workspaces ls

# Add glob:
$ npm workspaces add ./packages/*

$ cat package.json
{
  "name": "foo",
  "workspaces": [
    "./packages/*"
  ]
}

$ npm workspaces ls
dep-a@1.0.0 -> ./packages/dep-a
dep-b@1.3.1 -> ./packages/dep-b
```

## Prior Art

TBD

## Unresolved Questions and Bikeshedding

TBD
