# Opt Out of Auto-Installing Peer Dependencies

## Summary

Add an `auto-install-peers` config (default `true`). When set to `false`, npm stops adding packages to the tree only to satisfy a required peer dependency, and instead reports every package that depends on a package with a required peer without declaring that peer itself. Reports are warnings by default. Under `strict-peer-deps`, violations by the project root or a workspace fail the install.

## Motivation

A library author developing package `A` depends on `B`, and `B` declares `react` as a required peer. `A` should declare `react` too (usually in `peerDependencies` plus `devDependencies`), so that `A`'s consumers are told to provide it. If the author forgets, nothing tells them: since npm 7 ([RFC 0025](https://github.com/npm/rfcs/blob/latest/implemented/0025-install-peer-deps.md)) npm installs `react` on `B`'s behalf, `A`'s tests pass, and the mistake ships. `A`'s published contract is now incomplete: its consumers are never told to provide `react`. Package managers that resolve peers from any ancestor, such as npm and pnpm, hide this. Yarn Plug'n'Play resolves a peer only from the direct parent, so there `B` asks `A` for `react`, `A` provides none, and `B` fails to load it at runtime.

npm has no setting that means "do not install peers for me, and tell me when I forgot one":

- `legacy-peer-deps` ignores `peerDependencies` entirely: no peer edges are created, so nothing is installed and nothing is validated ([definitions.js#L1349](https://github.com/npm/cli/blob/0c3b82a9a612c3f9399d35c28c86708b1f8ea7d4/workspaces/config/lib/definitions/definitions.js#L1349), [node.js#L915](https://github.com/npm/cli/blob/0c3b82a9a612c3f9399d35c28c86708b1f8ea7d4/workspaces/arborist/lib/node.js#L915)).
- `--omit=peer` still builds the tree with peers and only skips writing them to disk.
- `strict-peer-deps` is consulted only when placement hits a conflict ([place-dep.js#L157](https://github.com/npm/cli/blob/0c3b82a9a612c3f9399d35c28c86708b1f8ea7d4/workspaces/arborist/lib/place-dep.js#L157), [build-ideal-tree.js#L1622](https://github.com/npm/cli/blob/0c3b82a9a612c3f9399d35c28c86708b1f8ea7d4/workspaces/arborist/lib/arborist/build-ideal-tree.js#L1622)). When no ancestor declares the peer, npm places it without any check ([build-ideal-tree.js#L1625-L1638](https://github.com/npm/cli/blob/0c3b82a9a612c3f9399d35c28c86708b1f8ea7d4/workspaces/arborist/lib/arborist/build-ideal-tree.js#L1625-L1638)).
- `npm ls` reports unmet peers and exits non zero, but an auto-installed peer is never unmet, so it cannot catch this either.

## Detailed Explanation

### Config

`auto-install-peers` is a boolean, default `true`, accepted by the same commands as `strict-peer-deps` (`install`, `ci`, `update`, `dedupe`, `link`, `find-dupes`). With the default, behavior is unchanged.

The value changes the tree, and it is not recorded in `package-lock.json`. It belongs in the project `.npmrc`, so every developer and CI job uses the same value. Otherwise installs with different values keep adding and pruning the same peers. To migrate, set it in the project `.npmrc` and run `npm install` once, which prunes auto-installed peers from the lockfile. Until then, `npm ci` rejects a lockfile that still contains them.

### Placement

With `auto-install-peers=false`, Arborist never creates a node whose only reason to exist is a required peer edge from a dependency. This covers both paths that place peers today: a missing edge queued by `#problemEdges`, and `#loadPeerSet` resolving through a `parentEdge` that is itself an unmet peer edge of a dependency. Peers declared by the project root or a workspace are still installed, as today. Invalid (conflicting) peers keep today's resolution and `strict-peer-deps` semantics.

A tree loaded from a lockfile must match a fresh build. Before the check and before reify, every command prunes nodes that are not reachable from the project root through non-peer edges or required peer edges declared by the root or a workspace, following each link to its target. Optional peer edges do not keep a node alive. `npm ci` cannot mutate the tree, so it fails with a lockfile out of sync error instead.

### The declaration rule

After the ideal tree is built, npm checks manifests, not placement. For every package `D` that declares `P` in `dependencies`, `optionalDependencies`, `peerDependencies`, or `devDependencies`, and every required peer `X` of `P`, `D` must also declare `X`:

- If `D` declares `P` in `dependencies` or `optionalDependencies`, `X` must be in `dependencies`, `optionalDependencies`, or required `peerDependencies`. A `devDependencies` entry does not count, because `D`'s consumers would not receive it.
- If the project root or a workspace installs `P` itself through `devDependencies` or a required `peerDependencies` entry, `X` may also be in `devDependencies`. An optional peer entry for `X` does not count, because it installs nothing.
- If `D` declares `P` only as a peer it does not install (any peer of a dependency, or an optional peer of the project root or a workspace), `P`'s consumer must provide `X` as well, so any declaration of `X` counts, including an optional peer. This covers the common pattern of a package declaring `@types/react-dom` and `@types/react` as optional peers.

Each violation is reported once:

```
npm warn EPEERUNDECLARED A depends on B, which requires peer react@^18
npm warn EPEERUNDECLARED Add react to A's dependencies or peerDependencies
```

Peer chains are covered at every level: the consumer that provides `P` is itself checked against `P`'s peers, so the obligation moves up to whoever installs `P`. The check reads `P`'s manifest from the tree, so it applies to resolved peers. An unresolved `P` is already reported against its dependent; once that is fixed, `P` resolves and its own peers are checked on the next run.

Under `strict-peer-deps`, violations where `D` is the project root or a workspace are `EPEERUNDECLARED` errors, and the command exits non zero before reify. Violations by third-party dependents stay warnings, because the project cannot fix them without a `packageExtensions` entry per offender; this matches Yarn, where YN0002 is a warning. `--force` downgrades errors to warnings, matching how it overrides peer conflicts today.

### Outcome of a violation

npm does not install the missing peer. If another package that stays in the tree already provides it and it resolves from `P`, the install works as before. Otherwise the peer edge stays missing: `P` may fail at runtime, and `npm ls` reports `missing: X, required by P` and exits with `ELSPROBLEMS`, as it does for any unmet peer today.

### Edge cases

- **Optional peers** (`peerDependenciesMeta.<name>.optional`) are never checked. Their placement is unchanged: skipped when absent, nested when an incompatible provider exists ([build-ideal-tree.js#L1630-L1638](https://github.com/npm/cli/blob/0c3b82a9a612c3f9399d35c28c86708b1f8ea7d4/workspaces/arborist/lib/arborist/build-ideal-tree.js#L1630-L1638)).
- **Bundled dependencies** of a dependency are exempt. Their manifests are only known after extraction during reify, and npm already skips them there. The root and workspaces are never exempt, matching ([build-ideal-tree.js#L1388-L1397](https://github.com/npm/cli/blob/0c3b82a9a612c3f9399d35c28c86708b1f8ea7d4/workspaces/arborist/lib/arborist/build-ideal-tree.js#L1388-L1397)).
- **Third-party dependents** are checked like any other `D`, but only warn, even under `strict-peer-deps`. A dependency that forgets to declare a peer is reported against that dependency, and the project can fix it with [`packageExtensions`](https://docs.npmjs.com/cli/v12/configuring-npm/package-json#packageextensions).
- **Workspaces** are separate dependents. A declaration in the root `package.json` does not satisfy a workspace, because the workspace's own consumers would not receive it. The implicit root to workspace edges ([node.js#L893-L901](https://github.com/npm/cli/blob/0c3b82a9a612c3f9399d35c28c86708b1f8ea7d4/workspaces/arborist/lib/node.js#L893-L901)) are not declarations and are not checked.
- **Install strategies**: the rule reads manifests, so hoisted, nested, shallow, and linked report the same result. A peer that happens to resolve through hoisting is still reported if undeclared.
- **Lockfiles**: because the rule does not depend on how a node got into the tree, a lockfile that still contains auto-installed peers cannot mask a violation (compare https://github.com/npm/cli/issues/9977). Pruning (see Placement) applies with or without `--no-save`, including `npm dedupe` and `npm link`.
- **`--omit=peer`** acts at reify time, after the check, so it does not change what is reported.
- **`legacy-peer-deps`** ignores peers, so the declaration check is skipped entirely even though manifests still list them. Setting both prints a warning that `auto-install-peers` has no effect.

## Rationale and Alternatives

The rule targets the dependent, not the peer, because that is who can fix it: "A must declare react" is actionable, "react is missing" is not. It is also independent of layout and lockfile history, so the same project gets the same answer everywhere.

1. **Extend `strict-peer-deps` to error on undeclared peers.** Rejected: it would break every existing `strict-peer-deps` user whose tree relies on auto-installed peers, and it couples two separate questions (conflicts versus completeness).
2. **Make `legacy-peer-deps` plus `strict-peer-deps` validate presence.** Rejected: `legacy-peer-deps` is defined as ignoring peers and is documented as not recommended. Giving it a second meaning when combined with another flag is surprising.
3. **Report only missing peers (pnpm style).** Checking whether the edge resolves, instead of whether the dependent declared it, depends on layout: under hoisting, another package's declaration can satisfy the edge, so the author of `A` is not told. It also leaves the lockfile masking from https://github.com/npm/cli/issues/9977 in place.

## Implementation

- `workspaces/config/lib/definitions/definitions.js`: add `auto-install-peers` next to [`strict-peer-deps`](https://github.com/npm/cli/blob/0c3b82a9a612c3f9399d35c28c86708b1f8ea7d4/workspaces/config/lib/definitions/definitions.js#L2477) and add it to the params of the commands that list `strict-peer-deps`.
- `workspaces/arborist/lib/arborist/build-ideal-tree.js`: in `#loadPeerSet` ([L1620-L1676](https://github.com/npm/cli/blob/0c3b82a9a612c3f9399d35c28c86708b1f8ea7d4/workspaces/arborist/lib/arborist/build-ideal-tree.js#L1620-L1676)), skip placement when there is no `parentEdge` or the `parentEdge` is an unmet peer edge of a dependency; in `#problemEdges` ([L1404-L1411](https://github.com/npm/cli/blob/0c3b82a9a612c3f9399d35c28c86708b1f8ea7d4/workspaces/arborist/lib/arborist/build-ideal-tree.js#L1404-L1411)), exclude missing `peer` edges from dependencies.
- Same file: add a declaration check after `#buildDeps()` ([L188](https://github.com/npm/cli/blob/0c3b82a9a612c3f9399d35c28c86708b1f8ea7d4/workspaces/arborist/lib/arborist/build-ideal-tree.js#L188)) that reads each non-bundled node's manifest, then warns or throws. It returns early when `legacyPeerDeps` is set.
- Same file: before that check, prune nodes that fail the reachability rule in Placement, regardless of `save`.
- `lib/utils/validate-lockfile.js` (used by `npm ci`): report the same nodes as out of sync.
- The linked reifier needs no change: it already skips edges without a target ([isolated-reifier.js#L185-L188](https://github.com/npm/cli/blob/0c3b82a9a612c3f9399d35c28c86708b1f8ea7d4/workspaces/arborist/lib/arborist/isolated-reifier.js#L185-L188)).
- Docs for the new config and a cross reference from `strict-peer-deps` and `legacy-peer-deps`.

## Prior Art

- **pnpm**: `auto-install-peers` (default `true`) and `strict-peer-dependencies` (default `false`). With auto-install off and strict on, a missing or invalid peer fails the command. pnpm checks whether the peer resolves, not whether the dependent declared it.
- **Yarn Berry**: never auto-installs peers. A dependent that does not provide a peer gets `YN0002 MISSING_PEER_DEPENDENCY`, a warning that does not fail the install. Its message targets the dependent, which is the model this RFC follows.

Related:

- https://github.com/npm/cli/issues/9977
- https://github.com/npm/feedback/discussions/413
- https://github.com/npm/rfcs/discussions/456
- https://github.com/npm/rfcs/issues/221

## Unresolved Questions and Bikeshedding

- Config name: `auto-install-peers` matches pnpm; `install-peers` is shorter.
- Should `package-lock.json` record `auto-install-peers`, so that a mismatched local value is detected instead of churning the lockfile?
