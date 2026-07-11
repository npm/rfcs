# Global Virtual Store for Linked Installs

## Summary

Add an opt-in `global-virtual-store` config for projects using `install-strategy=linked`. When enabled, the package projections that `linked` today writes into each project's `node_modules/.store/` move to a single machine-global store root, and the project's `node_modules` contains only the symlinks (junctions on Windows) that `linked` already creates — now pointing at shared, machine-global projections. Each globally eligible projection is extracted exactly once per machine; every additional project or git worktree that resolves the same dependency subtree costs a few megabytes of symlinks and nearly zero install time. (Packages excluded from global projection — those that may run lifecycle scripts, and git dependencies — still extract and build per project, exactly as plain `linked` does.)

This RFC changes only `@npmcli/arborist` and the npm CLI. It requires no change to `pacote`, no change to `cacache`, no change to `package-lock.json`, no change to the registry, and no change to `npm publish`. It is the counterpart of pnpm's [`enableGlobalVirtualStore`](https://pnpm.io/next/git-worktrees), built on npm's own shipped `linked` layout ([RFC 0042](https://github.com/npm/rfcs/pull/436)) — with a stricter safety model for lifecycle scripts and exact, registry-based garbage collection.

## Motivation

### Parallel agents and git worktrees

Running several coding agents against one repository at the same time has made git worktrees a routine part of local development. Each worktree is a full checkout, and with npm today each worktree needs its own complete, physically distinct `node_modules` — even under `install-strategy=linked`, whose `.store` deduplicates within a project but lives inside that project's own `node_modules`.

The dependency set of N worktrees of the same project is, by construction, 100% identical. npm extracts and stores it N times.

Measured on [`WordPress/gutenberg`](https://github.com/WordPress/gutenberg) (`node_modules`: 2.1 GB, 102,041 files, 1,593 top-level entries) on macOS/APFS: materializing one additional worktree's `node_modules` today costs ~24 seconds and ~2.2 GB of actual disk. A symlink tree of the size this RFC produces costs ~0.1 seconds and under 1 MB — 3,000 symlinks measure at 804 KB. Ten agents on a 2 GB project today is 20 GB and ten extractions; under this RFC it is one extraction plus ~10 MB.

The real-world confirmation comes from pnpm, which shipped `enableGlobalVirtualStore` for exactly this workload and titled the documentation _"Git Worktrees, AI Agents, and pnpm's Global Virtual Store."_ A 2.5 GB production monorepo measured `du -sh node_modules` dropping to **1.4 MB** when enabling it. npm users cannot reach that capability without leaving npm.

### The request npm keeps receiving

A machine-global store is one of npm's most persistently requested features: [npm/rfcs#278](https://github.com/npm/rfcs/issues/278) (2020), [npm/rfcs#409](https://github.com/npm/rfcs/issues/409) (2021), [npm/rfcs#817](https://github.com/npm/rfcs/issues/817) (2025, the `globallink` proposal), [npm/cli#4959](https://github.com/npm/cli/issues/4959), [npm/cli#8158](https://github.com/npm/cli/issues/8158). [npm/cli#8242](https://github.com/npm/cli/issues/8242) was closed with _"New ideas are always appreciated and are better suited for our RFC repo."_ No RFC was ever written. This is that RFC, scoped to the layout that can support it soundly: `linked`, whose tree is already symlinks into a store.

### Why this is cheap now

[RFC 0042](https://github.com/npm/rfcs/pull/436) shipped: `install-strategy=linked` already builds `node_modules/.store/<key>/node_modules/<name>` projections and symlinks (junctions on Windows) everything else into them, via `workspaces/arborist/lib/arborist/isolated-reifier.js`. This RFC reparents that store root out of the project. The projection key, the reifier, the symlink shape, and the lockfile are unchanged. Projects choosing this mode have already accepted symlink semantics by choosing `linked`; the mode takes them one step further and says so loudly.

## Detailed Explanation

### Configuration

```ini
# .npmrc
install-strategy = linked
global-virtual-store = true
```

`global-virtual-store` requires `install-strategy=linked` and errors under `hoisted`, `nested`, or `shallow` — those strategies promise a real directory tree inside the project, and this mode cannot deliver one. The config is read per project, so one machine can mix global-virtual-store projects with ordinary ones.

### Store root

The `store-dir` config names the store root. Its default is `<cache>/_store` — a sibling of `_cacache`, under the npm cache directory. The format-versioned store lives inside it, so the resolved store path (what `npm store path` prints) is `<store-dir>/store-v1`:

```
<store-dir>/
  store-v1/
    links/                             # projections
      <name>@<version>-<hash>/node_modules/<name>/
    projects/                          # project registry (for exact GC)
      <hash-of-project-path>.json
    tmp/
    store.lock
```

`store.lock` serialises concurrent installs and garbage collection — mandatory, since parallel agents are the motivating workload. Two agents installing the same key simultaneously must produce one valid projection: population goes to `tmp/` and lands via atomic `rename`, and a projection directory, once present, is never written into again.

The `store-v1` root is namespaced by subdirectory — this RFC uses `links/`, `projects/`, and `tmp/` — so future store features can share the root and its lock without a migration. One such feature, a file-level content-addressable store, is proposed separately in [Content-Addressable Store](https://github.com/npm/rfcs/pull/912) and would add `files/` and `packages/` beside them.

### Projection key

The key is exactly the key the shipped isolated-reifier already computes (`isolated-reifier.js` `getKey`): `<name>@<version>-<shake256(sorted dependency subtree)>`, plus a bare `+patch` marker when the package is patched. Each node's [RFC 0053](https://github.com/npm/rfcs/pull/862) `patched.integrity` is part of the hashed subtree input, so patch identity is already inside the hash — two projects with the same patch share a projection; a project with a different patch, or none, resolves a different key. No content collision is possible for patched packages.

Because the key covers the resolved dependency subtree, a projection is only ever shared between installs that resolved the package *identically* — same version, same transitive resolutions, same peers, same patches. Sharing never changes what a project resolves; it only changes where the resolved bytes live.

### Population

A projection that does not exist is populated exactly the way `linked` populates its per-project `.store` entry today — same extraction machinery, same integrity model, with one hard sequencing rule: **a projection becomes visible only in its final, complete form.** The steps, all inside a unique directory under `store-v1/tmp/`: (1) `pacote.extract` from the (integrity-verified) tarball; (2) apply the [RFC 0053](https://github.com/npm/rfcs/pull/862) patch if the key carries one; (3) strip the write bits (`mode & ~0o222`) from every file **and directory**, preserving directory execute bits; (4) atomically `rename` into `links/<key>/node_modules/<name>`. Consumers can never observe a writable, unpatched, or partially extracted projection.

Directories are in the sweep for a reason: read-only files alone do not protect a shared tree, because a writable directory still permits `unlink`, `rename`, and create — the standard way tools "edit" a read-only file is to replace it. A shared projection is visible to every consuming project simultaneously, so an in-place write in one worktree would corrupt all of them; making the projection read-only turns that silent corruption into a loud `EACCES` (`EPERM` on Windows, via the NTFS read-only attribute). This is Nix's design lesson, and it is a deliberate difference from pnpm, whose global virtual store leaves shared files writable and relies on trust alone. Note the limit: read-only is protection against *accidental* writes — code running as the store's owner can `chmod` the file writable — so the trust boundary below is a hard requirement, not advice.

This is a behaviour change for opted-in projects: tools that write in place into `node_modules` (`patch-package`-style edits, `chmod +x` in scripts, editors used to hack on a dependency) will fail with `EACCES` where they silently succeeded before. The supported replacements are `npm patch` ([RFC 0053](https://github.com/npm/rfcs/pull/862)) for persistent edits and plain `linked` (mode off) for projects that need writable dependency source.

### Script-capable packages are never globally projected

A lifecycle script writes into its own package directory, and under a shared projection that write would be visible to every consumer — including projects whose [RFC 0054](https://github.com/npm/rfcs/pull/868) allowlist never approved the script, since allowlists are per-project and build output is environment-specific.

The predicate is defined by what arborist actually does, not by the allowlist alone — `rebuild.js` runs a node's scripts when `dangerouslyAllowAllScripts || node.isWorkspace || isScriptAllowed(node.target, allowScripts) === true`. So: a package is **script-capable** for a given install when its RFC 0054 allowlist entry matches, or when `--dangerously-allow-all-scripts` is set and the package can run install/build scripts — which includes packages that declare none: arborist synthesizes `node-gyp rebuild` for any package shipping a `binding.gyp` (`install-scripts.js`), and those write into their own directory more than most. (The `isWorkspace` arm needs no handling: workspaces are symlinked local directories, never projected.)

Script-capable packages keep their projections project-local under `node_modules/.store/`, exactly as plain `linked` does today, writable, and their consumers symlink to the local entry. A `global-virtual-store` project is deliberately hybrid: pristine packages project globally; building packages stay home. This is stricter than pnpm, whose global virtual store shares built projections and has an open in-place-build bug ([pnpm/pnpm#12302](https://github.com/pnpm/pnpm/issues/12302)) as a result.

Git dependencies also stay project-local: their pack step runs `prepare` scripts and its output is not reproducible across npm versions ([RFC 0048](https://github.com/npm/rfcs/pull/525) removed their lockfile `integrity` for exactly that reason), so a machine-global projection keyed on the resolved commit could hold contents another install would not reproduce. Registry and `file:` tarball dependencies — the overwhelming majority of any tree — project globally.

### What reparenting actually touches

The projection key, reifier, and symlink shape are unchanged, but `.store` assumptions live in more places than one path constant: the hidden-lockfile serialization in `reify.js` (which records `file:.store/...` resolutions), `shrinkwrap.js`'s tree walking, and the orphan-`.store` cleanup in `reify.js` all assume the store root is inside the project, and each must learn the global root. Symlink targets into the global store are absolute (junctions on Windows require that anyway), which means a projection's location is fixed once projects point at it — see Unresolved Questions for the relocation consequence.

Cross-filesystem placement needs no special handling: symlinks and junctions cross volumes freely, so a project on a different filesystem than the store root simply works. (This is a real simplification over hardlink- or reflink-based sharing, which cannot cross filesystems.)

### Garbage collection: exact, via a project registry

Live projects symlink into projections, so pruning a referenced projection breaks those projects. Age-based cleanup is therefore not acceptable; garbage collection must be exact.

Each install with the mode enabled atomically writes a registration under `store-v1/projects/` — a file named by the hashed project path, containing the project path and the **complete set of projection keys** that install referenced (write-to-tmp, `rename`, under `store.lock`). The registration is rewritten on every install, so it always describes the last reified tree; an install that turns the mode off, or a `hoisted` reify replacing the symlinks, removes it.

`npm store prune` then has an exact rule: drop registrations whose project path no longer exists; a projection is removable only when no surviving registration lists its key. A project that still exists keeps its registration — and every projection it lists — even if it has not been reinstalled in years, because its `node_modules` symlinks are live.

### `npm store`

| Command            | Behaviour                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `npm store path`   | Print the resolved store path                                                                  |
| `npm store status` | Projection count, registered-project count, apparent and actual size                           |
| `npm store prune`  | Exact projection GC as above                                                                   |

The command surface is deliberately small; future store features can add subcommands.

### Interactions and caveats

- **`package-lock.json`** — unchanged; `linked` and `hoisted` already share one lockfile format, and the projection key derives from the resolved tree the lockfile pins.
- **`npm publish` / `npm pack`** — unchanged; the store is never a publish input.
- **Deployment flows that archive `node_modules`** (Docker `COPY`, `pnpm deploy`-style bundling) must dereference symlinks or reinstall inside the image; the projections live outside the project. This is a hard caveat of the mode, stated up front — the same caveat is already on record against pnpm's equivalent ([pnpm/pnpm#9883](https://github.com/pnpm/pnpm/issues/9883)).
- **Trust boundary.** Shared projections are shared writable state. Mirroring pnpm's caveat, and adopting it as a hard requirement: the store assumes all projects sharing it are within the same trust boundary — do not point a single writable store at mutually untrusted agents, users, or CI tenants. `GHSA-gmw6-94gg-2rc2` is why an earlier symlink-based central-store workaround was removed from arborist, and it should be considered in review.
- **mtimes.** All consumers of a projection see one set of file mtimes (the population time). Tools inferring staleness from `node_modules` mtimes are already unsound under warm caches; this makes that deterministic.
- **`npm ci`** — with every globally eligible projection present, `npm ci` performs no network I/O and no decompression for those packages: it creates symlinks and writes the registration. Project-local exceptions (script-capable and git packages) extract and build per project as plain `linked` does.

## Rationale and Alternatives

### Alternative 1: a `globallink` install strategy

[npm/rfcs#817](https://github.com/npm/rfcs/issues/817) proposed this idea as a fifth install strategy. This RFC delivers the same outcome as a modifier on `linked` instead, for two reasons. First, the behaviour genuinely is `linked` — same key, same reifier, same tree shape — so a separate strategy would duplicate a layout rather than name a new one. Second, `#817` left the hard parts unspecified (garbage collection, lifecycle scripts, trust); this RFC's registry GC and script-capable rule are the answers to why a naive global `.store` was never safe to ship.

### Alternative 2: hardlink or clone the files instead of symlinking directories

Sharing at file granularity with hardlinks/reflinks keeps `node_modules` looking like a plain directory of real files — invisible to `require.resolve`, `realpath`, bundlers, and everything else. That approach is proposed separately as [Content-Addressable Store](https://github.com/npm/rfcs/pull/912), and for default installs it is the right trade. But it costs one directory entry and one inode per file per project — ~40–50 MB per Gutenberg worktree even when every byte is shared — where this RFC costs ~1 MB of symlinks, and it requires new materialization machinery in `pacote`/`cacache` where this RFC requires none. The two proposals are complementary: this RFC is the small, `linked`-scoped, arborist-only win; the CAS is the deep, every-strategy infrastructure.

### Alternative 3: leave projections writable, like pnpm

Shipping pnpm's exact semantics — shared writable projections plus a documentation warning — would be less code and no behaviour change. Rejected: a shared projection multiplies the blast radius of one stray write to every worktree on the machine *instantly*, and the population of one trusting user (a single developer's agents) still contains untrusted-ish writers (build tools, misbehaving postinstalls in dependencies of dependencies). Read-only-after-population converts the failure from silent cross-worktree corruption to a local, attributable error, and the script-capable rule exempts exactly the packages with a legitimate need to write.

### Alternative 4: do nothing; users who need this can use pnpm

pnpm solves this today, well. But npm shipped `linked` precisely to own this layout ([RFC 0042](https://github.com/npm/rfcs/pull/436) is pnpm-inspired and says so), and the remaining step is small: the projections already exist, they are merely parented to the wrong directory for the worktree era. Requiring a package-manager migration to get a one-directory change is a poor trade, especially now that parallel agents make the cost fall on every developer.

## Implementation

### Affected packages

| Package            | Change                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@npmcli/arborist` | `isolated-reifier` targets `<store>/store-v1/links/` when the mode is on; keeps script-capable and git projections project-local; strips write bits after population; writes the project registration; hidden-lockfile serialization, `shrinkwrap.js` walking, and orphan-`.store` cleanup learn the global root. |
| `npm` (CLI)        | `global-virtual-store` and `store-dir` configs; `npm store` command with `path`, `status`, `prune`; docs.                                                                                                                                          |

No changes to `pacote`, `cacache`, or `@npmcli/fs`.

### Phasing

1. **Store root + locking + registry primitives**, behind no user-visible surface.
2. **Reifier reparenting** behind `global-virtual-store`, including the hidden-lockfile/shrinkwrap/orphan-cleanup work and the script-capable and git exclusions.
3. **Read-only-after-population** sweep.
4. **`npm store` command and docs.**

### Tests

- **Byte-identical resolution** — a `global-virtual-store` install resolves every module to content byte-identical to a per-project `linked` install of the same lockfile. This is the acceptance test.
- **Gating** — the combination with `hoisted`/`nested`/`shallow` errors; turning the mode off and reinstalling restores per-project projections and removes the registration.
- **Script-capable invariant** — allowlisted packages, and (under `--dangerously-allow-all-scripts`) script-declaring and `binding.gyp`-shipping packages, materialize project-locally under `node_modules/.store` and never appear under `<store>/links/`; their builds write into their own directory and succeed.
- **Git exclusion** — git dependencies never appear under `<store>/links/`.
- **Read-only projections** — an in-place write to a globally projected file fails `EACCES`/`EPERM`; `unlink`, `rename`, and create inside a projection directory fail likewise (directories are read-only too); a second project sharing the projection observes unchanged content.
- **Concurrent population** — two simultaneous installs of the same key produce one valid projection; `store.lock` prevents interleaved writes.
- **Exact GC** — `npm store prune` never removes a projection referenced by a registered, still-existing project; removes projections once their projects are gone; a registration lists exactly the keys of the last reified tree.
- **Patched keys** — two projects with the same patch share a projection; differing patches resolve different keys.
- **Cross-filesystem** — a project on a different filesystem than the store root installs correctly via symlinks/junctions.
- **Worktree scenario** — N worktrees of one lockfile: one projection set, marginal per-worktree disk in single-digit MB, marginal install time dominated by symlink creation.

## Prior Art

### pnpm `enableGlobalVirtualStore`

The direct model for this RFC. One shared virtual store at `<store-path>/links/`, projections keyed by dependency-graph hash, per-project `node_modules` holds only symlinks. pnpm documents it for git worktrees and AI agents; the 2.5 GB → 1.4 MB figure above is a production measurement of the effect. Where this RFC deliberately differs: pnpm's shared projections are writable (its docs' only mitigation is _"use them only for projects, users, and jobs that trust each other"_), built/side-effect projections are shared (with [pnpm/pnpm#12302](https://github.com/pnpm/pnpm/issues/12302) open as a direct consequence), and store pruning is not exact. This RFC's projections are read-only, script-capable packages are never shared, and GC is registry-exact.

### RFC 0042: Isolated mode

[RFC 0042](https://github.com/npm/rfcs/pull/436) built the layout this RFC reparents: per-project `.store` projections keyed by subtree hash, symlinked consumers, junctions on Windows. Implemented and shipped; this RFC's key and reifier are that code.

### npm/rfcs#817 and npm/cli#8242

The `globallink` proposal, answered in [Alternative 1](#alternative-1-a-globallink-install-strategy). [npm/cli#8242](https://github.com/npm/cli/issues/8242) was closed with a pointer to this repository; no RFC followed.

### Related proposal: Content-Addressable Store

[A separate proposal](https://github.com/npm/rfcs/pull/912) adds file-level, machine-wide content deduplication for every install strategy. If both were accepted, projections under `links/` would be materialized from content-addressed blobs instead of by fresh extraction — cutting the store's own internal duplication, since peer-split projections of the same package contain byte-identical files — and `hoisted` projects would gain the same underlying store.

## Unresolved Questions and Bikeshedding

- **Are read-only projections acceptable for a v1 of this mode, or should writability be configurable?** This RFC argues loud failure beats silent cross-worktree corruption, but it is the most user-visible choice in the proposal.
- **Absolute symlink targets pin the store location.** Moving `store-dir` after projects exist breaks their symlinks until reinstall. Should `npm store` grow a `relocate` subcommand, or is "reinstall after moving the store" acceptable?
- **Registry hygiene.** Registrations are dropped when the project path no longer exists. Should `npm store prune` also verify that a still-existing project's `node_modules` actually contains links into the store, to catch projects that switched package managers without a final npm install?
- **Naming.** `global-virtual-store` matches pnpm's `enableGlobalVirtualStore` for ecosystem familiarity; `store-dir` and the `npm store` command also appear in the separately proposed content-addressable store; if both proposals are in flight, the names should be bikeshed once, jointly.
