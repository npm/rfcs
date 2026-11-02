# Content-Addressable Store

## Summary

Add a global, file-level content-addressable store (CAS) to npm, and materialize `node_modules` from it by copy-on-write clone or hardlink instead of re-extracting a tarball for every package in every project.

npm's cache (`cacache`) is already content-addressed and integrity-verified, but its addressable unit is the compressed tarball, and it is only ever a _download_ cache: `reify` re-runs `tar.x` into each destination on every install. This RFC proposes addressing at _file_ granularity and making the store a _materialization_ source.

The store is a materialization backend, not an install strategy. It composes with `hoisted`, `nested`, `shallow`, and `linked`. It introduces a `store-dir` config, a `package-import-method` config, and an `npm store` command. This RFC is the complete file-level store design: ingest, materialization, cross-filesystem handling, and garbage collection. It requires no change to `package-lock.json`, no change to the registry, no change to `npm publish`, and no change to the paths or file contents any tool sees when it reads `node_modules`. File _metadata_ can change: under hardlinking, materialized files are read-only and share mtimes and link counts across projects. That trade-off is deliberate and is treated explicitly in the [Detailed Explanation](#this-is-a-behaviour-change-and-it-is-the-one-to-argue-about).

## Motivation

### The immediate pressure: parallel agents and git worktrees

Running several coding agents against one repository at the same time has made git worktrees a routine part of local development. Each worktree is a full checkout, and with npm today each worktree needs its own complete, physically distinct `node_modules`.

The dependency set of N worktrees of the same project is, by construction, 100% identical. npm stores it N times.

Measured on [`WordPress/gutenberg`](https://github.com/WordPress/gutenberg) (`node_modules`: 2.1 GB, 102,041 files) on macOS/APFS, reporting _actual disk consumed_ as a `df` free-space delta rather than `du`, which reports apparent size and cannot see block sharing:

| Operation                                               | Wall time |      Actual disk |
| ------------------------------------------------------- | --------: | ---------------: |
| Full copy ×1 — what npm materializes per worktree today |    23.9 s |     **2,230 MB** |
| `clonefile(2)` ×1                                       |    14.0 s |        **50 MB** |
| `clonefile(2)` ×5 — five worktrees                      |    70.1 s | **190 MB total** |

Five worktrees today cost roughly 11.2 GB. Five worktrees materialized from a CAS cost roughly 1.8 GB — 1.60 GB of unique file content plus ~190 MB of per-worktree directory metadata. That is a ~6× reduction, and it improves with N: the marginal worktree costs ~40 MB instead of ~2.2 GB.

This is not a hypothetical workload. pnpm shipped [`enableGlobalVirtualStore`](https://pnpm.io/next/git-worktrees) for it, and titled the documentation _"Git Worktrees, AI Agents, and pnpm's Global Virtual Store."_ npm users cannot reach that capability without leaving npm. pnpm's symlinked approach is in fact cheaper still — roughly 1.6 GB for the same five worktrees — at the cost of a `node_modules` that is no longer a plain directory of real files; see [Alternative 3](#alternative-3-a-symlinked-global-virtual-store).

### The standing pressure: duplication across projects

Content-hashing every regular file under `node_modules` in two checkouts on one machine:

| Project   |       Files |        Size | Unique files | Unique bytes |
| --------- | ----------: | ----------: | -----------: | -----------: |
| gutenberg |     102,041 |     1.99 GB |       70,881 |      1.60 GB |
| npm-cli   |      27,000 |     0.25 GB |       20,027 |      0.23 GB |
| **Union** | **129,041** | **2.24 GB** |   **80,874** |  **1.74 GB** |

37.3% of all files are byte-identical duplicates. In byte terms the saving is smaller — 22.1%, or 493 MB — because duplicated files skew small: a duplicate averages 10 KB, a unique file 22 KB, and a handful of large unique files dominate total size. This RFC does not oversell cross-project deduplication: the file-count win is large, the byte win is real but moderate, and the compelling case is the worktree case above, where the dependency set is identical rather than merely overlapping.

### What npm does today

`cacache` stores gzipped tarballs at `~/.npm/_cacache/content-v2/<algo>/<aa>/<bb>/<rest>`, keyed by Subresource Integrity, verified on read and write. That store is global, sound, and already content-addressed. It is simply never used to _place_ files.

Placement into `node_modules` happens once per package per project, in a single call site (arborist's only other `pacote.extract`, in `build-ideal-tree.js`, unpacks into a cacache temp directory to inspect bundled dependencies — it never places files in a project):

```js
// workspaces/arborist/lib/arborist/reify.js
await pacote.extract(res, node.path, { ... })
```

`pacote.extract` pipes the tarball through `tar.x({ cwd: dest })`. Grepping `arborist/lib/` and `pacote/lib/` for `fs.link`, `linkSync`, or `hardlink` returns nothing outside of symlink and bin-link code. npm has never hardlinked or cloned a file into `node_modules`. Installing one package into N projects gunzips and writes it N times.

The consequence is that the cheapest thing npm can do with a fully warm cache is still O(bytes written). The store proposed here makes it O(files linked), and on a copy-on-write filesystem the bytes are never written at all.

### Concrete pain points

- **Parallel agents.** Each worktree pays full install time and full disk. Ten agents on a 2 GB project is 20 GB and ten extractions.
- **CI.** Warm-cache `npm ci` still gunzips and writes every byte of every package. The dominant cost is not the network.
- **Monorepo tooling.** `install-strategy=linked` deduplicates _within_ a project only. Its `node_modules/.store` is per-project and is itself populated by fresh extractions.
- **Long-standing requests.** [npm/rfcs#278](https://github.com/npm/rfcs/issues/278) (2020), [npm/rfcs#409](https://github.com/npm/rfcs/issues/409) (2021), [npm/rfcs#817](https://github.com/npm/rfcs/issues/817) (2025), [npm/cli#4959](https://github.com/npm/cli/issues/4959), [npm/cli#8158](https://github.com/npm/cli/issues/8158). [npm/cli#8242](https://github.com/npm/cli/issues/8242) was closed with _"New ideas are always appreciated and are better suited for our RFC repo."_ No RFC was ever written.

### Why this shape, now

Three things that were not true before are true now:

1. **`cacache` is already a content-addressed store with integrity verification.** This RFC changes its granularity; it does not introduce a new trust model or a new hashing scheme.
2. **[RFC 0054: Make install scripts opt-in](https://github.com/npm/rfcs/pull/868)** means npm knows, before reification, exactly which packages are permitted to run lifecycle scripts. Those are precisely the packages that may mutate their own directory. npm can therefore materialize them with a private copy and hardlink everything else — a sharper answer to the shared-mutation hazard than any other package manager currently has.
3. **[RFC 0053: Native Dependency Patching](https://github.com/npm/rfcs/pull/862)** already established a content-addressed side-store keyed on `(packageIntegrity, patchIntegrity)`. Patched packages produce different file content, therefore different blobs, and deduplicate correctly with no special handling.

## Detailed Explanation

### Terminology

- **Blob** — the immutable content of a single regular file, addressed by its hash.
- **Package index** — a manifest mapping a package tarball's integrity to the set of blobs and paths that the tarball unpacks to.
- **Ingest** — extracting a tarball once, writing its blobs into the store, and writing its package index.
- **Materialize** — creating the files of a package at a destination path from the store, using clone, hardlink, or copy.
- **Import method** — the primitive used to materialize a single file.

### Store layout

The `store-dir` config names the store root. Its default is `<cache>/_store` — a sibling of `_cacache`, under the npm cache directory. The format-versioned store lives inside it, so the resolved store path (what `npm store path` prints) is `<store-dir>/store-v1`:

```
<store-dir>/
  store-v1/
    files/
      sha512/<aa>/<bb>/<rest>          # blob, mask 0444 (the default)
      sha512/<aa>/<bb>/<rest>-555      # blob, mask 0555 (executables)
      sha512/<aa>/<bb>/<rest>-<mask>   # rarer masks (0544, ...) as needed
    packages/
      sha512/<aa>/<bb>/<rest>.json     # package index, keyed by tarball integrity
    tmp/
    store.lock
```

The `store-v1` root is namespaced by subdirectory — this RFC uses `files/`, `packages/`, and `tmp/` — so future store features can share the root and its lock without a migration. One such feature, a machine-global virtual store for linked installs, is proposed separately in [Global Virtual Store](https://github.com/npm/rfcs/pull/911) and would add `links/` and `projects/` beside them.

Blob and index paths reuse `cacache`'s existing `hashToSegments` layout (`[hex[0:2], hex[2:4], hex[4:]]`), so directory fan-out behaviour and its known performance characteristics carry over unchanged.

`cacache`'s `content-v2` tarball cache is retained as-is. The CAS does not replace it; the tarball remains the unit of network transfer, offline reinstall, and integrity checking against the lockfile.

### Blobs are keyed on `(content, mode)`, not content alone

This is the detail that is easiest to get wrong.

pacote derives a file's mode at extraction time:

```js
// pacote/lib/fetcher.js
#entryMode (path, mode, type) {
  const m = /Directory|GNUDumpDir/.test(type) ? this.dmode
    : /File$/.test(type) ? this.fmode : 0
  const exe = isPackageBin(this.package, path) ? 0o111 : 0
  return ((mode | m) & ~this.umask) | exe | 0o600
}
```

Three consequences:

1. Executability comes from _two_ sources: `isPackageBin(this.package, path)` — a property of the manifest, not of the bytes — and the tar header's own mode bits, which survive `mode | 0o666`. `npm pack` forces `bin` entries executable but does not clear exec bits on other files (`tar-create-options.js`), so a published tarball can legitimately carry `0o755`, or partial patterns like `0o744`, on files that are not bins. The same content can therefore require different modes in different packages — or in the same package at different paths.
2. Hardlinks share one inode, and therefore one mode. A single blob cannot serve two modes.
3. The final mode is not restricted to two values. `0o644` and `0o755` dominate overwhelmingly, but partial-exec headers produce modes like `0o744`.

So a blob's identity is `(contentHash, mask)`, where **mask** is `#entryMode(path, tarMode, type)` computed with a zero umask and then stripped of _all_ write bits — `entryMode & ~0o222`. (All three write bits, not just owner-write: `#entryMode`'s `fmode = 0o666` sets group and world write too, and removing only the owner bit would yield nonsense like `0466`.) That gives `0444` and `0555` in practice, with rare exact variants (`0544`, …) stored as needed. The blob is written read-only at exactly its mask, the package index records each path's mask, and blobs with different masks are distinct store entries even for identical bytes. Cloning and copying may `chmod` freely after the fact; hardlinking may not, which is why the variants must exist on disk.

See [The shared-mutation hazard](#the-shared-mutation-hazard) below for why the stored modes are read-only.

### Package index

Keyed by the tarball's integrity — the same value the lockfile already records:

```json
{
  "storeVersion": 1,
  "name": "lodash",
  "version": "4.17.21",
  "tarballIntegrity": "sha512-...",
  "ingestedAt": "2026-07-10T00:00:00.000Z",
  "lastImportedAt": "2026-07-10T00:00:00.000Z",
  "files": {
    "package.json": { "blob": "sha512-...", "mask": "444", "size": 3021 },
    "lib/cli.js": { "blob": "sha512-...", "mask": "555", "size": 812 }
  }
}
```

`files` is the complete manifest, and it contains regular files only — which is what makes every entry linkable. The non-regular tar entry types are specified as follows:

- **`Directory` entries** are not preserved by pacote today; directories are implied by file paths, and empty directories do not materialize. Unchanged.
- **`Link` (hardlink) entries** are resolved at ingest to the target's content and recorded as an ordinary `files` entry sharing the target's blob. This is the fix for [npm/cli#7608](https://github.com/npm/cli/issues/7608); see [below](#resolving-two-open-bugs-rather-than-inheriting-them).
- **`SymbolicLink` entries** are dropped by pacote's tar filter today and remain dropped. Giving them install semantics is out of scope for this RFC.
- **Any other entry type** (FIFO, device, etc.) is dropped, as today.

Because the key is the tarball integrity and the lockfile already pins that value, the lockfile requires no change whatsoever. A store hit is a pure local optimisation. A store miss falls back to today's code path.

### Ingest

On a cache miss, or on the first materialization of a tarball whose package index is absent:

1. Fetch the tarball into `content-v2` exactly as today.
2. Stream it through `tar.x` once, into `store-v1/tmp/`.
3. For each regular file, hash the content, write the blob to its final path at its computed mask (skip if it already exists), and record the entry.
4. Write the package index atomically via `rename`.

Ingest itself costs the same as today's single extraction, and happens once per tarball per machine rather than once per project. The very first install of a package on a machine is therefore not faster — it pays ingest plus a materialization. Under `clone` or `hardlink` the materialization writes no file bytes, so the cold cost stays roughly at today's single extraction; under `copy` it is extraction plus a full copy, strictly more work than today. The win begins with the second materialization of the same tarball anywhere on the machine — another project, another worktree, the next `npm ci` — which skips download and decompression entirely.

### Materialize

To place a package at `dest`, read its package index and, for each entry, import the blob. Directories are created from the paths in `files`; the symlinks and junctions arborist creates for tree layout (workspaces, `file:` directories, the `linked` strategy) are unrelated to the store and unchanged.

`package-import-method` controls the primitive:

| Value              | Behaviour                                                     |
| ------------------ | ------------------------------------------------------------- |
| `auto` _(default)_ | clone → hardlink → copy, falling back on the first that fails |
| `clone`            | clone where eligible; error if the filesystem cannot clone    |
| `hardlink`         | hardlink where eligible; error if the filesystem cannot hardlink |
| `clone-or-copy`    | clone, else copy — never hardlink                             |
| `copy`             | always copy (today's effective behaviour)                     |

Node exposes exactly the primitives required:

- **clone** — `fs.copyFile(src, dest, constants.COPYFILE_FICLONE_FORCE)`. libuv maps this to `copyfile(3)` with `COPYFILE_CLONE` on macOS/APFS and the `FICLONE` ioctl on Linux (btrfs, XFS with `reflink=1`, bcachefs). It fails rather than silently copying, which is what makes capability detection possible.
- **hardlink** — `fs.link(src, dest)`.
- **copy** — `fs.copyFile(src, dest)`, then `chmod` to the mode derived by `#entryMode`.

Capability is probed once per `(store filesystem, destination filesystem)` pair per process and cached, rather than per file.

To be explicit about what is being ratified versus what ships first: **`auto` is the end-state default this RFC asks reviewers to approve.** The [Implementation](#phasing) section stages its arrival — `copy` first, then `auto` behind an experimental flag, then `auto` by default — but the staging is rollout mechanics, not a competing default.

**Safety rules take precedence over the requested method.** Script-capable packages, patched packages, and restrictive-umask installs (each defined below) materialize with `clone-or-copy` even under an explicit `package-import-method=hardlink`, with a one-line warning naming the package and the reason. An explicit method means "use this wherever eligible", not "use this or corrupt the store". The table's "error if the filesystem cannot …" is the capability check, and it is the only hard failure: if the one-shot probe shows the store→destination pair cannot hardlink (or clone) at all, an explicit `hardlink` (or `clone`) fails the install rather than silently degrading into something indistinguishable from `auto`. Per-package safety fallback warns; whole-filesystem incapability errors.

**Verification is per-materialization, for every method.** Before a blob is used — cloned, hardlinked, or copied — `verify-store-integrity` (default `true`) re-hashes it against its store key. A mismatch quarantines the blob, re-ingests it from the `content-v2` tarball, and continues; only if re-ingest also fails does the install error.

### The shared-mutation hazard

A hardlink shares an inode. If anything writes in place to a file in `node_modules`, it mutates the store blob and, with it, every other project and worktree linked to that blob. Silent cross-project corruption is the single most serious risk in this proposal, and it is the reason blobs are stored read-only.

Three layered mitigations:

1. **Prefer clone.** `auto` tries copy-on-write clone first. A clone is immune: the first write forks a private copy. On APFS, btrfs, XFS, and ReFS this is the path taken and the hazard does not exist.
2. **Read-only blobs.** Where hardlinking is used, the materialized file inherits the blob's read-only mask (`0444`/`0555` in the common case). An in-place write fails loudly with `EACCES` instead of silently corrupting other projects. This is Nix's design lesson.
3. **Never hardlink a package that may run lifecycle scripts.** The predicate is defined by what arborist actually does, not by the allowlist alone — `rebuild.js` runs a node's scripts when `dangerouslyAllowAllScripts || node.isWorkspace || isScriptAllowed(node.target, allowScripts) === true`. So: a package is **script-capable** for a given install when its [RFC 0054](https://github.com/npm/rfcs/pull/868) allowlist entry matches, or when `--dangerously-allow-all-scripts` is set and the package can run install/build scripts — which includes packages that declare none: arborist synthesizes `node-gyp rebuild` for any package shipping a `binding.gyp` (`install-scripts.js`), and those write into their own directory more than most. Script-capable packages — and only those — are materialized with `clone-or-copy`, because a build script legitimately writes into its own directory; under `--dangerously-allow-all-scripts` that conservatively covers every script-declaring or `binding.gyp`-shipping package in the tree. (The `isWorkspace` arm needs no handling: workspaces are symlinked local directories that the store never materializes.) Packages with a `patched` record under [RFC 0053](https://github.com/npm/rfcs/pull/862) are likewise never hardlinked from an unpatched blob; patching produces different content and therefore different blobs.

### This is a behaviour change, and it is the one to argue about

Today, `#entryMode` unconditionally ORs `0o600`. Every file npm extracts is owner-writable. Under `package-import-method=hardlink`, files in `node_modules` become read-only.

That is a real break. Things that write in place to dependency source — `patch-package`, editors used to debug a dependency, a `chmod +x` in a script — will fail with `EACCES`.

The position this RFC takes is that in-place mutation of dependency source was never supported, is precisely the operation that corrupts a shared store, and now has a first-class replacement in `npm patch`. Failing loudly is better than the alternative, which is what pnpm does today: leave the files writable, share the inode, and rely on `verify-store-integrity` to notice afterwards.

Escape hatches, in increasing order of bluntness:

- `package-import-method=clone-or-copy` — full copy-on-write semantics, writable files, no hardlinks.
- `package-import-method=copy` — exactly today's behaviour, with the store still saving ingest time.
- `--no-store` — bypass the store entirely.

Whether `hardlink` belongs in the default `auto` chain for the first major version, or should be opt-in for one cycle, is an open question — see [Unresolved Questions](#unresolved-questions-and-bikeshedding). Note that excluding it makes the feature nearly worthless on ext4, which has no reflink and is what most Linux CI runs on.

### Mode, umask, and mtime

Canonical blob masks are umask-independent by construction. That creates a gap the design must close, and closing it requires being precise about which umask applies. Two masks stack today: npm's `--umask` config (default `0`) is what pacote's `#entryMode` subtracts, and the operating system's process `umask` is applied again when tar creates the file — npm's own config docs state that npm _"does not circumvent"_ the system umask but _"adds the `--umask` config to it"_. The **effective mask** is therefore `configUmask | processUmask`, and under an effective `077` npm today materializes files as `0600`/`0700` — private to the owner. Hardlinking a canonical `0444` blob there would silently widen visibility to group and world.

The rule: **hardlink is eligible for a blob only when the effective mask preserves every bit of that blob's mask** — `(mask & ~effectiveUmask) === mask`. Under the common effective `022` this holds for `0444` and `0555` alike. Under a restrictive effective mask such as `077` or `027` it does not, and npm uses `clone-or-copy` for the install instead, warning once. Clone and copy produce a fresh inode, so they `chmod` to exactly the final mode npm computes today — restrictive-umask users keep their current semantics bit-for-bit, and never share an inode whose mode they cannot accept. (Windows has neither mode bits nor a meaningful `umask`; the [Platform matrix](#platform-matrix) defines the Windows mapping.)

pacote already sets `noMtime: true`, so npm does not preserve tarball mtimes today. Under hardlinking, all links to a blob share one mtime — the ingest time — and it will be identical across projects. Tools that infer staleness from `node_modules` mtimes are already unsound; this makes that unsoundness deterministic rather than incidental.

### Interaction with install strategies

The store is orthogonal to layout. `#extractOrLink` gains a store-backed path; every strategy inherits it:

| Strategy              | Materialized into                               |
| --------------------- | ----------------------------------------------- |
| `hoisted` _(default)_ | `node_modules/<name>`                           |
| `nested`, `shallow`   | the node's resolved path                        |
| `linked`              | `node_modules/.store/<key>/node_modules/<name>` |

Under `linked` the win compounds, because the two features deduplicate on orthogonal axes. `linked` dedupes within a project by package identity — one `.store` entry per `(name@version, subtree-hash)` — but its key is a dependency-graph hash, so the same package resolved against different peer sets gets physically duplicate entries, and nothing is shared across projects. The CAS dedupes by content: those peer-split entries contain byte-identical files and resolve to the same blobs, so `linked`'s one real cost — physical duplication per project and per peer context — becomes metadata. The layout, the lockfile, and the strict-boundary semantics are untouched.

Deliberately, this RFC does not propose a `globallink` strategy. See [Rationale and Alternatives](#alternative-1-a-globallink-install-strategy).

### Relationship to the Global Virtual Store proposal

`linked` + CAS still leaves one per-project cost: each project carries its own `.store` tree of materialized files (~50 MB of metadata per Gutenberg-sized worktree, ~2 GB apparent). A separate proposal, [Global Virtual Store for Linked Installs](https://github.com/npm/rfcs/pull/911), removes that last cost for `linked` projects by moving the projections themselves out of the project, leaving only symlinks behind — roughly 1–2 MB per worktree.

If both proposals were accepted, the composition would be mechanical: the projections that proposal populates by fresh extraction would be materialized from this CAS instead, by the same clone/hardlink/copy rules and the same safety fallbacks — which would also remove the global virtual store's own internal duplication, since peer-split projections of the same package contain byte-identical files and resolve to the same blobs. Its script exclusions, garbage collection, deployment caveats, and trust model are defined there. Without it, `linked` projects keep their per-project `.store`, materialized from the CAS as specified above.

### Interaction with other npm features

- **`package-lock.json`** — unchanged. The store is keyed on the `integrity` value the lockfile already contains.
- **`npm publish` / `npm pack`** — unchanged. The store is never a publish input.
- **`bundleDependencies`** — bundled dependencies arrive inside the parent tarball and are ingested as part of it. No special handling.
- **workspace and `file:` directory dependencies** — symlinked as today. Never ingested: they resolve to mutable local directories with no tarball integrity.
- **`file:` tarball dependencies** (`file:./vendor/foo.tgz`) — eligible. The lockfile records their `integrity`, so they key into the store exactly like registry tarballs.
- **git dependencies** — excluded, and not as a deferral: there is nothing sound to key them on. [RFC 0048](https://github.com/npm/rfcs/pull/525) deliberately stopped storing `integrity` for git dependencies because `npm pack` output is not reproducible across npm and tar versions, so no stable content key exists for the lockfile to pin. Git dependencies follow today's extract path permanently, unless and until pack becomes reproducible — a precondition outside this RFC's control, not a phase of it. Anything else would reintroduce the false-mismatch failures RFC 0048 removed.
- **`packageExtensions`** ([RFC 0055](https://github.com/npm/rfcs/pull/889)) — operates on in-memory manifest metadata before reification and never touches installed bytes. No interaction.
- **`npm ci`** — when every blob for the tree is present, `npm ci` performs no network I/O and no decompression. It creates directories and links.

### `npm store`

| Command                | Behaviour                                                             |
| ---------------------- | --------------------------------------------------------------------- |
| `npm store path`       | Print the resolved store directory                                    |
| `npm store status`     | Blob count, package count, apparent size, actual size, orphan count; covers every store root in the filesystem map |
| `npm store add <pkg>…` | Ingest without installing (CI cache warming)                          |
| `npm store verify`     | Re-hash every blob; quarantine mismatches into `tmp/corrupt/`; report |
| `npm store prune`      | Garbage-collect (below)                                               |

### Garbage collection

pnpm prunes by inode link count. That does not work here, because a copy-on-write clone leaves the link count at 1 — a cloned blob looks unreferenced. Garbage collection is therefore mark-and-sweep over the store's own metadata, in two phases:

1. **Sweep blobs.** Any blob not referenced by any package index is unreachable and is removed immediately. This is exact, not heuristic.
2. **Age out package indexes.** Each index carries `lastImportedAt`, touched on materialization. `npm store prune` removes indexes older than `--max-age` (default 30 days), then re-runs phase 1.

For blobs and package indexes, npm does not track which projects exist, so an exact reference count is not available; age is the honest approximation, and it matches `npm cache`'s existing semantics. Pruning is also always safe there: a materialized project owns its clones and hardlinked inodes, so removing store files can never break an existing `node_modules`.

(The machine-global virtual store proposed separately in [Global Virtual Store](https://github.com/npm/rfcs/pull/911) defines its own exact, registry-based collection for its projections, where live symlinks make aging unsafe; if both proposals land, `npm store prune` runs both collectors under one lock.)

`store.lock` serialises garbage collection against concurrent installs — mandatory, since parallel agents are the motivating workload.

### Cross-filesystem behaviour

Neither `link()` nor `FICLONE` crosses filesystems; both fail with `EXDEV`. If the store and the project are on different filesystems, `auto` degrades to `copy`, which forfeits the entire benefit. pnpm documents this as _"severely inhibiting"_ and creates one store per drive.

A permanent `copy` degradation would quietly disable the feature for anyone whose projects live on a second volume, so npm's behaviour is a single normative sequence:

1. Default `store-dir` is `<cache>/_store`, a sibling of `_cacache`; the resolved store path is `<store-dir>/store-v1`. `store-dir` is configurable per project via `.npmrc`.
2. When the destination filesystem differs from the store's, npm first consults a per-user map of filesystem → store root (in the user's npm state). If that filesystem already has a store, it is used.
3. Otherwise npm provisions one, mirroring pnpm's per-drive behaviour. Location algorithm: walk upward from the project root to the highest ancestor directory that is on the same filesystem **and** writable by the current user, and create `.npm-store/` there. Record the mapping, so every later project on that filesystem reuses this store regardless of where it lives — first writer fixes the location.
4. Only if no writable location exists on that filesystem does npm fall back to `copy`, with a single warning naming the store and the destination filesystem. It does not fail.

The capability probe and the explicit-method error semantics run **against the store actually selected** — an explicit `hardlink` on a second volume errors only if that volume's own store cannot hardlink, not because the default store is on another filesystem. `npm store status` and `npm store prune` operate across every store root in the map. Cross-filesystem installs are handled, not deferred.

### Platform matrix

| Platform                                 | Clone               | Hardlink | Effective `auto` |
| ---------------------------------------- | ------------------- | -------- | ---------------- |
| macOS APFS                               | yes — `clonefile`   | yes      | clone            |
| Linux btrfs / XFS `reflink=1` / bcachefs | yes — `FICLONE`     | yes      | clone            |
| Linux ext4 / overlayfs                   | no                  | yes      | **hardlink**     |
| Windows NTFS                             | no                  | yes      | hardlink         |
| Windows ReFS                             | yes — block cloning | no       | clone            |

Windows notes: creating a hardlink requires no elevation. Creating a _symlink_ does, unless Developer Mode is enabled — which is why arborist uses junctions, and that is unchanged here. ReFS supports block cloning but no hardlinks at all, so the fallback chain must be a chain, not a preference.

The POSIX vocabulary above (`0444`, `umask`, `chmod`, `EACCES`) needs an explicit Windows mapping, since NTFS makes `auto` resolve to hardlink:

- **Read-only.** Windows has no mode bits; Node maps the single NTFS read-only attribute onto the write bits (`fs.chmod` on Windows can change nothing else). A blob written with mode `0444` gets the read-only attribute set. The attribute lives in the file's MFT record, which every hardlink to it shares — so a hardlinked materialization is read-only in every project at once, and an in-place write fails loudly (`EPERM`), the same failure shape as `EACCES` on POSIX.
- **umask eligibility.** `umask` is a no-op on Windows and Node reports no group/other distinctions, so the hardlink eligibility rule passes trivially. There is nothing to leak.
- **Executability.** Windows has no exec bit; executability is determined by file extension. Mask variants are inert there — all variants of a blob materialize identically — but are kept so a single index format serves all platforms.
- **The chmod caveat carries over.** `attrib -r` (or `fs.chmod`) clears the read-only attribute for every link at once. As on POSIX, read-only is accident-protection within a trust boundary, not a security control.

The Windows entries in the test plan are not optional: the mutation-isolation and explicit-method tests must run on NTFS (hardlink path) and ReFS (clone path), not only on POSIX.

### Resolving two open bugs rather than inheriting them

**[npm/cli#7608](https://github.com/npm/cli/issues/7608)** — pacote's tar filter contains `if (/Link$/.test(entry.type)) return false`, so `Link` entries in a published tarball are silently dropped and the installed package is missing files. Ingest must handle `Link` entries by resolving them to the target's blob and recording a second path pointing at the same blob. In a CAS this is the natural representation, and the bug disappears.

**[npm/cli#5951](https://github.com/npm/cli/issues/5951)** — hardlink failure on filesystems that do not support it. The `auto` fallback chain and the one-shot capability probe address this directly.

### Security and the trust boundary

A writable store shared between mutually untrusted consumers is a privilege-escalation surface: a blob poisoned by one consumer is executed by another. `verify-store-integrity` (default `true`) re-hashes a blob before every materialization, which detects corruption but is a time-of-check-to-time-of-use check, not a guarantee.

Therefore, stated plainly and mirroring pnpm's caveat:

> The store assumes all projects sharing it are within the same trust boundary. Do not point a single writable store at mutually untrusted agents, users, or CI tenants.

Read-only blobs are protection against _accidental_ writes, not against malice: code running as the store's owner can `chmod` a blob writable and mutate the shared inode. Within a single trust boundary, accident-protection is exactly what is needed — the realistic failure is a stray build tool or editor, not an attacker. Across trust boundaries it is no protection at all, which is why the caveat above is a hard requirement rather than advice. `GHSA-gmw6-94gg-2rc2` is why an earlier symlink-based central-store workaround was removed from arborist, and it should be considered in review.

### Summary of new surface area

- Configs: `store-dir`, `package-import-method`, `verify-store-integrity`, `--no-store`.
- Command: `npm store` with `path`, `status`, `add`, `verify`, `prune`.
- On disk: `<cache>/_store/store-v1/` (secondary store roots on other filesystems on demand).
- No lockfile change. No registry change. No publish change. No manifest change.

## Rationale and Alternatives

### Alternative 1: a `globallink` install strategy

[npm/rfcs#817](https://github.com/npm/rfcs/issues/817) proposes making `.store` global instead of per-project. Rejected because it conflates layout with materialization. It would deliver deduplication only to users who also accept `linked`'s symlinked, strictly-isolated tree — a large, unrelated behaviour change — while leaving the great majority of projects, which use `hoisted`, with nothing. The CAS proposed here benefits every strategy, and `linked` benefits most, without forcing the pairing.

It also inherits `linked`'s store key, which is a hash of the dependency subtree, not of content. Two projects resolving the same package with different peer sets would not share bytes.

### Alternative 2: cache unpacked tarballs instead of individual files

Keep tarball granularity, but store the _unpacked_ directory once and clone the directory. Simpler, and captures most of the worktree win.

Rejected because it captures none of the cross-package win: the 37.3% file-level duplication measured above is largely _between_ packages — identical `LICENSE` files, `index.d.ts` files, vendored helpers, and above all identical files across _versions_ of the same package. Bumping one patch version of a 100-file package would re-store all 100 files rather than the 1 that changed. File granularity is what makes the store's growth proportional to change rather than to releases.

### Alternative 3: a symlinked global virtual store

pnpm's `enableGlobalVirtualStore`: put symlinks in each worktree pointing at one global tree. This is the cheapest possible option, and it is strictly cheaper than what this RFC proposes.

The difference is worth stating precisely rather than glossing. A symlinked worktree costs one symlink per direct dependency — Gutenberg has 1,593 top-level `node_modules` entries, and 3,000 symlinks measure at 804 KB. A CAS-materialized worktree costs one directory entry and one inode per _file_ — 102,041 of them, measured at ~40–50 MB even when every byte is shared. Five worktrees of Gutenberg therefore land at roughly 1.6 GB under `enableGlobalVirtualStore` versus roughly 1.8 GB under this proposal, and the gap widens by ~40 MB per additional worktree. pnpm wins this comparison, and will continue to.

Rejected as the default anyway, because a symlink is visible. `require.resolve`, `__dirname`, `realpath`, bundler roots, and any tool that compares paths all observe that the file lives outside the project. npm's hoisted layout exists precisely so that tools see a plain directory tree. A hardlink or clone is _invisible_: `node_modules` remains a real directory of real files with correct contents. That property is what allows this RFC to leave the lockfile, the layout, and every consumer of `node_modules` untouched, and it is what a symlinked store cannot offer at any price.

The ~40 MB per worktree is the price of that invisibility. It is 2% of the 2.2 GB it replaces, and it buys compatibility with the entire existing ecosystem of tools that walk `node_modules`.

Rejected as the default — but not dismissed. The symlinked tier is proposed separately as [Global Virtual Store for Linked Installs](https://github.com/npm/rfcs/pull/911), scoped to projects that have already accepted symlink semantics by choosing `install-strategy=linked`. The two proposals are complementary answers for different populations: this RFC for every install strategy with zero layout change, that one for the worktree-heavy `linked` case where ~1 MB worktrees are worth symlinks.

### Alternative 4: copy-on-write only, never hardlink

Ship `clone-or-copy` as the default and never hardlink. Removes the shared-mutation hazard entirely and requires no read-only blobs and no behaviour change.

Rejected as the sole option because ext4 has no reflink, and ext4 (or overlayfs above it) is what the majority of Linux CI and container builds use. Defaulting to `clone-or-copy` would mean the headline feature silently does nothing on the largest single class of installs. It remains available as an explicit setting, and it is the recommended one for anyone who cannot accept read-only files.

### Alternative 5: a FUSE or overlayfs mount

Mount `node_modules` as a union of the store and a writable upper layer. Total deduplication, full writability, no mutation hazard.

Rejected: requires elevated privileges or a daemon, is unavailable on macOS without a kernel extension, is unavailable on Windows, and makes npm's correctness depend on a mount staying alive. That is the wrong dependency for a package manager to take on.

### Alternative 6: do nothing; users who need this can use pnpm

This is the status quo, and it is a coherent position — pnpm solves it well, and RFC 0042 already borrowed pnpm's layout.

Rejected because npm is roughly one small component away from the same capability. The store, the hashing, the integrity model, and the atomic-write machinery all exist in `cacache` today; what is missing is granularity and a link call in `reify`. Requiring users to change package manager to get a deduplicated store — when npm already ships a content-addressed store — is a poor trade, especially now that parallel agents make the cost fall on every developer rather than on monorepo maintainers alone.

## Implementation

### Affected packages

| Package            | Change                                                                                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cacache`          | New `store-v1` sibling: blob read/write, package-index read/write, mark-and-sweep garbage collection, `store.lock`. Existing `content-v2` and `index-v5` untouched. |
| `pacote`           | `Fetcher#extract` gains a store path: ingest-on-miss, materialize-on-hit. `#entryMode` factored out so the store can re-derive modes. Tar `Link` entries handled rather than filtered. |
| `@npmcli/arborist` | `#extractOrLink` routes through the store. Script-capable and `patched` nodes forced to `clone-or-copy` (predicate mirrors `rebuild.js`'s `scriptsAllowed`, including `--dangerously-allow-all-scripts`). `isolated-reifier` materializes `.store` entries from the CAS. |
| `@npmcli/fs`       | `importFile(src, dest, method)` — the clone/hardlink/copy primitive plus the one-shot capability probe.                                                                                |
| `npm` (CLI)        | `npm store` command; `store-dir`, `package-import-method`, `verify-store-integrity`, `--no-store` configs; the filesystem→store map in user state; docs.       |

### Phasing

1. **Store primitives in `cacache`**, behind no user-visible surface. Blob and index read/write, garbage collection, locking. Fully testable in isolation.
2. **`importFile` in `@npmcli/fs`**, with the capability probe and the fallback chain. This is where the platform matrix is exercised.
3. **Ingest and materialize in `pacote`**, with `package-import-method=copy` as the default. At this point the store is live and saves extraction time, and nothing about `node_modules` has changed.
4. **Flip `auto` on**, gated by an experimental config for one minor release, then by default.
5. **`npm store` command and docs.**
6. **Wire `linked` through the CAS.** (If the [Global Virtual Store](https://github.com/npm/rfcs/pull/911) proposal has also landed by this point, its projections can be switched from fresh extraction to CAS materialization in the same step.)

Steps 1 through 3 are independently shippable and independently revertible. Step 4 is the only one that changes observable behaviour. The staging is delivery order for one ratified design — no step depends on a future RFC.

### Tests

- **Blob keying** — identical content at masks `0444`, `0555`, and `0544` produces three distinct blobs; a file that is a `bin` in one package and not in another materializes with the correct mode in each; a tarball entry with header mode `0744` and no `bin` entry round-trips to the mode `#entryMode` computes today.
- **Import methods** — each of `clone`, `hardlink`, `copy` produces byte-identical trees; `auto` selects correctly and falls back on `EXDEV`, `EPERM`, `EMLINK` (link-count exhaustion), and `ENOTSUP`.
- **Mutation isolation** — write to a cloned file; assert the store blob and a second materialization are unchanged. Write to a hardlinked file; assert `EACCES` (POSIX) / `EPERM` (Windows).
- **Restrictive umask** — materialize under `umask 077` and `027`; assert hardlink is refused, `clone-or-copy` is used, and final modes are bit-for-bit what `#entryMode` produces today.
- **Lifecycle scripts** — a script-capable package is never hardlinked; its `postinstall` writes into its own directory and succeeds; the store blob is unchanged. Repeated with `--dangerously-allow-all-scripts`: every script-declaring package falls back to `clone-or-copy`, including a package with a `binding.gyp` and no declared scripts.
- **Patching** — a package with a `patched` record materializes patched content; the unpatched blob is untouched; two projects with the same patch share blobs.
- **Tar `Link` entries** — a tarball containing hardlinks installs all paths ([npm/cli#7608](https://github.com/npm/cli/issues/7608)).
- **Garbage collection** — an unreferenced blob is swept; a referenced blob survives; `prune` under a concurrent install blocks on `store.lock` and neither corrupts.
- **Integrity** — a corrupted blob is detected by `verify-store-integrity` before materialization under each of `clone`, `hardlink`, and `copy`, quarantined, and re-ingested from `content-v2`.
- **Explicit method vs safety rules** — under `package-import-method=hardlink`: a restrictive umask (both `--umask=077` and a process `umask 077`), a script-capable package, and a patched package each fall back to `clone-or-copy` with a warning; on a filesystem where the capability probe shows hardlinking is impossible, the install errors.
- **Every install strategy** — `hoisted`, `nested`, `shallow`, and `linked` produce trees byte-identical to a `--no-store` install of the same lockfile. This is the acceptance test.
- **Composition** — if the Global Virtual Store proposal also lands: projections materialized from the CAS are byte-identical to projections populated by fresh extraction.
- **Worktree scenario** — five materializations of one lockfile; assert actual disk consumed is sub-linear in N on a copy-on-write filesystem.

### Rollout

`package-import-method=copy` is the default through step 3, so the store lands as a pure performance change with no observable difference in `node_modules`. `auto` is enabled behind `--experimental-store` for one minor release, then defaulted in a major. `--no-store` remains permanently as the escape hatch.

## Prior Art

### pnpm

The reference implementation of this idea. Global CAS at `~/Library/pnpm/store` (macOS), `~/.local/share/pnpm/store` (Linux), `~/AppData/Local/pnpm/store` (Windows), versioned. Every file stored once, addressed by hash, hardlinked into `node_modules/.pnpm/`.

`packageImportMethod` defaults to `auto`: _"try to clone packages from the store. If cloning is not supported then hardlink packages from the store. If neither cloning nor linking is possible, fall back to copying."_ This RFC adopts that chain and those names deliberately — the semantics are correct and the ecosystem already knows them.

`verifyStoreIntegrity` (default `true`) re-checks a blob's content before linking. `pnpm store prune` removes blobs with a single reference.

[`enableGlobalVirtualStore`](https://pnpm.io/next/git-worktrees) is pnpm's direct answer to the worktree and parallel-agent workload. It keeps one shared virtual store at `<store-path>/links/`, where each dependency-graph projection (`<hash>/node_modules/<name>`) is hardlinked once from the CAS, and every project's `node_modules` holds only symlinks into it.

That design makes the shared-mutation hazard structurally _worse_, not better, and it is worth understanding how pnpm handles it — because it mostly does not. The files are not read-only. There is no copy-on-write layer. Because every worktree symlinks to the _same_ projection rather than getting its own hardlink farm, an in-place write to a file in one worktree's `node_modules` is immediately visible in all of them — the corruption is live and concurrent, not deferred to the next install. pnpm's [own documentation](https://pnpm.io/global-virtual-store) states the mitigation plainly and it is entirely social: _"The global virtual store and the content-addressable store are shared writable state. Use them only for projects, users, and jobs that trust each other, and protect the store path with filesystem permissions."_

The one place pnpm does address it is build output: `sideEffectsCache` saves a package modified by a lifecycle script as a _separate_, hash-keyed store entry rather than mutating the shared blob, and approved builds route to a distinct built-vs-unbuilt slot hash. Even there the isolation is incomplete — pnpm's own [issue #12302](https://github.com/pnpm/pnpm/issues/12302) documents a `pnpm rebuild` fallback that builds _in place_ inside a shared projection at the wrong hash. This is the exact hazard, open in the reference implementation.

Where this RFC differs: it stores blobs read-only, so an in-place write fails with `EACCES`/`EPERM` instead of silently propagating; it prefers copy-on-write clone over hardlink wherever the filesystem supports it, which makes the hazard physically impossible rather than merely discouraged; and using the script-capable predicate (RFC 0054's allowlist plus the `--dangerously-allow-all-scripts` cases) it never hardlinks a package that is permitted to write to itself in the first place. The trust-boundary caveat still applies to any shared store — this RFC adopts it — but it is the last line of defence here, not the only one.

### bun

`bun install` uses _"the fastest method available — `clonefile` on macOS and `hardlink` on Linux"_ by default, with `--backend` selecting among `hardlink`, `clonefile`, `clonefile_each_dir`, `copyfile`, and `symlink`, and automatic fallback to copy on error. Cache at `~/.bun/install/cache/<name>@<version>`. This confirms that the clone/hardlink/copy chain is viable as a default in a widely used client.

### Yarn Berry

Stores dependencies as normalized zip archives and resolves from them via Plug'n'Play, with no extracted `node_modules` at all. `enableGlobalCache` toggles a shared global cache. When using the `node-modules` linker, `nmMode: hardlinks-global` hardlinks identical files across projects from the global cache — the closest analogue to what this RFC proposes, minus the copy-on-write path.

### Nix

`/nix/store/<hash>-<name>`, immutable and read-only after build. The read-only property is the specific lesson taken here: it converts a shared-store mutation from silent corruption into an immediate, local, obvious failure.

### npm's own `cacache`

Worth stating explicitly as prior art _within_ npm: `content-v2` is already a content-addressable, integrity-verified, atomically-written, sharded blob store. This RFC does not introduce content-addressing to npm. It changes the addressable unit from the tarball to the file, and gives the store a second job.

### RFC 0042: Isolated mode

[RFC 0042](https://github.com/npm/rfcs/pull/436) established `node_modules/.store/<name>@<version>-<subtree-hash>/node_modules/<name>` and the symlinked layout. Its store is per-project, its key is a dependency-graph hash rather than a content hash, and each entry is populated by a fresh extraction. This RFC supplies the missing half: `.store` entries materialized from a machine-global, content-keyed store.

### npm/rfcs#817 and npm/cli#8242

The `globallink` proposal, answered in [Alternative 1](#alternative-1-a-globallink-install-strategy). [npm/cli#8242](https://github.com/npm/cli/issues/8242) was closed with a pointer to this repository; no RFC followed. [Global Virtual Store](https://github.com/npm/rfcs/pull/911), proposed separately, answers that request directly; this RFC addresses the storage problem underneath every install strategy.

## Unresolved Questions and Bikeshedding

- **Should `hardlink` enter the default `auto` chain immediately, or one major later?** Including it from the start is the only way the feature does anything on ext4, and ext4 dominates Linux CI. Excluding it avoids the read-only `node_modules` behaviour change entirely. A middle path is to ship `auto = clone → copy` for one major version and `auto = clone → hardlink → copy` in the next, once `npm patch` adoption has displaced in-place dependency edits. This is a question about the default's timing, not about the design — `hardlink` is in the ratified chain either way.
- **Read-only materialized files: acceptable, or too sharp?** The alternative is pnpm's — writable files, shared inodes, post-hoc detection. This RFC argues that loud failure beats silent corruption, but it is the most user-visible decision here and deserves the most scrutiny.
- **Secondary store directory name.** The location algorithm is normative (highest writable ancestor on the destination filesystem, first-writer-wins via the per-user map), but the directory name `.npm-store` is bikeshed: `.npm/_store`? Something a human can attribute to npm at a glance from `ls -a`?
- **Garbage collection aging.** Aging out package indexes at 30 days is a guess. Should npm instead maintain a registry of project paths at install time, making package-index GC exact, at the cost of recording every project that has ever installed? (The separately proposed Global Virtual Store uses exactly such a registry for its projections, where exactness is mandatory; if it lands, extending its registry to all installs would be the natural implementation.)
- **`verify-store-integrity` scope.** The default is `true` and this RFC specifies verification before every materialization. The open question is whether that is too expensive to keep: re-hashing every blob on a warm store is the dominant remaining cost of `npm ci`. A tiered alternative verifies before `hardlink` — where a corrupted blob also propagates into every future consumer — and skips `clone`/`copy`, where the materialized copy is independent. pnpm verifies unconditionally; bun does not verify at all.
- **Store version and migration.** `store-v1` is versioned in the path, so a future format is a new directory and the old one is pruned by age. Should `npm store prune` remove foreign store versions eagerly, or leave them for the user?
- **Naming.** `package-import-method` is pnpm's name and is precise but long. `store-dir` collides conceptually with `cache`, and `npm store path` printing something under `~/.npm/` may surprise. Is the store a part of the cache, or a peer of it?
- **Interaction with `npm cache clean`.** Does it clear the store? It should probably refuse and point at `npm store prune`, since a store blob may be hardlinked into live projects and removing it would not free the space anyway.
- **Blob hash algorithm.** Reusing `sha512` matches `cacache` and the lockfile. A faster non-cryptographic hash such as BLAKE3 would materially speed ingest of large trees, at the cost of a second hash function and a weaker story about untrusted stores. Is the store a security boundary, or not?
