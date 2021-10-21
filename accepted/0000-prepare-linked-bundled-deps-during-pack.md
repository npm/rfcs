# Run `prepare` Scripts for Linked Bundled Dependencies

## Summary

Following discussion on #477 and previously on #463, workspaces that depend on sibling workspaces via the `file:` protocol (a.k.a. linked or symlinked dependencies) should run the sibling workspaces' `prepare` scripts as part of the depend-_ing_ workspace's `pack` operation when those sibling dependencies are also specified as bundle/d dependencies (e.g. their "built" output should make it into the packed workspace's tarball).

## Motivation

It's common for workspaces in a monorepo to depend on one another. Calling `npm pack` on a workspace should automatically run the `prepare` script of any linked and bundled dependencies so that the produced tarball will have consistent and correct contents without a bunch of extra wiring.

## Detailed Explanation

`app-a` and `pkg-b` are workspaces in a monorepo. `app-a` depends on `pkg-b` and lists it as a `bundledDependency` because `app-a` is expected to be distributed as a Node app somewhere (AWS Lambda, Docker, etc.) where it should be deployed along with its production dependencies. `pkg-b` is not published to a registry for reasons, and is written in a language or standard that must be compiled or transpiled to be runnable in Node (TypeScript, ES2049, etc.).

Assuming `app-a`s package.json contains this:

```json
{
  "name": "app-a",
  "version": "1.0.0",
  "dependencies": {
    "pkg-b": "file:../pkg-b"
  },
  "bundleDependencies": ["pkg-b"]
}
```

… and `pkg-b`'s package.json contains this:

```json
{
  "name": "pkg-b",
  "version": "1.0.0",
  "scripts": {
    "prepare": "tsc"
  }
}
```

… with the appropriate tsconfig.json, .npmignore, and index.ts in `pkg-b`, running `cd app-a ; npm i --package-lock=false ; npm pack` should produce a tarball with contents like:

```sh
app-a
├── node_modules
│   └── pkg-b
│        ├── index.js
│        └── package.json
└── package.json
```

## Rationale and Alternatives

This functionality is possible today, but requires the package being packed to explicitly call the `prepare` scripts of each of its linked and bundled dependencies.

It's also possible to achieve the same end result by publishing the bundled dependencies to a registry, but for a package that's expected to have utility only within the context of other workspaces in a monorepo this adds a bunch of bureacracy for not much benefit.

## Implementation

{{Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

- Related to a forthcoming PR about workspace/dependency layout from @ljharb
- Discussed at #478

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
