# Allow Scripts

## Summary

Add `--allow-scripts` to control which packages may run lifecycle scripts.
The value is a [dependency selector][dep-selectors] query — the same syntax
used by `npm query`. Root and workspace packages are always allowed.
`allow-scripts` is opt-in; when not specified all scripts are allowed.

```ini
# .npmrc
allow-scripts = [name="esbuild"], [name="better-sqlite3"]
```

## Motivation

Install lifecycle scripts execute arbitrary code before the consuming project
ever `require`s or `import`s the package. Only ~0.6 % of packages on npm use
them, yet they are the easiest vector for supply-chain attacks (`coa`/`rc`
2021, "Shai Hulud" 2025–2026, countless typosquats).

[RFC #488][rfc-488] proposed making scripts opt-in by default. That was
rejected as too disruptive. This RFC takes a different approach: the default
does not change. Users who want control opt in with `--allow-scripts`.

This design also addresses wraithgar's request for a unified pattern that
works across `--allow-git`, `--min-release-age`, and script control — all
three can use dependency selectors to identify which packages a policy
applies to.

## Detailed Explanation

### The `--allow-scripts` config

A single `.npmrc` / CLI config value:

```
allow-scripts = all | none | <dependency-selector>
```

| Value | Meaning |
|---|---|
| `all` (default) | Current behavior. All lifecycle scripts run. |
| `none` | No dependency scripts run. Root & workspace scripts still run. |
| *selector* | Only dependencies matching the selector may run scripts. Root & workspace scripts always run. |

The selector is any valid [dependency selector][dep-selectors] string — the
same syntax accepted by `npm query`. Multiple selectors are separated with
commas (CSS selector list syntax), not by repeating the flag.

```ini
# .npmrc
allow-scripts = [name="esbuild"], [name="better-sqlite3"], [name="node-gyp-build"]
```

```sh
# CLI
npm install --allow-scripts='[name="esbuild"], [name="better-sqlite3"]'
```

### Root and workspace scripts always run

Regardless of the `--allow-scripts` value, scripts defined in the root
`package.json` and in workspace `package.json` files always run. These are
the user's own scripts — there is no security benefit to blocking them, and
`--ignore-scripts` already exists as an escape hatch for that use case
(e.g. `npm test --ignore-scripts` to skip posttest linting).

### Interaction with `--ignore-scripts`

`--ignore-scripts` continues to work as today — it disables *all* scripts
unconditionally, including root scripts. `--allow-scripts` only controls
dependency scripts and does not affect root/workspace scripts.

If both are set, `--ignore-scripts` wins.

### Scope: all lifecycle scripts

This applies to **all** lifecycle scripts run for dependencies, not just
install scripts:

- `preinstall`, `install`, `postinstall`
- Implicit `node-gyp rebuild` (when `binding.gyp` is detected)
- `prepare` scripts of git dependencies
- Any other lifecycle script triggered by `npm install`, `npm ci`,
  `npm rebuild`, `npm update`, or `npx`

### Enforcement behavior

When `--allow-scripts` is set to `none` or a selector:

1. After the dependency tree is resolved, npm builds the allowed set using
   `querySelectorAll`, plus root and workspace nodes.
2. Before running any lifecycle script for a dependency, npm checks if the
   node is in the allowed set. If not, the script is skipped and the package
   is recorded as unapproved.
3. After install completes, if any scripts were unapproved, npm prints the
   full list and exits non-zero.

A dependency that has no lifecycle scripts is never reported — only packages
that actually attempted to run a script and were blocked.

#### Error output

npm collects all unapproved packages and prints them at the end:

```
npm error Unapproved lifecycle scripts were blocked.
npm error The following packages have scripts that are not allowed to run:
npm error
npm error   core-js@3.42.0 (postinstall)
npm error   @biomejs/biome@1.9.0 (postinstall)
npm error   evil-pkg@github:attacker/evil#abc1234 (preinstall, postinstall)
npm error
npm error To allow these scripts, add them to allow-scripts in .npmrc:
npm error   allow-scripts = [name="core-js"], [name="@biomejs/biome"]
```

Each line shows the package spec (name@version for registry deps, git URL
for git deps, path for file/directory deps) followed by the lifecycle events
that were blocked.

### Examples

#### Block all dependency scripts

```ini
allow-scripts = none
```

#### Allow specific packages by name

```ini
allow-scripts = [name="esbuild"], [name="better-sqlite3"], [name="node-gyp-build"]
```

#### Allow specific packages at specific versions

```ini
allow-scripts = [name="esbuild"]:semver(^0.25.0), [name="better-sqlite3"]:semver(11.9.1)
```

#### Allow all direct production dependencies

```ini
allow-scripts = :root > .prod
```

#### Allow all packages from a scope

```ini
allow-scripts = [name^="@myorg/"]
```

### Workspace behavior

In a monorepo, `--allow-scripts` is set once at the root level (in the root
`.npmrc`). The selector runs against the full dependency tree. Workspace
packages themselves are always allowed (treated like root). Dependencies of
workspaces are subject to the selector like any other dependency.

## Risks

### The query language has no trustworthy package identity

The dependency selector language queries properties of arborist `Node`
objects. Attribute selectors like `[name=...]`, `[version=...]`, and
`[_id=...]` read from `node.package` — the on-disk package.json extracted
from the installed tarball. The `#name` id selector is worse: it matches
`node.name` (the folder name, controllable via aliases) OR
`node.package.name` (the tarball name). **None of these fields reflect
where the package was actually fetched from, its source, or the spec that
resolved to it.** They are all self-reported by the tarball content or
derived from the dependency key, both of which are attacker-controllable.

Two known attacks exploit this:

**1. Transitive alias attack** (easy to execute):
A transitive dependency declares `"esbuild": "npm:malware@1.0.0"`. The
malware package is installed into a nested `node_modules/esbuild`.
`node.name` (the folder name) is `"esbuild"`. The `#esbuild` id selector
matches it — malware inherits esbuild's script approval. `:type(registry)`
does not help because the aliased malware IS a registry package.

`[name="esbuild"]` does NOT match this attack because it checks
`node.package.name`, which is `"malware"` (the real package name from the
tarball). **`[name=...]` blocks the alias attack.**

**2. Manifest confusion** (requires publishing a malicious package):
The npm registry does not validate that the `name` field inside a published
tarball matches the registry package name ([Manifest Confusion][manifest-confusion],
disclosed June 2023, unfixed as of 2026). A package published as `malware`
can include a tarball whose package.json says `name: "esbuild"`. After
install, `node.package.name = "esbuild"`, so `[name="esbuild"]` matches it.
**Neither `[name=...]` nor `#name` can distinguish this from the real
esbuild.**

**What's queryable but not trustworthy:**

| Selector                     | Reads from                                  | Attack                     |
| ---                          | ---                                         | ---                        |
| `[name=...]`                 | `node.package.name` (tarball)               | Manifest confusion         |
| `#name`                      | `node.name` (folder) OR `node.package.name` | Alias + manifest confusion |
| `[version=...]`, `[_id=...]` | Tarball package.json                        | Manifest confusion         |
| `[repository=...]`           | Tarball package.json                        | Self-reported              |

**What's trustworthy but not queryable:**

| Property | Notes |
|---|---|
| `node.resolved` | Set during resolution/install, not from tarball. Not exposed to attribute selectors. |
| `node.integrity` | Cryptographic hash of the tarball. Not exposed to attribute selectors. |
| Edge `name` and `spec` | From the parent's package.json declaration. No selector for edge properties. |
| `:type(registry\|git\|...)` | Queryable, but only gives the type — not the package name. |

No existing selector combines trustworthy source identity with name
matching.

### Trustworthy logical identity — required before shipping

Arborist nodes need a queryable field that represents the resolver-facing
identity of a package — how it was resolved and fetched, not what the
tarball claims about itself. Without this, `--allow-scripts` cannot
securely distinguish an approved package from a malicious one that claims
the same name. **This RFC should not ship until the query language can
match against a trustworthy identity.**

This field should be a logical id matching how developers declare
dependencies:

| Dep type | Logical id |
|---|---|
| Registry | `esbuild@0.25.0` |
| Scoped | `@babel/core@7.26.0` |
| Alias (`my-es → esbuild`) | `esbuild@0.25.0` (real identity, not the alias) |
| Git | `github:npm/npa#fbbf22...` |
| File | `file:../local-pkg` |

The building blocks exist — `versionFromTgz` can extract name and version
from registry tarball URLs by parsing the URL path, `hosted-git-info`
converts git URLs to shortcut form. But the exact source of truth (the
actual fetch, the lockfile, the resolver) and where to persist it (on the
node, in the lockfile, both) are implementation details to be resolved
before this RFC can be implemented.

### The query language is more expressive than needed

Dependency selectors support structural queries (`:root > .prod`,
`.workspace:has(.peer)`), pseudo-classes (`:outdated`, `:vuln`), and
arbitrary attribute matching. For `--allow-scripts`, the practical use
cases are narrower:

- **Match by name**: `[name="esbuild"]` — the primary use case
- **Match by name + version**: `[name="esbuild"]:semver(^0.25.0)`
- **Match by scope**: `[name^="@myorg/"]`
- **Match direct deps**: `:root > .prod` — useful as a broad starting
  point, though it auto-approves any new direct dep that adds scripts

Beyond these, it's hard to construct a realistic scenario where structural
or relational queries add value for script approval. You wouldn't approve
scripts based on `:outdated` or `:vuln` or tree depth. The expressiveness
is inherited from reusing the query language, not driven by requirements.

This is fine — the extra expressiveness doesn't hurt, and reusing the
existing infrastructure avoids inventing a new DSL. But it means the
selector language is not the hard part of this feature. The hard part is
trustworthy identity (see above).

### `#name@version` shorthand is not implemented

The `#name@version` shorthand (e.g. `#lodash@^1.2.3`, documented as
equivalent to `[name="lodash"]:semver(^1.2.3)`) does not work. The CSS
parser interprets dots as class selectors, and even with escaped dots the
`idType` handler does a literal string match without semver splitting.
Use `[name="..."]:semver(...)` instead.

## Rationale and Alternatives

### Why dependency selectors instead of a JSON allowlist?

The previous version of this RFC proposed a JSON allowlist with
`"approvedInstallScripts": { "esbuild": "allowed" }`. Dependency selectors
are better because:

Query syntax supports same features as an allowlist as well as structural queries
and category queries. This pattern can be extended to `--allow-git` and other
policy options.

### Why not change the default?

Same reasoning as RFC #488's rejection: too disruptive. This is opt-in.

### Alternative: `pnpm`

pnpm 10 blocks lifecycle scripts by default with `onlyBuiltDependencies` /
`allowBuilds` in `package.json`. Users who can migrate to pnpm already have
this. This RFC brings equivalent control to npm.

## Implementation

1. **Config**: Add `allow-scripts` (type: String, default: `"all"`) to the
   npm config schema.

2. **Tree query**: After `Arborist` resolves the tree, if `allow-scripts` is
   not `"all"`:
   - If `"none"`: allowed set is empty.
   - Otherwise: run `tree.querySelectorAll(allowScripts)` to get the allowed
     set.
   - Always add root and workspace nodes to the allowed set.

3. **Script gating**: Before executing a lifecycle script for a dependency,
   check if the node is in the allowed set. If not, skip and record.

4. **Reporting**: After reification, if any unapproved scripts were blocked,
   print the full list with package specs and blocked lifecycle events, then
   exit non-zero.

5. **`npm query` integration**: Users can preview what would be allowed:
   ```sh
   npm query '[name="esbuild"], [name="better-sqlite3"]'
   ```

## Prior Art

- [npm/rfcs#488][rfc-488] — "Make npm install scripts opt-in" (2021).
  369 👍, not merged due to breaking-change concerns.
- [pnpm `onlyBuiltDependencies` / `allowBuilds`][pnpm-allow] — pnpm 10
  blocks lifecycle scripts by default with an allowlist in `package.json`.
- [`@lavamoat/allow-scripts`][lavamoat] — Userland tool that disables
  scripts via `--ignore-scripts` and selectively re-runs them.
- [`can-i-ignore-scripts`][ciis] — Helps audit which deps need install
  scripts.
- [npm dependency selectors][dep-selectors] — The query syntax this RFC
  builds on.
- [Manifest Confusion][manifest-confusion] — Registry does not validate
  tarball metadata against the packument.

## Unresolved Questions

### Should there be a way to silence scripts without allowing them?

Some packages have non-essential lifecycle scripts — `core-js` prints a
funding plea, `esbuild` has a postinstall that downloads a platform binary
but falls back to JS. Users may want to say "I know about these scripts,
skip them, and don't error about it."

Options:
- A separate `--ignore-scripts-for=<selector>` config. Scripts matching this
  selector are skipped silently (no error). Clear intent separation: "allow
  to run" vs "known, don't run, don't complain."
- Overload `--allow-scripts` to mean "these packages are accounted for"
  regardless of whether scripts run. Simpler (one config) but muddies the
  semantics.

### Should `npm install <pkg>` prompt interactively?

When adding a new dependency that has lifecycle scripts, npm could prompt
whether to add it to the allow list, similar to how `apt` confirms actions.

### Should there be an `npm approve-scripts` command?

A helper that scans the tree and generates the selector string (or updates
`.npmrc`) would ease adoption. Deferred to a follow-up RFC.

### Should unapproved scripts warn or error?

This RFC proposes error (non-zero exit). An alternative is a
`--allow-scripts-policy=warn|error` flag, but that adds complexity. Starting
with error-only is simpler and more secure.

### Exact versions vs ranges

JamieMagee raised that `[name="esbuild"]:semver(>=0.25.0)` auto-approves
future compromised versions. Users who want maximum security can pin to
exact versions. Users who want convenience can use ranges. The RFC provides
the tools for both.

[rfc-488]: https://github.com/npm/rfcs/pull/488
[dep-selectors]: https://docs.npmjs.com/cli/v11/using-npm/dependency-selectors
[arborist-qsa]: https://github.com/npm/cli/blob/latest/workspaces/arborist/lib/query-selector-all.js
[manifest-confusion]: https://blog.vlt.sh/blog/the-massive-hole-in-the-npm-ecosystem
[pnpm-allow]: https://pnpm.io/settings#allowbuilds
[lavamoat]: https://www.npmjs.com/package/@lavamoat/allow-scripts
[ciis]: https://www.npmjs.com/package/can-i-ignore-scripts
