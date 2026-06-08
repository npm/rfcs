---
title: Make install scripts opt-in
number: 54
status: accepted
created: 2026-06-08
accepted_at: 2026-06-08
implemented_at: null
withdrawn_at: null
implementation: null
---
# Make install scripts opt-in

## Summary

Dependency install scripts (`preinstall`, `install`, `postinstall`, and auto-detected `node-gyp` builds) should be blocked by default during `npm install`. Projects opt in to running scripts for specific dependencies by listing them in a new `allowScripts` field in `package.json`. An `npm approve-scripts` command helps users build and maintain this allowlist.

This proposal aligns npm with pnpm (v10+), Yarn Berry, and Bun, all of which already block dependency install scripts by default.

## Motivation

### The security case

Install scripts execute arbitrary shell commands the moment a package is installed. Unlike application code, which must be explicitly imported and run, install scripts fire automatically as a side effect of `npm install`.

Attackers have exploited this repeatedly:

- **event-stream (November 2018)**: A social engineering attack added a malicious `postinstall` dependency (`flatmap-stream`) targeting a specific Bitcoin wallet application.
- **Lazarus Group campaigns (2024-2025)**: North Korean state-sponsored actors ran sustained campaigns publishing typosquatted packages (`is-buffer-validator`, `react-event-dependency`, and others) with `postinstall` scripts that deployed the BeaverTail malware and InvisibleFerret backdoor, stealing browser credentials and cryptocurrency wallet data. [Source](https://www.bleepingcomputer.com/news/security/north-korean-lazarus-hackers-infect-hundreds-via-npm-packages/)
- **chalk, debug, and 17 other packages (September 2025)**: A phished maintainer account was used to inject Web3 wallet-draining code into 19 packages with over 2 billion combined weekly downloads. The payload was delivered via `postinstall` scripts in packages that had never needed install scripts before. [Source](https://www.ox.security/blog/npm-packages-compromised/)
- **Shai-Hulud worm (September 2025)**: A self-replicating `postinstall` payload compromised 500+ npm packages by stealing maintainer tokens and automatically publishing infected versions of the victim's other packages. CERT/CC issued advisory [VU#534320](https://www.kb.cert.org/vuls/id/534320). [Source](https://www.stepsecurity.io/blog/ctrl-tinycolor-and-40-npm-packages-compromised)
- **Axios (March 2026)**: Attackers hijacked the lead maintainer of Axios (100M+ weekly downloads) and published versions containing a "phantom dependency" that existed solely to trigger its `postinstall` hook, deploying a cross-platform RAT. The malicious package was never imported in Axios source code. [Source](https://www.trendmicro.com/en_us/research/26/c/axios-npm-package-compromised.html)

### Install scripts are a distinct threat class

A common response is "you're going to run the code anyway." But install scripts are different from application code in several ways that matter:

1. Install scripts run without any `require()` or `import`. They fire just by being in the dependency tree. This means they can attack systems that never intend to run the package's code at all: frontend-only projects, build machines, CI pipelines.

2. Install scripts may run under different privileges than the application. The widespread use of `--unsafe-perm` as a troubleshooting fix means many environments run install scripts as root.

3. Many organizations trigger `npm install` automatically in response to pull requests. Install scripts are often the only code execution surface on build machines that otherwise only compile and bundle.

4. A typo like `npm install canvsa` triggers the install script immediately, before the developer can notice the mistake and cancel. Without install scripts, the typosquatted package would sit inert until explicitly imported.

5. Adding a dependency to `package-lock.json` in a pull request is easy to miss: GitHub hides large lock file diffs by default, and few reviewers read them carefully. The install script runs the next time anyone runs `npm install`, without the attacker getting any application code reviewed.

6. Process sandboxing, import policies, and code review all target runtime code. None of them cover code that runs during installation.

### The ecosystem has moved on

When this RFC was first proposed in 2021, a common objection was that too many packages depend on install scripts, particularly native addons that compile via `node-gyp`. Since then, the ecosystem has shifted to prebuilt platform-specific binaries distributed via `optionalDependencies`:

- esbuild -> `@esbuild/linux-x64`, `@esbuild/darwin-arm64`, etc.
- SWC -> `@swc/core-linux-x64-gnu`, `@swc/core-darwin-arm64`, etc.
- Sharp -> `@img/sharp-linux-x64`, etc.
- Rollup -> `@rollup/rollup-linux-x64-gnu`, etc.
- lightningcss, Biome, oxc: all follow this prebuild pattern.

[Node-API](https://nodejs.org/api/n-api.html) provides ABI stability across Node.js versions, making prebuilt binaries viable without recompilation. The packages that still require install scripts are a small minority and getting smaller.

### npm is the last holdout

Every other major JavaScript package manager already blocks dependency install scripts by default:

| Package manager | Default behavior                                                   | Since                           |
|-----------------|--------------------------------------------------------------------|---------------------------------|
| pnpm            | Blocked; allowlist via `allowBuilds` in `pnpm-workspace.yaml`      | v10 (January 2025)              |
| Yarn Berry      | Blocked; per-package opt-in via `dependenciesMeta.built`           | v2 (2020)                       |
| Bun             | Blocked (except ~400 default-trusted); `trustedDependencies` array | Since install support was added |
| Deno            | Blocked; per-package opt-in via `--allow-scripts=<packages>`       | Since npm compat was added      |
| npm             | Runs all scripts by default                                        | —                               |

npm is the only one that still runs everything by default.

## Scope

This RFC covers the following lifecycle scripts when they are defined by dependencies (not the root project):

- `preinstall`
- `install`
- `postinstall`
- Auto-detected `binding.gyp` files (which trigger implicit `node-gyp rebuild`)
- `prepare` (for non-registry sources only: git dependencies, local file/link dependencies)

The following are out of scope:

- Scripts defined in the root project's `package.json` (these always run, as they are under the developer's direct control)
- Lifecycle scripts triggered by explicit user action (`test`, `start`, `stop`, `restart`, `publish`, etc.)
- Registry-level changes (2FA requirements, package signing, provenance attestations)
- Runtime code isolation or sandboxing

## Detailed Explanation

### Design overview

The design is modeled on pnpm v10's `allowBuilds` system, adapted for npm conventions:

1. A new `allowScripts` field in `package.json` declares which dependencies are permitted to run install scripts.
2. A new `npm approve-scripts` command writes allowlist decisions to `package.json` from the command line.
3. Dependency install scripts not covered by the allowlist are blocked, with a clear warning and remediation instructions.
4. A phased rollout allows the ecosystem to migrate gradually.

### The `allowScripts` field

A new top-level field in `package.json` maps package name patterns to `true` (allowed) or `false` (denied):

```json
{
  "allowScripts": {
    "canvas": true,
    "sharp": true,
    "core-js": false,
    "nx@21.6.4 || 21.6.5": true
  }
}
```

The field uses three values:

| Value   | Behavior                                          |
|---------|---------------------------------------------------|
| `true`  | Install scripts are permitted                     |
| `false` | Install scripts are blocked silently (no warning) |
| Absent  | Install scripts are blocked with a warning        |

This three-value design (allow / deny / unreviewed) matches pnpm's `allowBuilds` semantics. The distinction between `false` and absent is important: `false` means "I have reviewed this package and decided it does not need scripts," while absent means "this package has not been reviewed yet."

Package entries may include version constraints using the `@` separator:

```json
{
  "allowScripts": {
    "sharp": true,
    "nx@21.6.4 || 21.6.5": true,
    "sqlite3@5.1.7": true
  }
}
```

A name-only entry (e.g., `"sharp": true`) allows all versions. A versioned entry (e.g., `"nx@21.6.4 || 21.6.5": true`) restricts the allowance to specific versions, using exact versions joined by `||`. Semver ranges like `^`, `~`, `>=`, or `<` are not supported. This is intentional: a range like `nx@<21.6.4` would automatically trust future versions that haven't been reviewed, which defeats the purpose of an allowlist. If both a name-only entry and a versioned entry exist for the same package, the versioned entry takes precedence for matching versions.

This matches pnpm's `allowBuilds` design, which also restricts versioned entries to exact versions with `||` disjunction.

If overlapping versioned entries assign different values to the same resolved version (for example, `"pkg@1 || 2": true` and `"pkg@2 || 3": false` both match version `2`), the `false` value wins. Deny-wins is the safer default; users who want a specific version allowed despite an overlapping deny should narrow the deny entry.

Non-registry dependencies (git, file, tarball) use [`package-spec`](https://docs.npmjs.com/cli/v11/using-npm/package-spec) syntax. See [Identity matching](#identity-matching) below for the supported key forms.

The `allowScripts` field is only read from the root project's `package.json` (or workspace root). `allowScripts` fields in dependency `package.json` files are ignored. This is a consumer-side policy, not a publisher declaration.

### Identity matching

Package names in npm are not a trustworthy identity for security policy. Each `allowScripts` key is matched against a node's resolved identity from the lockfile, not against the package's self-reported name.

Two ecosystem flaws make name-based matching unsafe:

1. The npm alias mechanism. `npm install trusted@npm:naughty` installs `naughty` under the folder `node_modules/trusted`. In the resulting tree, `node.name` is `"trusted"` (the alias / folder name) and `node.package.name` is `"naughty"` (the tarball's self-report). An allowlist that matched on either field would let an attacker bind a malicious package to a trusted name by getting it installed via an alias.

2. Manifest confusion. The npm registry does not validate that a published tarball's internal `package.json` matches the manifest the registry serves. (Disclosed [March 2023](https://blog.vlt.sh/blog/the-massive-hole-in-the-npm-ecosystem); unfixed as of 2026.) A package published as `naughty` can ship a tarball whose `package.json` declares `name: "trusted"`. After install, `node.package.name` is `"trusted"` regardless of where the tarball came from.

Both problems apply to any allowlist that matches by package name, including a map-based one. The fix is to match against the lockfile's `resolved` field, which is set by the resolver, not by the tarball.

#### What the key matches against

Keys are parsed with [`npm-package-arg`](https://github.com/npm/npm-package-arg), the same parser that handles `npm install <spec>` and `package.json` dependency entries. The parsed spec is matched against each node's resolved identity, recorded in `package-lock.json`:

| Dependency type         | Resolved identity                                                                                                                                     |
|-------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| Registry (version)      | `name@version` (e.g. `sharp@0.34.0`)                                                                                                                  |
| Registry (range)        | `name` matches any resolved version; `name@version` matches exactly                                                                                   |
| Alias                   | The underlying registered package, not the alias. `npm install trusted@npm:naughty@1.0.0` matches against `naughty@1.0.0`, never `trusted`.           |
| Git                     | The resolved git ref (e.g. `npm/cli#c12ea07`). A name-only entry like `"npm/cli"` permits any resolved commit of that repository.                     |
| File / tarball / folder | The resolved URL or path (e.g. `https://example.com/foo.tgz`, `file:./vendor/foo`).                                                                   |

Examples:

```json
{
  "allowScripts": {
    "sharp": true,
    "sharp@0.34.0": true,
    "sharp@0.33.2 || 0.33.3 || 0.34.0": true,
    "npm/cli": true,
    "npm/cli#c12ea07": true,
    "@myorg/internal-tool": true
  }
}
```

A name-only entry permits any resolved version or commit: `"npm/cli": true` matches any commit of that repository just as `"npm": true` matches any version of the package. A fully-qualified entry (`"npm/cli#c12ea07"`, `"sharp@0.34.0"`) pins exactly one.

Three implementation notes follow from the table. For registry-resolved deps, the matcher uses `name@version` rather than the full `resolved` URL. This handles the `omitLockfileRegistryResolved` config (a user setting that omits `resolved` for registry packages from the lockfile). For git deps, the key's committish (the part after `#`) is matched as a prefix of the resolved full SHA: `"npm/cli#c12ea07": true` matches a node resolved to `git+ssh://git@github.com/npm/cli.git#c12ea07a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e`. Users typically write short SHAs; the resolver always pins to the 40-character commit hash. For file, tarball, and remote URL deps, the `resolved` value is matched as an exact string.

#### Fields the key MUST NOT match against

Implementations MUST NOT match keys against:

- `node.name` (the install location / folder name)
- `node.package.name` (the tarball's self-reported `package.json#name`)
- `node.package.version` (the tarball's self-reported `package.json#version`)
- `node.package.repository` (self-reported and unverified)

All four are attacker-controllable through manifest confusion or alias installs. The lockfile's `resolved` field, set by the resolver from the registry response or the user's git/tarball/file spec, is the only field set independently of the tarball.

#### `npm rebuild <name>` follows the same rule

The `<name>` argument to `npm rebuild` also selects nodes by resolved identity, not by folder name or self-reported `package.json#name`. `npm rebuild bcrypt` rebuilds the registry-resolved `bcrypt` and never a bundled `node_modules/bcrypt` folder that some other package shipped under that name. Bundled nodes are excluded from rebuild for the reasons given in [Bundled dependencies](#bundled-dependencies).

#### Forward compatibility with a query selector grammar

The key syntax above is forward-compatible with npm's existing [dependency selectors](https://docs.npmjs.com/cli/v11/using-npm/dependency-selectors) (`npm query`). Today, only package-specs are accepted as keys. If a future arborist version exposes a trustworthy queryable identity (see Unresolved Questions), the same key position could accept full selector syntax (`":root > .prod"`, `":type(git)"`, etc.) alongside today's bare-name and `name@spec` keys. The bare-name keys would then read as sugar over a name-equality selector against the identity field.

The full selector grammar is intentionally out of scope. Today's `#name` and `[name=...]` selectors match against `node.name` and `node.package.name`, which the identity rule above excludes. Shipping a selector-based allowlist before arborist has a trustworthy queryable identity would inherit the same exposure; extending the query engine to add one is a design effort of its own. [RFC #861](https://github.com/npm/rfcs/pull/861) reached the same conclusion ("the query language has no trustworthy package identity").

### Policy layering

Script permissions are resolved from a single layer in the precedence chain below (highest to lowest). Layers are **not** merged:

1. CLI flags (`--allow-scripts`, `--no-scripts`, `--dangerously-allow-all-scripts`)
2. Project `package.json` (`allowScripts` field)
3. Project `.npmrc` (`allow-scripts` setting)
4. User `.npmrc`
5. Global `.npmrc`

The first layer that defines any allowlist configuration wins for the entire install; lower-precedence layers are not consulted at all. This avoids surprising merge semantics where, for example, a project `package.json` entry for one version is silently augmented by a `.npmrc` entry for another. If a project sets `"allowScripts": { "sharp@0.34.0": true }` in `package.json` and the installed version resolves to `0.35.0`, the install fails the way any other unmatched-version case fails — regardless of what `.npmrc` says.

The `.npmrc` setting is intended for contexts without a project `package.json` `allowScripts` field at all, such as `npm install -g` and `npx`:

```ini
; ~/.npmrc
allow-scripts = canvas, sharp, sqlite3
```

### The `npm approve-scripts` command

A new command writes approval decisions to the `allowScripts` field in `package.json`:

```sh
# Approve specific packages
npm approve-scripts canvas sharp

# Approve all packages with pending scripts
npm approve-scripts --all
```

Approved packages are written with `true`, and newly approved packages are immediately rebuilt. Denial is a separate command, [`npm deny-scripts`](#the-npm-deny-scripts-command), described below.

`--pin` controls only how approvals are written. Denials are always recorded name-only (`"pkg": false`), since pinning a denial to a specific version would silently allow a future version to run scripts again. This is intentional: pinning is conservative for approve and permissive for deny, so the asymmetry favours the safer default in both directions.

When an entry for a package already exists in `allowScripts` and the installed version differs, the command's behaviour depends on the shape of the existing entry. Single-version pins are auto-rewritten to track the installed version; multi-version statements (`pkg@a.b.c || x.y.z`) are never modified, since they likely capture user intent the command can't infer; entries for removed packages are left alone; and existing `false` entries always win:

| Existing entry                | Installed version             | `--pin=true` (default)                              | `--pin=false`                                       |
|-------------------------------|-------------------------------|-----------------------------------------------------|-----------------------------------------------------|
| `pkg: true`                   | (none, package removed)       | no edit                                             | no edit                                             |
| `pkg@a.b.c: true`             | (none, package removed)       | no edit                                             | no edit                                             |
| `pkg@a.b.c: true`             | `pkg@x.y.z`                   | rewrite to `pkg@x.y.z: true`                        | rewrite to `pkg: true`                              |
| `pkg: true`                   | `pkg@x.y.z`                   | upgrade to `pkg@x.y.z: true`                        | leave as `pkg: true`                                |
| `pkg@a.b.c \|\| d.e.f: true`    | `pkg@x.y.z`                   | add `pkg@x.y.z: true`                               | add `pkg: true`                                     |
| `pkg@a.b.c \|\| x.y.z: true`    | `pkg@x.y.z` (already covered) | no edit                                             | no edit                                             |
| (no entry)                    | `pkg@a.b.c` and `pkg@x.y.z`   | write both pinned                                   | write `pkg: true`                                   |
| `pkg: false`                  | any                           | no edit (existing deny wins)                        | no edit (existing deny wins)                        |
| `pkg@a.b.c: false`            | `pkg@x.y.z`                   | no edit; `pkg@x.y.z` remains unreviewed, with a warning | no edit; `pkg@x.y.z` remains unreviewed, with a warning |

Pinned deny entries (`pkg@a.b.c: false`) are not auto-rewritten when the package version changes, since that would either silently re-allow or silently re-deny the new version. The currently-installed version is left unreviewed and the command prints a warning suggesting the user run `npm deny-scripts pkg` (to re-deny name-only) or remove the pinned deny entirely.

The deny-wins conflict rule from the [allowScripts field](#the-allowscripts-field) section applies here too: an existing `false` entry is never overwritten by `--all`. Users who want to flip a deny to an approve must edit the entry by hand.

List packages with install scripts that are not yet covered by the resolved policy, without writing any changes:

```
$ npm approve-scripts --pending
The following packages have install scripts that are not approved:

  canvas (postinstall: node-gyp rebuild)
  sharp (install: node install/libvips && ...)

To approve them, run: npm approve-scripts
```

`--pending` consults the same precedence stack as install-time enforcement (CLI flag → root `package.json` → project `.npmrc` → user `.npmrc` → global `.npmrc`), so the listed packages match what would be blocked during a real install.

### The `npm deny-scripts` command

The companion command to `npm approve-scripts`. Writes `"pkg": false` entries into `allowScripts`:

```sh
# Deny specific packages
npm deny-scripts core-js telemetry-pkg
```

Denied entries are always recorded name-only, regardless of `--pin`. See the [approve-scripts section](#the-npm-approve-scripts-command) for the reasoning.

The two commands share implementation. Splitting them avoids the `!`-prefix syntax used by pnpm (`pnpm approve-builds !core-js`), which conflicts with shell history expansion in zsh and bash and forces users to single-quote arguments. A pair of clearly-named commands also reads better in scripts and CI configuration.

### Enforcement behavior

The policy is a tri-state per package:

- `true`: install scripts run.
- `false`: install scripts are silently skipped.
- absent: install scripts run (Phase 1 default) and a post-install advisory warning lists the package so users can review it. In a future major release this default flips to skip-with-warning.

In strict mode (`strict-allow-scripts=true`), the install fails before any scripts run if any dependency has install scripts that aren't covered by a `true` or `false` entry. The `--dangerously-allow-all-scripts` flag bypasses the policy and runs every install script.

The `--allow-scripts` CLI flag is restricted to one-off and global contexts (`npm exec`, `npx`, `npm install -g`). Passing it during a project-scoped `npm install`, `ci`, `update`, or `rebuild` is an error: team-wide policy belongs in `package.json#allowScripts` or `.npmrc`, not in a command-line flag that gets copy-pasted into READMEs.

The existing `--ignore-scripts` flag continues to work as before, disabling all scripts (including root project scripts) regardless of `allowScripts`.

### Affected commands

The script policy is enforced by the following commands:

| Command                  | Behavior                                 |
|--------------------------|------------------------------------------|
| `npm install` / `npm ci` | Enforce `allowScripts` policy            |
| `npm rebuild`            | Enforce `allowScripts` policy            |
| `npm install -g`         | Enforce policy from user/global `.npmrc` |
| `npx` / `npm exec`       | Enforce policy from user/global `.npmrc` |
| `npm update`             | Enforce `allowScripts` policy            |

### Workspaces

In a workspace (monorepo) context:

- The root `package.json` `allowScripts` field is the single source of truth for the entire workspace.
- `allowScripts` is read from the workspace root's `package.json` (the project containing the `workspaces` array) regardless of where the user runs `npm install`. Running it from inside a sub-workspace like `packages/foo/` does not bypass the root policy.
- Individual workspace `package.json` files do not have their own `allowScripts` fields. All script permissions are managed at the root.
- If `allowScripts` appears in a non-root workspace `package.json`, npm prints a warning and ignores the field. Silently dropping it would be confusing for developers who placed it there expecting it to do something.
- This avoids ambiguity about merge semantics and ensures security policy is set in one place.

### Optional dependencies

If a package in `optionalDependencies` has install scripts that are not allowed, npm still installs the package and skips only its scripts, exactly as it would for a regular dependency. The package is not treated as a failed optional dependency. Packages that use install scripts to optimize themselves but still function without them keep working when listed in `optionalDependencies`.

The existing failed optional dependency behavior is unchanged. It applies when a script that is allowed to run exits non-zero, or when the package fails to extract. In those cases npm drops the optional dependency from the tree, the same as it does now. A script that the `allowScripts` policy skips never runs, so it cannot trigger that path.

### Bundled dependencies

Bundled dependencies are packages shipped inside a parent package's tarball. The lockfile marks them with `inBundle: true`, but they have no independent `resolved` URL because they were never fetched on their own.

Install scripts of bundled dependencies never run. They are not counted as pending or unreviewed, so they do not trip `strict-allow-scripts`, and they cannot be added to `allowScripts`. This matches pnpm, which also ignores scripts of bundled dependencies.

A package that needs a bundled dependency's install script to run must forward it as one of its own lifecycle scripts. That forwarded script is then subject to the same `allowScripts` policy as any other dependency's, matched by the parent package's resolved identity. The folder names inside the parent's bundled `node_modules` are never used for matching, so a bundled folder that calls itself `bcrypt` cannot borrow the real `bcrypt`'s approval.

## Rationale and Alternatives

### Why not keep `--ignore-scripts` as-is?

The existing `--ignore-scripts` flag is all-or-nothing: it disables scripts for every package including the root project. This makes it impractical for projects that need some packages to build (e.g., `sharp` for image processing) while blocking scripts from the rest of the dependency tree. A per-package allowlist solves this.

### Why not use 2FA requirements instead?

Several commenters on the original RFC suggested requiring 2FA for all publishers as an alternative. 2FA reduces the risk of account takeover, but it does not address:

- Token theft from CI systems (automated publishing uses tokens, not 2FA)
- Insider threats (a legitimate maintainer can publish a malicious version)
- The fact that install scripts run code during installation, before any human reviews the published content

2FA and install script controls address different parts of the supply chain. They work well together but neither replaces the other.

### Why not a runtime sandbox?

Sandboxing install scripts (restricting file system or network access) is worth exploring separately, but it is a harder problem with more compatibility risk. An allowlist is simpler: if a package isn't on the list, its scripts don't run. Both approaches can coexist.

### Why not malware scanning?

Scanning packages for malicious code is useful but reactive: it depends on someone identifying the threat after publication. The allowlist approach works the other way around. Unknown or unreviewed packages simply cannot run install scripts, whether or not they have been scanned.

### Why a map instead of an array?

Bun uses a `trustedDependencies` array of package names. pnpm's `allowBuilds` uses a map. The map approach is better because:

- It supports explicit denial (`false`) vs. unreviewed (absent), enabling a clear audit trail.
- It accommodates version pinning as a key in the map entry.
- It is extensible to future per-package configuration if needed.

### Why not lockfile-based change detection?

An earlier draft proposed a lockfile-based check that would compare `package-lock.json`'s existing `hasInstallScript` boolean against fetched packages, blocking the script when a package previously without scripts gained them — even if the package had a name-only `allowScripts` entry. That mechanism was removed for two reasons.

First, version-pinned entries already cover the same case more cleanly. With `npm approve-scripts` defaulting to `--pin=true`, a version bump produces a resolved identity that no longer matches the existing entry. The install fails through the normal `allowScripts` path and the user re-approves explicitly. No separate detection layer is needed.

Second, the lockfile-based check fires only on the `false → true` transition. It does not catch the more dangerous case of a package that already had scripts shipping a malicious update — exactly the case that the September 2025 attacks (chalk, debug, Shai-Hulud follow-ons) actually exploited. Adding a layer that catches the narrow case but not the dangerous one risks creating a false sense of security.

The simpler design (exact identity match against `allowScripts` with version-pinning by default) provides equivalent protection in the case the lockfile check was meant to cover, and the broader expressiveness of `--pin=false` remains available for teams that prefer name-only entries with the trade-off documented.

## Implementation

### npm CLI changes

The primary enforcement point is in the `@npmcli/run-script` and `@npmcli/arborist` packages:

1. `@npmcli/arborist`: During the `reify` step, before running lifecycle scripts for each dependency, check the resolved package name and version against the root project's `allowScripts` field. If the package is not allowed, skip its scripts and record it in a "blocked scripts" list.

2. `@npmcli/run-script`: Add an `allowed` check that consults the policy stack (CLI flags -> `package.json` -> `.npmrc`). When a script is blocked, emit a warning (or error in strict mode) with the package name, script name, and remediation command.

3. `npm approve-scripts` and `npm deny-scripts` (new commands): both share implementation. They read the current `node_modules` tree (from `package-lock.json` or disk), identify packages with install scripts not yet in `allowScripts`, and route to a common writer that respects the asymmetric pin rule (approved entries honour `--pin`; denied entries are always name-only). `approve-scripts` has three operating modes:

    - Write (positional arguments and `--all`): uses only the existing `read` package and `proc-log` input primitives, which are already in the CLI. No new dependencies required.
    - Read-only preview (`--pending`): consults the resolved policy stack (CLI flag → root `package.json` → project `.npmrc` → user `.npmrc` → global `.npmrc`) and walks the resolved tree from `package-lock.json` or disk. Prints packages whose install scripts are not yet covered. The walker must call `isNodeGypPackage(node.path)` at runtime in addition to checking `hasInstallScript` from the lockfile. Packages with a `binding.gyp` file but no explicit `install`/`preinstall`/`postinstall` script have `hasInstallScript: false` in the lockfile, but arborist injects a synthetic `node-gyp rebuild` install script for them at install time. A lockfile-only walker would miss these. No state is persisted. It's a query of the present tree, not a record of past blocks.
    - `deny-scripts` (separate command): same writer path, restricted to producing `false` entries. Always name-only regardless of `--pin`.

### Configuration

New `.npmrc` settings:

| Setting                         | Type                 | Default | Description                                                                                                                  |
|---------------------------------|----------------------|---------|------------------------------------------------------------------------------------------------------------------------------|
| `allow-scripts`                 | Comma-separated list | (empty) | Packages allowed to run install scripts. Valid only for `npm exec` / `npx` / `npm install -g`; rejected in project installs. |
| `strict-allow-scripts`          | Boolean              | `false` | When `true`, packages with install scripts that aren't covered by `allowScripts` cause the install to fail before scripts run. |
| `dangerously-allow-all-scripts` | Boolean              | `false` | When `true`, bypass `allowScripts` entirely and run every install script (escape hatch).                                     |

## Prior Art

### Package managers

- [pnpm v10](https://pnpm.io/settings#allowbuilds) (`allowBuilds` map in `pnpm-workspace.yaml`, `pnpm approve-builds` interactive CLI, `strictDepBuilds`, `dangerouslyAllowAllBuilds`). This is the primary model for this RFC. pnpm also ships related supply chain features: `minimumReleaseAge` (delay installing newly published versions), `trustPolicy` (fail on trust level downgrade), and `blockExoticSubdeps` (restrict transitive git/tarball sources).
- [Yarn Berry](https://yarnpkg.com/configuration/yarnrc#enableScripts) (`enableScripts: false` in `.yarnrc.yml`, per-package `dependenciesMeta.built` in `package.json`). Yarn was the first major package manager to default scripts off (v2, 2020). Its per-package control is in `package.json`, but there is no interactive approval command.
- [Bun](https://bun.sh/docs/install/lifecycle) (`trustedDependencies` array in `package.json`, ~400 hardcoded default-trusted packages, `bun pm trust` and `bun pm untrusted` CLI commands). Bun's default-trusted list reduces migration friction but creates a security surface: any compromise of a default-trusted package affects all Bun users.
- Deno: Blocks npm lifecycle scripts by default. Per-package opt-in via `deno install --allow-scripts=npm:sqlite3`. Also has an unstable `--minimum-dependency-age` flag.

### Community tools

- [@lavamoat/allow-scripts](https://www.npmjs.com/package/@lavamoat/allow-scripts): Manages an allowlist in `package.json`, runs via `npm install --ignore-scripts && npx allow-scripts`.
- [can-i-ignore-scripts](https://www.npmjs.com/package/can-i-ignore-scripts): Scans `node_modules` and categorizes packages by whether their install scripts can be safely skipped. Useful as a migration assessment tool.

### Related npm RFCs

- [RFC #861](https://github.com/npm/rfcs/pull/861): "Add option to require install script approval." Originally proposed an opt-in JSON allowlist; rewritten in April 2026 to use [npm query](https://docs.npmjs.com/cli/v11/using-npm/dependency-selectors) selectors, which exposed the trustworthy-identity gap addressed in [Identity matching](#identity-matching) above. The author plans to close #861 in favor of this RFC; the identity rule here borrows directly from their analysis ("the query language has no trustworthy package identity"). This RFC supersedes #861 with default-deny semantics and a map syntax that is forward-compatible with a future selector grammar.
- [RFC #92](https://github.com/npm/rfcs/pull/92): "Add staging workflow for CI and human interoperability." A publish-side security proposal (closed without implementation).

## Migration Plan

### Phase 1: Enforcement for opt-in entries; advisory for unlisted (next minor release)

- Ship `npm approve-scripts` and `npm deny-scripts` (with `--pending` mode for previewing on `approve-scripts`).
- Recognise the `allowScripts` field in `package.json`.
- `true` entries run scripts; `false` entries silently skip them. Both do exactly what the user wrote.
- Packages with install scripts that aren't covered by an `allowScripts` entry still run as before, with a post-install advisory warning. Nothing changes for anyone who hasn't opted in.
- `strict-allow-scripts=true` and `--dangerously-allow-all-scripts` are wired up and enforce as described above.
- `--allow-scripts` CLI flag is rejected in project-scoped installs; it remains available for `npm exec`, `npx`, and `npm install -g`.

### Phase 2: Default-deny (next major release)

- Packages with install scripts that aren't covered by `allowScripts` are skipped by default instead of running.
- All other semantics from Phase 1 are unchanged.

### Phase 3: Ecosystem stabilization

- Monitor adoption, gather feedback, iterate on `npm approve-scripts`.
- Evaluate related features (e.g., `minimum-release-age`, `trust-policy`) as separate RFCs.

## Unresolved Questions and Bikeshedding

1. Script content preview: should `npm approve-scripts` display the actual script contents (e.g., `"postinstall": "node-gyp rebuild"`) to help users make informed decisions? pnpm shows package names only; Bun shows script names. Showing full script content adds security value but may be noisy for long scripts.

2. Remaining native addon packages: the ecosystem has largely shifted to prebuilt binaries, but some packages still require `node-gyp` at install time. Updated data on how many of the top-downloaded packages still use install scripts would strengthen the migration plan. If the number is small enough, the default-deny change is justified without a new npm-side mechanism for native addon distribution.

3. `.npmrc` expressiveness: the `.npmrc` format (comma-separated list of package names) cannot express the full tri-state + version-pinning model available in `package.json`. This is acceptable for the global/npx use case (where fine-grained control matters less), but the limitation should be documented.

4. Queryable trustworthy-identity field for arborist: the matching rule above works today by parsing keys with `npm-package-arg` and comparing against the lockfile's `resolved` field. A follow-up RFC could expose the same identity through [npm query](https://docs.npmjs.com/cli/v11/using-npm/dependency-selectors) — for example, a `:resolved(<spec>)` pseudo-selector or a `[resolved=...]` attribute selector that reads from the lockfile's resolution rather than the tarball's self-report. Once that exists, the `allowScripts` key position could accept full selector syntax (`":type(git)"`, `":root > .prod"`, etc.) as sugar over the bare-name keys defined above. The implementation would build on the resolver data already persisted in `package-lock.json` plus existing tooling (`versionFromTgz`, `hosted-git-info`).

5. Allowlisting bundled-dep install scripts: this RFC blocks bundled deps with install scripts and provides no escape hatch. Matching by `name@version` from the bundled tarball would reintroduce the manifest-confusion problem the [Identity matching](#identity-matching) rule is designed to prevent. A safe escape hatch is possible: a parent-qualified key like `parent@1.2.3 > bundled-name`, anchored to the parent's verified identity, with the bundled-dep name read from the parent's `bundleDependencies` array (which is bound to the parent's integrity hash). The trust derivation is subtle enough to deserve its own RFC.
