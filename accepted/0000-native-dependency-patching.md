# Native Dependency Patching

## Summary

Add first-class, install-time patching of installed dependencies to the npm CLI, on parity with `pnpm patch`, `yarn patch`, and `bun patch`. This RFC proposes a new `npm patch` command with four subcommands (`add`, `commit`, `ls`, `rm`), a new top-level `patchedDependencies` field in `package.json`, an additive change to `package-lock.json` that records a hash of every applied patch, and an apply pipeline integrated into Arborist's reify step so that patches apply uniformly across every supported `install-strategy` (`hoisted`, `nested`, `shallow`, and `linked`).

## Motivation

The need to apply small, local modifications to installed dependencies is a well-established pattern in the JavaScript ecosystem: bug fixes for an unmaintained dependency, security hotfixes while waiting for upstream, removing or replacing problematic install banners, vendoring a minor behavioural tweak without forking the package. pnpm, yarn (Berry), and bun all ship native support for this workflow. npm does not.

In the absence of a native feature, npm users rely on the third-party [`patch-package`](https://www.npmjs.com/package/patch-package) tool, which has served the community well for many years but is no longer actively maintained and has accumulated a number of structural limitations that npm's own architecture can solve more cleanly.

### Concrete pain points with the status quo

1. **Declared patches silently disappear under `--ignore-scripts`.** `patch-package` is driven by a `postinstall` lifecycle script (the recommended setup is `"postinstall": "patch-package"`). Whenever lifecycle scripts are disabled — via `npm install --ignore-scripts`, `ignore-scripts=true` in `.npmrc`, or organisational policy — patches are not applied at all, with no error and no warning. Production code can be installed missing the fixes that are declared and committed in the project. Disabling lifecycle scripts is increasingly adopted in hardened CI / high-security environments, in part as a response to recent supply-chain incidents:
   - The [`Shai-Hulud` npm worm (Sept 2025)](https://www.reversinglabs.com/blog/shai-hulud-worm-npm) and its [Shai-Hulud 2.0 escalation (Nov 2025)](https://securitylabs.datadoghq.com/articles/shai-hulud-2.0-npm-worm/) spread by injecting malicious `postinstall` (and later `preinstall`) scripts into compromised packages. By Nov 2025, ~795 packages with a combined ~100M weekly downloads had been affected ([Wiz analysis](https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack), [Snyk write-up](https://snyk.io/articles/npm-security-best-practices-shai-hulud-attack/)). One common defensive response is to disable lifecycle scripts by default and re-enable them only for audited packages.
   - npm itself documents [`--ignore-scripts` and `ignore-scripts=true`](https://docs.npmjs.com/cli/v11/using-npm/config#ignore-scripts) as first-class config; the more security-conscious a project is, the more likely it is to use them.

   A native solution in the install pipeline is independent of lifecycle scripts and therefore composable with `--ignore-scripts` — you get declared patches **and** a hardened install posture, instead of having to choose. Reproducible, source-controlled dependency hotfixes that survive `--ignore-scripts` is the headline outcome of this RFC.

2. **`patch-package` does not work with npm workspaces.** Because `patch-package` walks `node_modules/<pkg>` paths and npm hoists workspace dependencies to the root, patches declared inside a workspace member fail to apply. See [ds300/patch-package#277](https://github.com/ds300/patch-package/issues/277).

3. **`patch-package` does not work with `install-strategy=linked`.** The `linked` (isolated) strategy stores packages under `node_modules/.store/<name>@<version>-<hash>/node_modules/<name>/` and symlinks them into consumers. `patch-package` looks at the symlink path, not the real location, and aborts. See [ds300/patch-package#595](https://github.com/ds300/patch-package/issues/595).

4. **`patch-package` is unmaintained.** As a community-driven workaround blocking adoption of modern npm features, this is no longer a stable foundation for the ecosystem.

### Use cases (drawn from prior art)

- **Hotfix while waiting for upstream**: a CVE is reported in a transitive dependency. The fix is in `main` upstream but unreleased. A team can apply a unified diff today, commit it to source control, and remove it once a release ships.
- **Bug fix in an unmaintained dependency**: rather than forking and publishing a `@scope/foo` rename (with all the ongoing maintenance of ownership, renames, and ecosystem fragmentation), apply a tiny diff.
- **Local debugging**: edit a dependency in place, capture the diff, share it with collaborators via Git for reproducibility.
- **Removing install-time noise**: deterministic patches against postinstall banners, telemetry hooks, or unwanted side-effects.

### Why this is the right shape now

A previous proposal, [npm/rfcs#94 ("Allow customizing packages on install", Jan 2020)](https://github.com/npm/rfcs/issues/94), was closed with two well-founded objections from @isaacs:

> What happens when the patch doesn't apply?
>
> This feels like one hell of a footgun. I have deep misgivings about supporting it.

That proposal advanced an ad-hoc CLI flag (`npm install --patch foo.patch core-js`) with no manifest record, no lockfile linkage, no transitive-dep support, and no failure-mode story. The objections were correct for that shape.

This RFC differs in every dimension:

- Patches are declared explicitly in `package.json` — no hidden state.
- Each applied patch records its `sha512` in `package-lock.json` — drift is detectable on every install and `npm ci`.
- The apply step **fails loudly by default** when a registered patch does not apply or does not match any resolved package; opt-out flags (`--allow-unused-patches`, `--ignore-patch-failures`) are explicit.
- Patches apply to the **resolved** package by `name@version`, so transitive dependencies (the cases that matter most) are addressed uniformly, not just direct installs.
- A patched package surfaces visibly in `npm ls`, `npm audit`, and tooling output, so reviewers can see at a glance that a tree contains project-local modifications.

Native patching has since shipped in pnpm, yarn (Berry), and bun, all with broadly converging shapes. That doesn't _prove_ the 2020 footgun concern was wrong — concerns about long-tail abuse don't dissolve because other tools accepted the trade-off — but it does show the feature can be designed safely. The 2020 framing was specific to the shape of that proposal, not inherent to native patching.

[RFC #868](https://github.com/npm/rfcs/pull/868), approved in parallel with this RFC, establishes that **imperative install-time code execution by dependencies is a supply-chain risk and should be opt-in by default**. It does not break `patch-package`'s root-`postinstall` workflow directly — root scripts are out of #868's scope — but it does mark the direction of travel: install-time effects should be declarative, auditable, and locked. `patchedDependencies` is the same idea applied to dependency *code modifications*: a declarative, lockfile-hashed mechanism that sits in the install pipeline itself instead of in a `postinstall` script.

## Detailed Explanation

### Commands

All operations live under `npm patch <subcommand>`, matching the mixed-register subcommand shape npm already uses (`npm cache add/clean/verify/ls`, `npm team create/destroy/add/rm/ls`) — short forms `ls` and `rm` for the read/remove cases, full verbs `add` and `commit` for the actions that take an argument and produce side effects.

The bare form `npm patch <pkg>` is a shorthand for `npm patch add <pkg>` because that is the most common entry point. `npm patch` with no arguments prints help (it does **not** list patches — use `npm patch ls`). This follows npm CLI precedent: `npm pkg`, `npm cache`, and `npm team` all print help when invoked with no subcommand.

**Disambiguation.** The bare form `npm patch <arg>` is parsed as follows: if `<arg>` is exactly one of `add`, `commit`, `ls`, or `rm`, it is treated as a subcommand; otherwise it is treated as a package selector and routed to `npm patch add <arg>`. A package literally named `add` (or any other subcommand name) must be referenced via the explicit form `npm patch add add`. This mirrors the existing rule that `npm install install` is how you would install a hypothetical package called `install`.

**Help.** `npm patch --help` and `npm help patch` both render the full subcommand list and flags. Per-subcommand help (`npm patch add --help`, etc.) is also provided.

#### `npm patch add <pkg>[@<version>]`

Prepares a package for editing.

1. Resolves `<pkg>[@<version>]` against the current install (or registry if a version is provided that is not in the tree). If the version is omitted, the resolved version from the current tree is used; if more than one resolved version of `<pkg>` is present, the command lists each `name@version` with the path of its first dependant and asks the user to re-run with an exact selector (e.g. `npm patch add lodash@4.17.21`). It does not silently pick one.
2. Rejects non-registry resolutions explicitly: `file:`, `link:`, `git:`, `http(s):` tarball, and workspace-relative resolutions cannot be patched — they have no canonical "original" tarball to diff against, and a patched workspace package is just an edit to the workspace. The error directs the user to edit the source directly. (See "Non-registry dependencies" below.)
3. Extracts a clean copy of the package tarball into a temporary edit directory **outside** `node_modules` (default: `<os.tmpdir()>/npm-patch/<pkg>@<version>-<random>`).
4. Prints the path to stdout, e.g.:

   ```
   $ npm patch add lodash@4.17.21
   You can now edit the following directory: /var/folders/.../npm-patch/lodash@4.17.21-XYZ
   When done, run: npm patch commit /var/folders/.../npm-patch/lodash@4.17.21-XYZ
   ```

The edit directory is intentionally outside `node_modules` to avoid the trap that bites bun's earlier designs and `patch-package`'s edit-in-place workflow: editing under `node_modules/` mutates the local cacache contents and bleeds into other projects, and is also fragile under `linked` mode where `node_modules/<pkg>` is a symlink into the content-addressed store.

Flags:

- `--edit-dir <path>`: override the temp directory.
- `--ignore-existing`: discard a previous unfinished edit and start fresh.

#### `npm patch commit <edit-dir>`

Finalises a patch.

1. Diffs `<edit-dir>` against the original tarball contents (using the same extraction performed by `npm patch add`).
2. Writes a unified diff to `<patches-dir>/<name>@<version>.patch` (default `./patches/`, configurable — see below).
3. Adds an entry to `patchedDependencies` in the project's root `package.json`:

   ```json
   {
     "patchedDependencies": {
       "lodash@4.17.21": "patches/lodash@4.17.21.patch"
     }
   }
   ```

4. Cleans up the temp edit directory (unless `--keep-edit-dir`).
5. Updates `package-lock.json` to record the patch's `sha512` against every node that the patch resolves to (see "Lockfile" below).

Flags:

- `--patches-dir <dir>`: override the destination directory for this invocation.
- `--keep-edit-dir`: do not remove the edit directory after committing.

#### `npm patch ls`

Lists currently registered patches with their resolved targets:

```
$ npm patch ls
patches/lodash@4.17.21.patch        lodash@4.17.21        (1 node)
patches/express-trust-proxy.patch   express@4.18.2,4.18.3 (2 nodes)
patches/types-fix.patch             react                 (matched 0 nodes — error)
```

Useful for auditing which patches are active and which are unused before an install.

#### `npm patch rm <pkg>[@<version>]`

Reverses a patch.

1. Removes the matching key(s) from `patchedDependencies`.
2. Deletes the corresponding `.patch` file **only if** no other key in `patchedDependencies` references the same path (preserving the shared-diff use case described below).
3. Updates `package-lock.json` to drop the patch hash.

If `<version>` is omitted, all entries for `<pkg>` are removed.

### Manifest: `patchedDependencies`

`patchedDependencies` is a new top-level object in `package.json`. It maps a dependency selector to a path-relative-to-the-project-root pointing at a unified-diff file:

```json
{
  "name": "my-app",
  "patchedDependencies": {
    "lodash@4.17.21": "patches/lodash-fix-cve-2024-12345.patch",
    "lodash@4.17.20": "patches/lodash-fix-cve-2024-12345.patch",
    "is-buffer@^2.0.0": "patches/is-buffer-strict-mode.patch",
    "react": "patches/react-debug.patch"
  }
}
```

#### Selector forms and match priority

A selector is one of:

1. `name@<exact-version>` — exact semver match, highest priority.
2. `name@<range>` — any valid npm version range.
3. `name` — matches every resolved version of `name`.

When applying patches to a resolved tree, npm picks the **most specific** matching selector for each node, in this fully-specified order:

1. **Exact** (`name@1.2.3`) wins over any range or name-only selector.
2. Among **range** selectors that match: the selector whose range is a strict subset of the others (per `semver.subset`) wins. If subset ordering is not total — e.g. two ranges overlap but neither is a subset (`>=1.0.0 <2.0.0` vs `>=1.5.0 <3.0.0` for `1.7.0`) — the install **errors** and prints both candidates. The user must add an exact `name@version` entry to disambiguate. npm does not silently pick a "winner" by lexical order, hash, or registration time.
3. **Name-only** (`name`) is the fallback only if no range matches.

Each node accumulates **at most one** patch. Stacking multiple patches on the same resolved node is explicitly out of scope for this RFC; if needed in the future, it would be additive (e.g. an array value for the selector) and is called out in "Unresolved Questions".

#### Shared diff for multiple selectors

The same `.patch` file may appear as the value of multiple keys. This covers the very common case where several pinned versions of a dependency contain identical buggy lines:

```json
{
  "patchedDependencies": {
    "express@4.18.2": "patches/express-trust-proxy.patch",
    "express@4.18.3": "patches/express-trust-proxy.patch"
  }
}
```

When `npm patch rm express@4.18.3` is invoked, the file is preserved because `4.18.2` still references it. When the last reference is removed, the file is deleted.

#### Workspaces

`patchedDependencies` is honoured **only in the root `package.json`** of a project (or workspace root). This mirrors `overrides`, which arborist already loads only from the root ([`workspaces/arborist/lib/arborist/load-actual.js`](https://github.com/npm/cli/blob/latest/workspaces/arborist/lib/arborist/load-actual.js) passes `useRootOverrides: true` for workspace members). A `patchedDependencies` entry declared in a workspace member's `package.json` is a **hard error** during install — a stricter rule than the silent-ignore that `overrides` uses today, motivated by the greater consequence of an ignored patch. The check is performed by walking workspace members via [`@npmcli/map-workspaces`](https://github.com/npm/map-workspaces) during build-ideal-tree.

The single-source-of-truth model has two practical consequences for monorepo authors:

1. **Authoring**: `npm patch add <pkg>@<version>` run from a workspace member writes the entry and patch file to the **root** manifest and root `<patches-dir>/`, not the member. The CLI prints the resolved destination so the user is not surprised.
2. **Ownership / review**: a single `CODEOWNERS` rule on `/patches/**` and a root `package.json` change is sufficient to gate every patch review, regardless of which workspace member depends on the patched transitive. This matches how `overrides` and `dependencies` are already audited in large monorepos.

If a workspace member legitimately needs a per-member patch (e.g. a trial fix that should not affect siblings), the right tool is `overrides` to a published fork, not `patchedDependencies`.

This is also how pnpm v10 handles it (via `pnpm-workspace.yaml`).

### Storage

Default location: `<project-root>/patches/`.

A new config key, `patches-dir`, overrides this:

```ini
# .npmrc
patches-dir = .npm/patches
```

Patch files are plain unified diffs (POSIX `diff -u`-compatible, also applyable by `git apply`). Filenames default to `<name>@<version>.patch`. For scoped packages, the leading `@scope/` becomes a subdirectory inside `<patches-dir>`, so `npm patch commit` creates the directory if it does not exist. Examples:

```
patches/lodash@4.17.21.patch
patches/@babel/core@7.23.0.patch    # patches/@babel/ created automatically
```

The path stored in `patchedDependencies` is the literal relative path including any subdirectories — `npm` does not perform any encoding, hashing, or sanitisation of the filename, so the on-disk layout is exactly what the user sees in `package.json` and the lockfile.

### Lockfile

`package-lock.json` (and `npm-shrinkwrap.json`) is extended additively. Each node that has a patch applied gains two fields:

```json
{
  "node_modules/lodash": {
    "version": "4.17.21",
    "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
    "integrity": "sha512-...",
    "patched": {
      "path": "patches/lodash@4.17.21.patch",
      "integrity": "sha512-..."
    }
  }
}
```

`patched.path` is the relative path from the project root. `patched.integrity` is the SSRI hash of the patch file's contents.

This bumps `lockfileVersion` from `3` to `4` ([`workspaces/arborist/lib/shrinkwrap.js`](https://github.com/npm/cli/blob/latest/workspaces/arborist/lib/shrinkwrap.js) defines the current default and the parse path supports forward-version detection). The bump is the load-bearing safety mechanism: an older npm reading a v4 lockfile with any `patched` record **must error and abort the install**. A warn-only fallback is explicitly rejected — it would let an older CLI silently install unpatched code from a project that declares patches, which is exactly the regression this RFC is built to prevent. A v4 lockfile with **no** `patched` records anywhere remains safe to install under older clients; the abort only kicks in when a patch is present.

> Note: this RFC deliberately does **not** rely on a per-package `engines.npm` floor. npm CLI today validates `engines.node` at startup ([`lib/cli/validate-engines.js`](https://github.com/npm/cli/blob/latest/lib/cli/validate-engines.js)) but does not enforce `engines.npm` at install time, so a manifest floor would be advisory at best and would not stop an older CLI from proceeding. Lockfile-version gating in arborist's shrinkwrap read path is the only mechanism that actually fails closed.

When a patch file's contents change, its `sha512` changes, and the lockfile must be regenerated — `npm ci` refuses to proceed if the recorded hash and the on-disk hash diverge. This eliminates the "patches drifted silently in CI" failure mode that plagues `patch-package` users.

### Apply pipeline

Patches are applied during Arborist's `reify` step, after each package's tarball has been extracted to its destination ([`workspaces/arborist/lib/arborist/reify.js`](https://github.com/npm/cli/blob/latest/workspaces/arborist/lib/arborist/reify.js) calls `pacote.extract(res, node.path, …)` inside `#extractOrLink()`) but before the `rebuild()` phase fires any `preinstall` / `install` / `postinstall` scripts ([`workspaces/arborist/lib/arborist/rebuild.js`](https://github.com/npm/cli/blob/latest/workspaces/arborist/lib/arborist/rebuild.js) gates each `#runScripts()` call on `!this.options.ignoreScripts`). That gap is the seam patches occupy.

This makes patching:

- **Layout-agnostic**: the patch is keyed by resolved `name@version`, not by `node_modules` path. It works identically under `hoisted`, `nested`, `shallow`, and `linked` (see below).
- **Independent of lifecycle scripts**: `--ignore-scripts` does not disable patch application, because patches are not scripts.
- **Available for transitive dependencies**: not just top-level installs.

#### Strict apply, no fuzz

Patches are applied with fuzz factor 0 by default. If the surrounding context lines have changed (e.g. because the resolved version was silently bumped without updating the patch), the install fails with a descriptive error pointing at the offending hunk.

#### `linked` install-strategy: side-store

Under `install-strategy=linked`, packages live under `node_modules/.store/<name>@<version>-<hash>/node_modules/<name>/` and are symlinked into consumers — the exact path built by [`workspaces/arborist/lib/arborist/isolated-reifier.js`](https://github.com/npm/cli/blob/latest/workspaces/arborist/lib/arborist/isolated-reifier.js), where `<hash>` is a base64-encoded shake256 of the dependency tree. Patching mutates content; if we naively patched the store entry, every project that shared that entry would inherit the mutation.

Instead, when a node has a `patched` record, npm materialises it under a side-store key derived from `(packageIntegrity, patchIntegrity)`:

```
node_modules/.store/<name>@<version>-<packageIntegrity>+patch-<patchIntegrity>/node_modules/<name>/
```

The key is content-addressed, so:

- Two consumers in the same install that resolve to the same `(packageIntegrity, patchIntegrity)` pair share the same side-store entry — patched copies dedupe identically to unpatched copies.
- Consumers that resolve to the unpatched `name@version` continue to symlink to the original `<name>@<version>-<packageIntegrity>` entry. No mutation leaks across projects.
- Changing the patch contents changes `patchIntegrity`, which produces a new side-store key. The old patched entry becomes unreferenced.

Cleanup: `npm install` and `npm ci` walk `node_modules/.store/` after reify and prune any side-store entries that are not referenced by the current ideal tree, in the same pass that prunes unreferenced unpatched entries today. `npm cache clean` removes both kinds. There is no separate patched-store lifecycle.

#### Failure modes

The default for every patch-related failure is **hard error, abort the install**. There is no quiet path for a declared patch to fail to apply.

- **Patch fails to apply** (context drift, missing target file, hunk mismatch): hard error.
- **Registered patch matches no installed package** (typo, package removed by an `npm uninstall`, etc): hard error.
- **Patch file declared in manifest but missing on disk**: hard error.
- **Lockfile records a patch hash that does not match the on-disk patch file**: hard error.

Two **CLI-only** flags exist to cover legitimate one-off cases:

- `npm install --allow-unused-patches`: temporarily install a tree in which a registered patch matched nothing (e.g. mid-upgrade where a pinned version no longer exists). Does not silence apply-failures.
- `npm install --ignore-patch-failures`: temporarily install a tree even if a patch fails to apply, with a loud warning per failure. Intended for incident response (e.g. roll back a regression while re-authoring a patch).

Neither flag is honoured from `.npmrc`, environment variables, or `engines`. They must be passed on every invocation that needs them. The intent is to make a relaxed posture impossible to set as project-default policy: a CI environment that wants laxness has to write the flag into the install command itself, where it is visible in code review.

`npm ci` rejects both flags entirely. CI installs are always strict.

### Non-registry dependencies

Patches target a registry tarball as their "original", so the diff has a stable baseline. For non-registry dependency types this baseline does not exist or is not reproducible across machines:

| Dependency type            | Behaviour                                                                                                                                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm:` (registry alias)    | Supported. The aliased registry tuple is used as the baseline; the selector is keyed on the alias name.                                                                                                                     |
| `file:` (local tarball)    | Rejected by `npm patch add` with a clear error. The user already controls the source; edit it directly.                                                                                                                     |
| `link:` / workspace member | Rejected. Workspace members are project source code, not vendored dependencies — edit the source.                                                                                                                           |
| `git:` / `github:`         | Rejected in the initial RFC. The "original" would be a specific commit, which is reproducible, but the workflow is significantly more complex (shallow clones, submodules, build steps) and is deferred to a follow-up RFC. |
| `http(s):` tarball         | Rejected. No integrity guarantee equivalent to registry tarballs; see future work.                                                                                                                                          |

Rejection means: `npm patch add <pkg>` exits non-zero with a message explaining why, pointing at the source-edit alternative. An entry in `patchedDependencies` whose resolved type is one of the rejected categories above is also a hard error at install time.

### `optionalDependencies`, `peerDependencies`, deprecated packages

- **`optionalDependencies`**: a patched optional dependency that fails to install for environment reasons (platform, CPU, etc.) is treated exactly as today — the optional install is skipped, the unused-patch check tolerates this case for nodes that were never installed, and no error is raised.
- **`peerDependencies`**: peers are not separately resolvable; they are the consumer's own dependency. A patch on a package that is also a peer applies to the resolved instance once, exactly like any other shared dep. There is no peer-specific behaviour.
- **Deprecated packages**: deprecation is a registry warning, not a resolution change. Patches on deprecated packages work normally; `npm ls` and `npm audit` show both the deprecation warning and the `[patched: ...]` annotation. Patching is in fact one of the better responses to a transitive deprecation that has no published successor yet.

### `npm publish` and `npm pack`

`patchedDependencies` is consumer-side state. A package being published to a registry must never carry it: doing so would either silently leak project-local edits to consumers (if the field were honoured) or look like a configuration error to anyone reading the published tarball.

Therefore:

- `npm publish` and `npm pack` **strip** `patchedDependencies` from the manifest written into the tarball. This is a stronger guarantee than `devDependencies` (which is left in the tarball but ignored by consumers) because `patchedDependencies` has install-time effects and would actively confuse consumers if it survived publish.
- The `patches/` directory is **not** included in the published tarball by default. If the user has explicitly added it via `files` in `package.json`, `npm pack` removes it with a warning.

This makes the field safe to introduce: there is no path by which patches travel through the registry.

### Visibility

A patched package is marked in user-visible output:

```
$ npm ls lodash
my-app@1.0.0
└── lodash@4.17.21 [patched: patches/lodash-cve.patch]
```

`npm audit` includes a `patched` flag in its JSON output for any node with a `patched` record, so security tooling can distinguish vendored modifications from advisories on the registry version.

### Summary of new surface area

| Surface          | New                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Commands         | `npm patch add`, `npm patch commit`, `npm patch ls`, `npm patch rm` (plus `npm patch <pkg>` shorthand for `npm patch add <pkg>`) |
| Manifest fields  | `patchedDependencies` (auto-stripped by `npm publish` / `npm pack`)                                        |
| Lockfile fields  | `patched.path`, `patched.integrity`                                                                        |
| Lockfile version | bumped to `4`; older clients **error** on v4 lockfiles containing patches                                  |
| Config           | `patches-dir` (config); `--allow-unused-patches`, `--ignore-patch-failures` (CLI-only flags, never config) |
| Output           | `[patched: ...]` annotation in `npm ls`; `patched: true` in `npm audit --json`                             |

## Rationale and Alternatives

### Alternative 1: Continue relying on `patch-package`

Status quo. Rejected because:

- Unmaintained.
- Broken with workspaces ([ds300/patch-package#277](https://github.com/ds300/patch-package/issues/277)).
- Broken with `install-strategy=linked` ([ds300/patch-package#595](https://github.com/ds300/patch-package/issues/595)).
- Silently no-ops under `ignore-scripts`, which is a recommended security posture and increasingly the default in CI environments.
- Cannot be hashed into the lockfile, so patch drift is invisible to `npm ci`.

### Alternative 2: Republish forks via `overrides` to a renamed package

Already supported (RFC 0036). For some teams this is genuinely the right tool and not a workaround:

- Organisations with an internal registry (Verdaccio, JFrog, Nexus, GHE Packages) can publish a `@org/foo` fork, route it via `overrides`, and benefit from the registry's existing audit/compliance/SLO infrastructure.
- Compliance regimes (SOX, FedRAMP, etc.) sometimes require every artifact in the supply chain to be a versioned, signed registry tarball. A loose `.patch` file in the repo does not meet that bar; a republished fork does.
- Long-lived vendor patches that ship across multiple consuming projects benefit from being a real package: one publish, many consumers, normal version resolution.

For these cases, `overrides` + a republished fork is the _correct_ answer and this RFC does not displace it.

What `overrides` + a fork does _not_ serve well:

- Tiny, ephemeral fixes (one-line change, gone in two weeks).
- Projects without internal-registry infrastructure or willingness to take on package ownership.
- The "I want this fix in my repo, code-reviewable in this PR" workflow.

So `overrides` and `patchedDependencies` are complementary: `overrides` swaps a dependency wholesale and is the right answer when the change wants to be a published artifact; `patchedDependencies` modifies a dependency in place and is the right answer when the change wants to live next to the consumer's source.

### Alternative 3: Introduce a sidecar config file (`npm-workspace.yaml`-equivalent)

This was the council's most-debated question. pnpm v10 moved `patchedDependencies` out of `package.json` into `pnpm-workspace.yaml`.

Rejected for this RFC because:

- npm has no analogous file today; introducing one purely to host patches is disproportionate.
- The user-facing benefit pnpm cited (consolidating workspace-only config out of a publishable manifest) is real but warrants its own cross-cutting RFC. `patchedDependencies` should not block on it.
- Multiple keys → same patch path already covers the "one diff for several deps" requirement without a new file.

If a future RFC introduces a workspace config file, `patchedDependencies` can migrate as part of that change. Nothing in this design precludes it.

### Alternative 4: Match by resolved tarball integrity instead of `name@version`

Considered. Would make patch matching independent of version strings and robust against version-string spoofing. Rejected because the resulting ergonomics are poor: users would have to copy SSRI hashes into `package.json` keys, which are unreadable and not git-friendly. The `name@version` model is what pnpm/yarn/bun all use, and it composes correctly when paired with lockfile hashes recording the resolved integrity downstream.

### Alternative 5: Embed the patched resolution into the lockfile (yarn-style)

Yarn Berry stores patches as a `patch:` URL inside the resolution itself:

```
"left-pad@^1.3.0": "patch:left-pad@1.3.0#./.yarn/patches/left-pad-...patch"
```

This is elegant in yarn's locator-driven model. For `package-lock.json`'s nested-tree model it is awkward: locators are implicit in path structure, not explicit URLs. A side-by-side `patched` field is more idiomatic and easier to read in PR diffs.

## Implementation

Affected repositories and packages. All implementation now lives under the `npm/cli` monorepo and a small set of supporting `npm/*` packages. The previously-separate `npm/arborist` repository was archived and its code moved to `npm/cli/workspaces/arborist`.

- **[`npm/cli`](https://github.com/npm/cli)** — top-level CLI:
  - new `npm patch` command with subcommands `add`, `commit`, `ls`, `rm`
  - new config (`patches-dir`) and CLI-only flags (`--allow-unused-patches`, `--ignore-patch-failures`)
  - `npm ls` / `npm audit` annotations
  - `npm/cli/workspaces/arborist` (formerly the `npm/arborist` repo): read `patchedDependencies` during build-ideal-tree; attach patch records to nodes during reify; apply patches to extracted trees; honour the side-store layout under `install-strategy=linked`
  - `npm/cli/workspaces/libnpmpack`, `npm/cli/workspaces/libnpmpublish`: strip `patchedDependencies` from the manifest written into the output tarball; exclude `<patches-dir>/` from the tarball
- **[`npm/pacote`](https://github.com/npm/pacote)**: helper to materialise a clean tarball into the temp edit directory (already supported via `pacote.extract`).
- **[`npm/cacache`](https://github.com/npm/cacache)**: no changes.
- **[`npm/ssri`](https://github.com/npm/ssri)**: no changes (used as-is for patch integrity).
- **[`npm/package-json`](https://github.com/npm/package-json)**: schema awareness of the `patchedDependencies` field for read/write helpers used by `npm patch commit` and `npm patch rm`.
- **[`npm/map-workspaces`](https://github.com/npm/map-workspaces)**: detect a `patchedDependencies` entry in a workspace member's `package.json` so the install-time hard error can cite the offending workspace.
- **[`docs.npmjs.com`](https://github.com/npm/documentation)**: command pages, config page, lockfile schema, plus a migration guide from `patch-package`.

Tests:

- Round-trip: `npm patch add` → edit → `npm patch commit` → `npm install` → patched files present.
- Shorthand routing: `npm patch <pkg>` is equivalent to `npm patch add <pkg>`; subcommand-name shadowing (`npm patch add` is the subcommand, `npm patch add add` reaches a package literally named `add`).
- Each `install-strategy` value: `hoisted`, `nested`, `shallow`, `linked`. The `linked` test must verify that (a) an unrelated project sharing the global cache does **not** see the patched copy and (b) two consumers in the same project sharing `(packageIntegrity, patchIntegrity)` dedupe to one side-store entry.
- Workspaces: patch declared at root applies to a transitive dep used only by a workspace member; patch declared in a workspace member's manifest **errors**.
- `npm ci` with a tampered patch file → fails with hash mismatch.
- `npm install --ignore-scripts` → patches still apply.
- Selector priority: exact, range, name-only resolution; ambiguous overlapping ranges must error.
- Failure modes: failed apply, unused patch, missing patch file, with and without `--allow-unused-patches` / `--ignore-patch-failures` on `npm install`; `npm ci` rejects both flags.
- Lockfile migration: v3 → v4 bump; older client encountering v4 with `patched` records errors; v4 without `patched` records installs cleanly under older clients.
- `npm publish` / `npm pack`: `patchedDependencies` stripped from the output tarball; `patches/` excluded from the output tarball.
- Non-registry deps: `file:`, `link:`, workspace, `git:`, `http(s):` — `npm patch add` errors with the documented message.
- `optionalDependencies`: skipped optional patched dep does not trigger unused-patch error; installed optional patched dep applies the patch.

Implementation rollout. The entire feature ships **atomically in a single npm release** — no part of it is allowed to lag behind the others, because every "almost finished" intermediate state is a vector for the silent-skip and silent-leak failure modes this RFC exists to prevent. The atomic deliverable is:

- CLI commands: `npm patch add`, `npm patch commit`, `npm patch ls`, `npm patch rm` (plus the bare `npm patch <pkg>` shorthand for `add`).
- Manifest field: `patchedDependencies` (root-only; hard error in workspace members).
- Lockfile schema: `patched.{path,integrity}` per node, `lockfileVersion: 4`, with `npm ci` enforcing hash match and older clients erroring on v4 lockfiles that contain patch records.
- Apply pipeline for **all four** supported `install-strategy` values — `hoisted`, `nested`, `shallow`, and `linked` — at the same seam in arborist's reify step. `linked` uses the content-addressed side-store key `(packageIntegrity, patchIntegrity)` described in [`linked` install-strategy: side-store](#linked-install-strategy-side-store) and is treated as a first-class target, not a follow-up.
- Publish path: `npm publish` and `npm pack` strip `patchedDependencies` and exclude `<patches-dir>/`.
- Visibility: `[patched: …]` in `npm ls`, `patched: true` in `npm audit --json`.

Implementation work can be parallelised across these surfaces during development, but no single surface ships in a release without the others.

## Prior Art

### pnpm

[`pnpm patch`](https://pnpm.io/cli/patch), [`pnpm patch-commit`](https://pnpm.io/cli/patch-commit), [`pnpm patch-remove`](https://pnpm.io/cli/patch-remove). Stores entries in `pnpm.patchedDependencies` in `package.json` (pre-v10) or `patchedDependencies` in `pnpm-workspace.yaml` (v10+). Hashes patch contents into the lockfile. Match priority is exact > range > name-only. Configurable via `--patches-dir`. `allowUnusedPatches` and `ignorePatchFailures` settings (since v10.7.0).

The pnpm model is the closest to this proposal and the primary inspiration. The differences in this RFC:

- Stays in `package.json` (until npm has a workspace config file).
- Adds a side-store strategy under `linked`, which pnpm gets for free because every install is content-addressed.
- Supports multiple keys → same patch path explicitly.

### Yarn Berry

[`yarn patch`](https://yarnpkg.com/cli/patch), [`yarn patch-commit`](https://yarnpkg.com/cli/patch-commit), [Patching feature page](https://yarnpkg.com/features/patching). Patches are encoded into the `resolutions` field via the `patch:` protocol. Patches stored under `.yarn/patches/` by default.

Yarn's design is elegant for a locator-driven resolver but does not translate directly to npm's nested-tree lockfile.

### Bun

[`bun patch`](https://bun.com/docs/install/patch). Stores entries in a top-level `patchedDependencies` field in `package.json` — directly the shape proposed here. Match by exact `name@version` only. Patches in `patches/` by default.

Bun's edit flow (un-link from cache, edit in place under `node_modules/<pkg>`) is good DX but creates the cache-pollution risks this RFC's external-temp-dir model avoids.

### `patch-package`

[`ds300/patch-package`](https://github.com/ds300/patch-package). The de-facto solution for npm and Yarn v1 today. Driven by a postinstall script. Limitations enumerated under "Motivation". Has been the foundation for community education on the pattern, and its filename convention (`name+version.patch`) is the closest precedent to this RFC's storage.

### npm/rfcs#94 — direct response

The 2020 proposal, [npm/rfcs#94 ("Allow customizing packages on install")](https://github.com/npm/rfcs/issues/94), was closed by @isaacs with the following objections. This RFC addresses each one:

| 2020 objection                                                                | This RFC's response                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The motivating use case (donation banners) was being phased out by `funding`. | The motivating use cases here are concrete and unchanged: `patch-package` is broken with workspaces and `install-strategy=linked`, depends on a `postinstall` script that the post-Shai-Hulud security posture disables, and is unmaintained.                                                                                                                                                                                               |
| "What happens when the patch doesn't apply?"                                  | Hard error, install aborts. Strict apply, fuzz factor 0. The two relax-flags are CLI-only (never `.npmrc`/env), and `npm ci` rejects them entirely — there is no way to set "lax" as a project default.                                                                                                                                                                                                                                     |
| "This feels like one hell of a footgun."                                      | Patches are explicit (manifest entry, no `--patch` CLI flag), audited (lockfile hash with `npm ci` enforcement), version-gated (older npm errors on a v4 lockfile with patches), publish-isolated (`npm publish` strips the field), and visible (`npm ls`/`npm audit` annotation). The footgun in #94 was an un-tracked `--patch foo.patch` flag with no manifest, no lockfile, no failure mode — every dimension of which this RFC closes. |
| The original proposal could not patch transitive dependencies.                | This RFC patches by resolved `name@version`, applying anywhere in the tree.                                                                                                                                                                                                                                                                                                                                                                 |
| "Registry-side tools that float patches… not an ideal fit for the cli."       | Project-local patches solve a different problem from registry-side floats: they don't require registry mutation, work for unpublished/unmaintained deps, and stay inside the project's source-controlled boundary.                                                                                                                                                                                                                          |

## Unresolved Questions and Bikeshedding

1. **Patches directory path**. `patches/` matches `patch-package`, pnpm, and bun. Is there an objection to occupying that name at the project root? Alternative: `.npm/patches/`.
2. **Interaction with `overrides`**. Patches apply to the **resolved** version after override resolution. If `overrides` swaps `foo@1` → `foo@2`, a `patchedDependencies["foo@1"]` entry becomes unused and errors under default settings — which seems correct, but confirms that overrides + patches require coordinated edits. Is the "patch the resolved version" rule the right composition order in every case, or should range selectors be evaluated against the pre-override identity?
3. **`npm audit fix` + patches**. If a patch is the only thing keeping a transitive dep secure, should `npm audit fix` refuse to upgrade away from the patched version, or upgrade and require the user to re-author the patch? Strawman: refuse, with `--force` to upgrade.
4. **Exclude `package.json` from the diff by default?** `patch-package` does this because version bumps make patches non-portable. Carry the default forward, with `--include-package-json` to override.
5. **Globs in selectors?** e.g. `"@types/*": "patches/types-fix.patch"`. Useful for monorepos with many similar deps; potential footgun for typo-driven over-application. Strawman: not in v1.
6. **Stacking patches**. Should multiple patches be applicable to a single resolved node (selector value as an array)? Out of scope for v1 but additive if needed later.
7. **Git dependencies**. Deferred. A future RFC could add patching for `git:` deps with commit-pinned baselines.
