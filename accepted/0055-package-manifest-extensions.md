---
title: Package Manifest Extensions
number: 55
status: accepted
created: 2026-06-18
accepted_at: 2026-06-18
implemented_at: null
withdrawn_at: null
implementation: null
---
# Package Manifest Extensions

## Summary

Add a root-only `packageExtensions` field to `package.json` that lets a project apply deterministic, declarative repairs to dependency package manifests before npm finalizes the ideal dependency tree. This gives npm users a first-class way to add or correct missing `dependencies`, `optionalDependencies`, `peerDependencies`, and `peerDependenciesMeta` in third-party packages, especially when using `install-strategy=linked`, where dependencies are fully isolated and hoisting no longer masks incorrect package manifests.

## Motivation

The `linked` install strategy is the most direct path toward npm installs with strong package boundaries. Its value is also what makes adoption hard: packages only see the dependencies they actually declared. A package that works today only because a dependency was hoisted somewhere above it can fail under `linked`, even though the same package appears to work under the default hoisted layout.

[RFC 0042: Isolated mode](https://github.com/npm/rfcs/blob/4b48e42179f1a5efa619c45d181dc77bcd676012/accepted/0042-isolated-mode.md) describes the underlying problem directly: npm converts the declared dependency graph into a filesystem layout, and hoisted installs can lose information by making packages available to code that did not declare them. When a package imports an undeclared dependency, a hoisted tree may hide the bug; a more isolated tree exposes it.

This is the point of `linked`, not a defect in it. Strong package boundaries make dependency contracts testable. The missing piece is a way for the root project to record known third-party manifest repairs while the ecosystem catches up. RFC 0042 explicitly anticipates this class of follow-up feature:

> We may want to later add a feature to npm which allows users to locally declare dependencies on behalf of packages as a stop-gap, if existing solutions to this are not enough.

The same RFC also notes the less precise workaround available without such a feature:

> If a package is missing a dependency, it can be temporarily fixed (while waiting for the package owner to fix this issue, or if it's working as designed) by declaring this missing dependency as top level dependency of the repository.

That workaround is not sufficient for the stronger isolation npm now has in `install-strategy=linked`. A root-level dependency can mask a missing transitive dependency in a hoisted tree, but it does not make that package available inside the isolated dependency boundary of the package that actually imports it. The repair has to be attached to the broken package's manifest before Arborist resolves its dependency edges.

RFC 0042 also frames isolated installs as useful for build correctness: static analysis can catch many missing dependencies, but not all of them; isolated installs prove that dependency declarations are correct, which is important for scoped installs and build caches. `packageExtensions` should preserve that property. It should not reintroduce accidental hoisting; it should turn a known local exception into an explicit dependency edge in the graph.

The same explicit edge is useful under npm's existing hoisted, nested, and shallow strategies. `install-strategy=linked` makes undeclared dependency bugs unavoidable, but a root-owned manifest repair is also easier to audit and remove than an accidental hoist or a broad root dependency under any install layout.

### Concrete pain points

1. **Packages with missing runtime dependencies break under `linked`.** Some packages import another package without listing it in `dependencies` or `optionalDependencies`. Hoisting can make this pass by accident. The linked strategy exposes the bug by making the dependency unavailable.

2. **Packages with missing type dependencies break builds.** TypeScript and other build tools often resolve imports from `@types/*`, peer packages, or helper packages during compilation. If a dependency imports those packages but does not declare them, strict dependency isolation turns a latent manifest bug into a build failure. RFC 0042 specifically calls out tools that crawl `node_modules` and notes that TypeScript includes packages from `node_modules/@types` by default; root-level type packages can therefore affect build output in ways that are unrelated to the declared dependency graph. Missing type packages should usually be repaired with `dependencies`, not `optionalDependencies`, unless the importing package can actually build and run without that type package.

3. **Peer dependency metadata is often incomplete.** Missing `peerDependencies`, overly broad peer ranges, or missing `peerDependenciesMeta.optional` entries can force users into noisy or incorrect peer resolutions. The package author should fix the manifest, but consumers need a project-local bridge while waiting.

4. **Forking and republishing is too heavy for manifest-only repairs.** Publishing a renamed fork just to add `"@types/foo": "*"` or mark a peer optional requires ownership, registry infrastructure, ongoing updates, and an `overrides` entry. That is disproportionate for small metadata fixes.

5. **Native dependency patching is the wrong phase for dependency edges.** A patch can edit a dependency's `package.json` on disk after the package has been selected and extracted, but by then Arborist has already resolved the ideal tree. Manifest repairs that influence dependency and peer resolution need to happen before resolution, not during reify.

6. **`overrides` solves a different problem.** `overrides` changes what a dependency edge resolves to. It does not add a missing edge, mark a peer optional, or correct a dependency's declared peer contract. In many security cases, `overrides` remains the right tool for forcing a known good transitive version; `packageExtensions` is the complementary tool for fixing the dependency metadata that creates the edge in the first place.

7. **Linked installs are built from the ideal dependency tree.** RFC 0042's implementation model builds the ideal tree first and then transforms that tree into the isolated filesystem layout. That means manifest repairs must happen before the ideal tree is finalized. A post-reify patch or script can change files on disk, but it cannot change the dependency graph that linked mode is going to materialize.

### Expected outcome

Users adopting `install-strategy=linked` should be able to keep moving without waiting for every upstream package to publish perfect manifests. They should be able to commit small, reviewable, root-owned manifest repairs, generate a deterministic lockfile, and remove each repair when the upstream package is fixed.

## Detailed Explanation

### Manifest field

Add a top-level `packageExtensions` field to the root `package.json`:

```json
{
  "packageExtensions": {
    "broken-package@1": {
      "dependencies": {
        "missing-runtime-dep": "^2.0.0"
      }
    },
    "typescript-plugin@4.3.0": {
      "peerDependencies": {
        "typescript": ">=5"
      },
      "peerDependenciesMeta": {
        "typescript": {
          "optional": true
        }
      }
    },
    "@scope/uses-types@2": {
      "dependencies": {
        "@types/node": "^22.0.0"
      }
    }
  }
}
```

Each key is a package selector. A selector is restricted to a package name with an optional semver range:

- `"foo"` matches all versions of `foo`.
- `"foo@1"` matches versions satisfying `1`.
- `"@scope/foo@^2.3.0"` matches versions satisfying `^2.3.0`.

Selectors do not accept dist-tags, git specs, file specs, directory specs, URL specs, or `npm:` alias specs. This keeps matching independent of the dependency edge that requested the package and avoids the edge-value matching rules that `overrides` needs.

Selectors match the candidate package manifest's own `name` and `version` after npm has selected, fetched, or read that candidate and before Arborist reads its outgoing dependency and peer edges. For aliases, the selector matches the underlying package manifest name and version, not the alias name used in `node_modules`.

Selector matching is global by package identity and independent of install location, dependency path, or dependency source. A package selected from a registry, git repository, tarball URL, local directory, or file spec can match if its manifest `name` and `version` match the selector. Name-only selectors match any manifest version string for that package name. Versioned selectors only match candidate versions that parse as valid semver and satisfy the selector range; if a git, tarball, directory, or file-sourced package has a non-semver version, it can only match a name-only selector. There is intentionally no path-scoped form such as `{"parent": {"child": {...}}}` in v1, so every non-workspace instance of `foo@1.2.3` receives the same extension and deduplication does not need to split otherwise identical package instances based on where they appear in the graph.

At most one selector may match a candidate package in v1. If both `"foo"` and `"foo@1"` match `foo@1.2.3`, or if two versioned selectors match the same candidate, npm must fail the install and report the conflicting selectors. This check happens against the actual packages in the ideal tree during `npm install` and against the package identities recorded in the lockfile during `npm ci`. A rule set can therefore start failing during `npm install` when a newly resolved package version enters the graph and matches more than one selector; `npm ci` remains reproducible for a committed lockfile because it checks only the package identities already recorded in that lockfile. This behavior is intentional, because the user should narrow or remove one of the overlapping rules rather than rely on order-dependent merges.

Unversioned selectors apply to every version of a package, including future majors. Documentation should recommend versioned selectors for most repairs, because a manifest bug that exists in `foo@1` may not exist in `foo@2`.

### Supported extension fields

The following fields may be extended:

- `dependencies`
- `optionalDependencies`
- `peerDependencies`
- `peerDependenciesMeta`

These are the fields that directly affect Arborist's dependency and peer resolution. Fields such as `devDependencies`, `scripts`, `bin`, `engines`, `os`, `cpu`, `exports`, `main`, and `types` are intentionally out of scope for v1. Transitive `devDependencies` are not installed for consumers, so extending them would not repair the installed dependency graph. The remaining excluded fields affect package contents, runtime behavior, or lifecycle execution rather than the dependency graph.

### Merge semantics

When a selector matches a package manifest, npm applies the extension to a per-ideal-tree copy of that manifest metadata before reading that package's outgoing dependency edges. npm must not mutate shared pacote, packument, manifest, registry metadata, or cache objects in place. The package tarball and the installed `node_modules/<package>/package.json` file are not rewritten by this feature.

For each supported object field:

1. If the field is missing from the package manifest, npm creates it.
2. For `dependencies` and `optionalDependencies`, npm adds entries by dependency name only when that package name is not already declared in either normal dependency field.
3. If a package already declares a package name in `dependencies` or `optionalDependencies`, an extension that provides that name in either normal dependency field is an error. Users should use `overrides` for normal dependency version changes.
4. For `peerDependencies`, npm shallow-merges entries by peer name, and the extension value replaces the package's peer range in memory when that peer name already exists.
5. For `peerDependenciesMeta`, npm merges by peer name and then shallow-merges each peer metadata object, so an extension can add `optional: true` without replacing unrelated metadata keys for that peer.

After extension application, npm validates and normalizes the manifest using the same rules it uses for published package manifests. An extension must not create a new duplicate package name across `dependencies` and `optionalDependencies`, and it must not try to move a package name between those two fields. If the package already declares `bar` in `optionalDependencies`, then an extension may not provide either `dependencies.bar` or `optionalDependencies.bar`; if the package already declares `bar` in `dependencies`, then an extension may not provide either `optionalDependencies.bar` or `dependencies.bar`. This keeps v1 from implicitly converting optional dependencies into required dependencies or required dependencies into optional dependencies without an explicit deletion feature, while leaving normal dependency version changes to `overrides`.

`peerDependencies` may overlap with `dependencies` or `optionalDependencies`, because packages commonly provide a fallback implementation while also declaring a peer contract. An extension may add or correct a `peerDependencies` entry for a package that already lists the same name in `dependencies` or `optionalDependencies`, and it may add a `dependencies` or `optionalDependencies` entry for a package that already lists the same name in `peerDependencies` when that name is not already declared in either normal dependency field.

Every `peerDependenciesMeta` entry present after extension application must correspond to a `peerDependencies` entry present after extension application. An extension may add `peerDependenciesMeta.<name>.optional` only if the package already declares `peerDependencies.<name>` or the same extension also adds `peerDependencies.<name>`. Orphaned `peerDependenciesMeta` entries are an error in v1.

This permits the common manifest-repair cases that are in scope for v1:

- add a missing `dependencies` or `optionalDependencies` edge
- add a missing peer dependency edge
- correct a peer dependency range that is known to be wrong
- add or correct peer dependency metadata

Deletion is not supported in v1. A `null`, `false`, or `"-"` value is an error. Changing normal dependency selection should be handled by `overrides`; removing dependencies or changing install behavior has different security and compatibility consequences and should be handled by lifecycle-script policy, native patching, or a follow-up RFC.

### Root-only behavior

Only the root project's `packageExtensions` field is considered. In a workspace project, this means the workspace root, the package that contains the `workspaces` declaration and owns the shared lockfile.

`packageExtensions` in installed dependencies are ignored. `packageExtensions` in non-root workspace packages are ignored and should produce an install warning that the field is only honored at the workspace root. This matches the root-authority model of `overrides` while avoiding a published or reused workspace package accidentally changing its consumer's dependency graph.

Workspace packages are not extension targets in v1. If a selector matches a workspace member's `name` and `version`, npm ignores that match and should warn that workspace package manifests should be edited directly. This keeps `packageExtensions` focused on third-party dependency manifests and avoids an in-memory manifest for a local package diverging from the source-controlled workspace `package.json`.

### Resolution order

The install pipeline is:

1. Load the root package's `packageExtensions`.
2. Fetch or read a candidate dependency manifest or abbreviated registry metadata containing the dependency and peer fields.
3. Apply the matching package extension to that in-memory manifest metadata.
4. Read dependency and peer edges from the extended manifest.
5. Apply `overrides` while resolving those edges.
6. Build and reify the resulting ideal tree according to the selected `install-strategy`.

This order means:

- `packageExtensions` creates or corrects dependency edges.
- `overrides` still controls the final resolution target for those edges.
- `install-strategy=linked` receives a complete graph and does not need to rely on hoisting to make missing dependencies visible.

For example:

```json
{
  "packageExtensions": {
    "foo@1": {
      "dependencies": {
        "bar": "^1.0.0"
      }
    }
  },
  "overrides": {
    "bar": "1.2.3"
  }
}
```

When resolving `foo@1`, npm first treats `foo` as depending on `bar@^1.0.0`, then applies the `bar` override if that edge is selected.

Path-scoped overrides compose with extension-created edges in the same way. If the root declares `overrides: { "foo": { "bar": "1.2.3" } }`, the override sees the `foo -> bar` edge after `packageExtensions` creates it.

### Lockfile behavior

The project lockfile records the dependency graph that results from extensions. The lockfile also records enough metadata to detect stale extension state.

This metadata belongs in the project `package-lock.json`, not only in the hidden `node_modules/.package-lock.json`. RFC 0042's compatibility model is that hoisted and isolated installs can share the same project lockfile, with the isolated layout represented as a reification transform. A dependency edge added by `packageExtensions` is part of the ideal graph, so it must be visible before that transform runs and must remain stable when switching between install strategies.

The lockfile representation must contain three pieces of information:

- A digest over the canonical root `packageExtensions` state from the root `package.json`.
- The effective dependency and peer metadata for each lockfile package entry after extensions have been applied.
- Minimal provenance for each affected package entry, including the selector that matched and the field entries changed by that selector.

The preferred v1 shape is to store only the canonical extension hash on the root package entry, store effective dependency metadata on each package entry as npm already does, and store only minimal per-entry provenance rather than duplicating the full extension object on every affected package entry:

```json
{
  "packages": {
    "": {
      "packageExtensionsHash": "sha512-..."
    },
    "node_modules/foo": {
      "version": "1.0.0",
      "dependencies": {
        "bar": "^1.0.0"
      },
      "packageExtensionsApplied": {
        "selector": "foo@1",
        "dependencies": [
          "bar"
        ]
      }
    }
  }
}
```

The canonical hash input is the root `packageExtensions` field after `package.json` parsing and extension-schema validation, not the lockfile's effective dependency metadata or per-entry provenance.

The canonicalization rules are:

- If the root manifest does not contain `packageExtensions`, npm records no extension hash and no applied-extension provenance, and `npm ci` fails when the lockfile records either one.
- If the root manifest contains `packageExtensions`, including `{}`, npm hashes the canonical form of that object.
- Unsupported fields, invalid value types, invalid selectors, and selector conflicts are rejected before npm writes lockfile state.
- Object keys are sorted lexicographically at every object level before serialization.
- Selector strings, package names, field names, metadata keys, specifier strings, and metadata values are preserved exactly after JSON parsing.
- npm must not normalize semver ranges, registry specs, whitespace inside string values, or boolean metadata values for the hash.
- Serialization uses deterministic JSON with no insignificant whitespace.
- The digest is written using npm's existing lockfile digest encoding, with `sha512` as the expected v1 algorithm unless npm standardizes another lockfile hash format before implementation.
- The hash covers only the canonical root extension rules, while package entries store effective dependency metadata and minimal provenance separately.

The root manifest remains authoritative for the extension rules; the lockfile hash proves that the locked graph was generated from the same canonical rule set. The install should reject multiple selectors that match the same candidate package before writing lockfile state. Package entries continue to store their normal effective `dependencies`, `optionalDependencies`, `peerDependencies`, and `peerDependenciesMeta` fields after extension application.

The required behavior is:

- `npm install` updates `package-lock.json` when `packageExtensions` changes.
- `npm ci` fails if the root `packageExtensions` field is present but the lockfile does not contain a matching extension hash.
- `npm ci` fails if the lockfile contains an extension hash or applied-extension provenance but the root `packageExtensions` field is absent.
- `npm ci` fails if the root `packageExtensions` state does not match the canonical state represented in the lockfile.
- `npm ci` fails if any package identity recorded in the lockfile matches more than one root selector.
- `npm ci` fails if a lockfile package entry records extension provenance that no longer corresponds to exactly one selector in the canonical root extension state.
- `npm ci` does not refetch original package manifests to re-derive extension output when extension state matches; it validates the root hash, selector conflicts, and per-entry provenance, then uses the effective dependency and peer metadata stored in the lockfile as the locked graph.
- `npm explain` and `npm ls --json` can report that a dependency edge came from a package extension using the minimal provenance metadata in the lockfile and ideal tree.

If this cannot be represented compatibly in the current lockfile version, npm should bump `lockfileVersion` so older npm versions do not silently regenerate a lockfile that drops extension state. Projects that use this feature should also be able to declare a compatible npm version through existing mechanisms such as `packageManager` or `engines`.

### Visibility

Packages affected by extensions should be visible in npm's debugging and inspection commands.

Example `npm explain` output:

```text
bar@1.2.3
node_modules/bar
  bar@"^1.0.0" from foo@1.0.0
  edge added by packageExtensions["foo@1"].dependencies.bar
```

Example `npm ls` annotation:

```text
my-project@1.0.0
└─┬ foo@1.0.0 [packageExtensions: dependencies.bar]
  └── bar@1.2.3
```

This is important because package extensions are intentional local policy. They should be easy to audit and easy to remove once upstream is fixed.

### Lifecycle and security behavior

An extension-added dependency is installed like any other dependency. If that dependency or one of its transitive dependencies has lifecycle scripts, those scripts run according to npm's normal lifecycle-script policy unless another project policy disables them.

This does not let published packages force new dependency edges or new lifecycle scripts onto their consumers, because npm only honors `packageExtensions` from the project root. The security model is root-owned policy: the project chooses to add or correct an edge, and the resulting package is resolved, audited, explained, and locked like any other dependency.

Adding or narrowing a `peerDependencies` entry can also make Arborist report an `ERESOLVE` conflict that did not appear before the extension. That is expected behavior: the extension changes the package's declared peer contract, and npm should resolve or reject the tree using the extended contract.

### Bundled dependencies

`packageExtensions` does not modify `bundleDependencies` or `bundledDependencies` in v1. An extension-created edge is resolved like the same edge would be resolved if it had appeared in the published manifest. If npm's existing bundled dependency handling would satisfy that ordinary declared edge from the bundled copy, it may satisfy the extension-created edge from the bundled copy; otherwise the edge resolves normally from the registry, cache, or other configured source. If a repair requires changing bundled package contents or bundled dependency declarations, native dependency patching, a fork, or a follow-up RFC is the more appropriate tool.

### Publish behavior

`packageExtensions` is application-side project policy. npm only applies it from the project root, and npm does not apply it when a package containing the field is installed as a dependency.

If a non-private package is being published and contains `packageExtensions`, npm should fail the publish:

```text
packageExtensions is only honored at the project root and must not be published.
```

This keeps root-owned dependency repair available to applications, private workspaces, and local CI while preventing useless project policy from being added to the registry manifest or the `package.json` inside the published tarball.

Keeping the field in `package.json` is a trade-off. pnpm and Yarn keep package extensions in workspace configuration files, which avoids publishing consumer-only policy, but npm does not currently have an equivalent structured workspace config file for package-manager-owned project policy. A root `package.json` field keeps the feature available to single-package projects and workspaces without introducing a new config file format just for this feature.

If npm later wants published packages to carry their own dependency-manifest repair policy, that policy should live somewhere other than `package.json`. If npm later introduces a structured workspace config file, `packageExtensions` could move there or be supported there as an additional location.

## Rationale and Alternatives

### Why this is not just `overrides`

`overrides` changes dependency resolution targets. It does not mutate package metadata.

That distinction matters when the broken package omitted the dependency edge entirely:

```text
foo imports bar, but foo's package.json does not list bar
```

There is no `foo -> bar` edge for `overrides` to resolve. Adding `bar` to the root project may work under hoisting, but not under a linked isolated install. `packageExtensions` creates the missing `foo -> bar` edge before resolution.

`overrides` remains the right tool when the edge already exists and the user wants a different version, fork, or source. `packageExtensions` and `overrides` compose, but neither replaces the other.

### Why this is not native dependency patching

Native dependency patching changes package contents after resolution. Manifest extensions change package metadata before resolution.

If a user patches `foo/package.json` to add `bar`, the patch can make the file on disk look correct, but it cannot retroactively cause Arborist to resolve and install `bar` as a dependency of `foo`. That is the wrong phase.

Dependency patching remains the right tool for source-code or manifest changes that need to exist on disk. `packageExtensions` is for dependency graph repairs.

### Why not arbitrary `.npmfile.cjs` / `.npmfile.mjs` hooks in v1?

pnpm's `.pnpmfile.mjs` `readPackage` hook is more flexible than a declarative `packageExtensions` field. It can run arbitrary JavaScript and mutate any part of a dependency manifest.

That flexibility comes with costs:

- It executes root-provided code during install.
- It can be non-deterministic, especially if it reads the filesystem, environment variables, time, or the network.
- It is difficult to represent in a lockfile in a way older or frozen installs can validate.
- It risks overlapping with npm's current direction of reducing implicit install-time code execution.

The use cases that matter most for `install-strategy=linked` migration are small metadata repairs. A declarative field solves those cases with a reviewable manifest diff and a deterministic lockfile story.

This RFC does not permanently reject hooks. It defines the manifest-extension phase that a future `.npmfile.cjs` / `.npmfile.mjs` `readPackage` hook could use if the declarative subset proves insufficient. Such a future hook should have its own RFC and should define lockfile hashing, `npm ci` behavior, and deterministic execution rules explicitly.

### Why not republish forks?

Republishing a fixed package is appropriate when the change is long-lived or must be distributed as a registry artifact. It is excessive for many manifest-only repairs:

- adding one missing dependency
- adding a missing `@types/*` dependency
- marking a peer dependency optional
- narrowing a peer range until upstream fixes it

Forks also create ongoing maintenance work. The consumer must publish, version, audit, and eventually remove the fork. `packageExtensions` keeps the repair in the consuming project and makes it easy to delete.

### Why not add missing packages to the root project?

Adding a missing package to the root project relies on hoisting. It only works when the filesystem layout happens to make the root dependency visible to the broken package. The linked strategy intentionally removes that accidental visibility.

If `foo` imports `bar`, then `bar` should be a dependency edge of `foo`. `packageExtensions` expresses that directly.

## Implementation

The primary implementation work is in `npm/cli`, especially Arborist.

### Affected packages

- **`npm/cli/workspaces/arborist`**
  - Load root `packageExtensions` during ideal tree construction.
  - Validate selector grammar and reject package extensions where multiple selectors match the same non-workspace candidate package or locked package identity.
  - Apply extensions to a per-ideal-tree copy after a non-workspace package manifest or abbreviated metadata object is read and before dependency and peer edges are created.
  - Avoid mutating shared pacote, packument, manifest, registry metadata, or cache objects in place.
  - Skip workspace package manifests as extension targets and warn when a selector would match a workspace member.
  - Normalize cross-field dependency metadata after extension application using the same rules as normal package manifests.
  - Reject `dependencies` and `optionalDependencies` extension entries that attempt to provide a name already declared in either normal dependency field.
  - Allow `peerDependencies` extension entries to replace an existing peer range before peer resolution.
  - Reject extensions that create or attempt to move duplicate names across `dependencies` and `optionalDependencies`.
  - Reject `peerDependenciesMeta` entries that do not correspond to a `peerDependencies` entry after extension application.
  - Preserve extended manifest data in the ideal tree, effective dependency metadata in the lockfile, and minimal extension provenance for affected lockfile entries.
  - Ensure extension-influenced edges participate in peer resolution, deduplication, auditing, lifecycle-script policy, and all install strategies.
  - Apply peer-related extensions before virtual package / peer-set identity is calculated for linked installs, since RFC 0042's isolated layout keys packages by package content plus resolved peer dependency set.
  - Mark edges or nodes with enough provenance for `npm explain`.

- **`npm/cli`**
  - Add `package.json` schema awareness for `packageExtensions`.
  - Add install-time validation for root-only usage and warnings for ignored non-root workspace fields.
  - Add `npm ci` validation for canonical extension hash state, selector conflicts against locked package identities, and stale extension provenance.
  - Surface extension provenance in `npm ls` and `npm explain`.
  - Fail `npm publish` for non-private packages that contain `packageExtensions`.

- **`npm/cli/workspaces/package-json`**
  - Add schema/read-write awareness of the field.

- **`docs.npmjs.com`**
  - Document `packageExtensions`, root-only semantics, lockfile behavior, interaction with `overrides`, and migration guidance for linked installs.

### Tests

Required test coverage:

- Missing dependency repair:
  - `foo` imports/resolves `bar` but does not declare it.
  - With `packageExtensions`, `bar` is installed as a dependency of `foo`.
  - The test must pass for `install-strategy=hoisted`, `nested`, `shallow`, and `linked`.

- Missing type dependency repair:
  - A package has a compile-time dependency on an `@types/*` package that is not declared.
  - The extension adds it to `dependencies` and the resulting tree makes it visible only to the package that needs it.

- Peer dependency repair:
  - Add a missing peer.
  - Add `peerDependenciesMeta.<peer>.optional`.
  - Verify Arborist's peer resolution sees the extended metadata.

- Normal dependency repair:
  - A package missing `dependencies.bar` can receive an extension-created `bar` edge.
  - An extension that attempts to replace existing `dependencies.bar` or `optionalDependencies.bar` fails with a clear error.
  - Normal dependency version changes are handled by `overrides`, not `packageExtensions`.

- Peer dependency correction:
  - A package declares `peerDependencies.bar: "^1"` and the extension changes it to `^2`.
  - Arborist's peer resolution and the resulting lockfile use the corrected peer contract.

- `overrides` composition:
  - Extension adds `bar: "^1"`.
  - Root `overrides.bar` forces `1.2.3`.
  - The resulting tree contains `bar@1.2.3`.

- Root-only behavior:
  - Root field applies.
  - Installed dependency package field is ignored.
  - Non-root workspace field is ignored and emits a warning.
  - A root selector that matches a workspace package does not modify that workspace package and emits a warning.

- Selector behavior:
  - Name-only, name-plus-range, and scoped package selectors match the candidate manifest's own name and version.
  - Dist-tags, git specs, file specs, URL specs, and alias specs are rejected as selectors.
  - Multiple matching selectors fail `npm install` with a clear error when they match a package in the ideal tree.
  - Multiple matching selectors fail `npm ci` with a clear error when they match a package identity in the lockfile.
  - Alias dependencies match the underlying package name, not the alias name.
  - Registry, git, tarball URL, local directory, and file-sourced packages can match selectors by manifest name and version.
  - Name-only selectors match non-semver manifest versions.
  - Versioned selectors do not match non-semver manifest versions.

- Metadata cache behavior:
  - Package extensions are applied to per-ideal-tree manifest metadata copies.
  - A shared pacote, packument, manifest, registry metadata, or cache object is not mutated.
  - Two installs using the same cached manifest metadata do not observe each other's package extensions.

- Merge behavior:
  - `dependencies` and `optionalDependencies` add missing names only.
  - Extensions that provide a name already declared in `dependencies` or `optionalDependencies` fail.
  - `peerDependencies` merges by peer name.
  - Extension values replace existing peer ranges in `peerDependencies`.
  - `peerDependenciesMeta` merges by peer name and then by metadata key.
  - Extensions that create duplicate names across `dependencies` and `optionalDependencies` fail.
  - Extensions that try to move a name between `dependencies` and `optionalDependencies` fail.
  - Extensions may create or preserve overlap between `peerDependencies` and `dependencies` or `optionalDependencies`.
  - Orphaned `peerDependenciesMeta` entries fail after extension application.
  - The installed dependency `package.json` file is not rewritten.

- Lockfile determinism:
  - `npm install` records a canonical extension hash, effective dependency metadata, and minimal provenance.
  - `npm install` records minimal provenance for affected package entries without duplicating the full extension object on every affected entry.
  - Key order and insignificant JSON formatting changes do not change the canonical extension hash.
  - Selector, package name, field name, metadata key, specifier string, or metadata value changes do change the canonical extension hash.
  - Unsupported fields, invalid value types, invalid selectors, and selector conflicts fail before npm writes extension lockfile state.
  - `npm ci` succeeds with matching extension state.
  - `npm ci` fails when the root manifest has `packageExtensions` but the lockfile lacks a matching extension hash.
  - `npm ci` fails after the root `packageExtensions` entry changes without updating the lockfile.
  - `npm ci` fails after a lockfile package entry records extension provenance that no longer corresponds to exactly one canonical root extension rule.
  - `npm ci` validates extension hash, selector conflicts, and provenance before trusting locked effective dependency metadata.
  - A lockfile generated with `packageExtensions` remains valid when switching between `install-strategy=hoisted` and `install-strategy=linked`.

- Visibility:
  - `npm explain` identifies extension-created edges.
  - `npm ls --json` exposes extension metadata for affected nodes or edges.

- Publish behavior:
  - `npm publish --dry-run` on a non-private package with `packageExtensions` fails with an error explaining root-only behavior.
  - Private packages and unpublished local projects can use `packageExtensions` for local installs and CI.

- Lifecycle, peer, and bundled dependency behavior:
  - Extension-added dependency edges are subject to the same lifecycle-script policy as normal dependency edges.
  - Adding or narrowing peer metadata can produce normal `ERESOLVE` failures.
  - Extension rules do not modify `bundleDependencies` or `bundledDependencies`.
  - Extension-created dependency edges use the same bundled dependency behavior as ordinary declared edges.

### Rollout

This feature can ship in a minor release because it is opt-in. Projects without `packageExtensions` are unaffected.

No existing package is allowed to change its consumers' dependency graph by publishing this field, because npm reads it only from the project root.

The only compatibility risk is older npm versions that do not understand `packageExtensions`. Those versions will ignore the root field if they regenerate `package-lock.json`, which can silently remove the repaired graph. The implementation should use a lockfile representation, and a lockfile version bump if needed, that makes new npm fail loudly when extension state is missing or stale. Projects using this feature should also pin an npm version that supports it through `packageManager`, `engines`, or the package-manager policy npm recommends at implementation time.

## Prior Art

### pnpm `packageExtensions`

pnpm supports a `packageExtensions` setting in `pnpm-workspace.yaml`. It allows users to extend package definitions with `dependencies`, `optionalDependencies`, `peerDependencies`, and `peerDependenciesMeta`, and pnpm documents this as a way to fix packages with missing dependencies.

pnpm also notes that `packageExtensions` can be used when strict isolation or ESM behavior exposes packages that import dependencies they did not declare.

This RFC adopts the same core idea, but places it in npm's root `package.json` because npm does not currently have a workspace config file equivalent to `pnpm-workspace.yaml`.

### pnpm `.pnpmfile.mjs` / `.pnpmfile.cjs`

pnpm also supports install hooks in `.pnpmfile.mjs` or `.pnpmfile.cjs`. The `hooks.readPackage(pkg, context)` hook runs after pnpm parses a dependency's manifest and before resolution, and the returned manifest affects what gets resolved into the lockfile.

This RFC intentionally proposes the declarative subset first. It solves the most common linked-install migration cases while avoiding arbitrary install-time code execution.

### Yarn `packageExtensions`

Yarn Berry supports `packageExtensions` in `.yarnrc.yml` to extend package definitions and fix third-party dependency metadata. Yarn's documentation explicitly recommends `resolutions` instead when the goal is to rewrite existing dependency resolutions.

This RFC follows the same conceptual split:

- use `packageExtensions` to repair missing or incorrect manifest metadata
- use `overrides` to force a resolution target

### `@yarnpkg/extensions`

Yarn maintains an `@yarnpkg/extensions` package containing package extensions for known ecosystem issues. pnpm documentation points users toward contributing package extensions upstream to the shared database.

npm could consume or contribute to the same database in a future RFC, but this proposal starts with project-local declarations only.

### npm `overrides`

[RFC 0036](https://github.com/npm/rfcs/blob/58f92e8d76e766184968fffa87dd125ed957afc8/accepted/0036-overrides.md) added root-only dependency resolution overrides to npm, with the original RFC proposed in [PR #129](https://github.com/npm/rfcs/pull/129). It explicitly says there is no facility for mutating package metadata.

`packageExtensions` fills that gap without changing the behavior or scope of `overrides`.

### npm isolated mode

[RFC 0042](https://github.com/npm/rfcs/blob/4b48e42179f1a5efa619c45d181dc77bcd676012/accepted/0042-isolated-mode.md) accepted an isolated, pnpm-inspired install layout, with the original RFC proposed in [PR #436](https://github.com/npm/rfcs/pull/436) and later updated in [PR #584](https://github.com/npm/rfcs/pull/584). Its unresolved questions already anticipated the need for a feature that lets users locally declare dependencies on behalf of packages while waiting for upstream fixes.

It also establishes four points this RFC depends on:

- hoisted installs can hide undeclared dependencies by making packages visible outside the declared graph
- isolated installs are valuable because they make package boundaries testable and support build caches and scoped installs
- isolated reification is a transform of the ideal dependency tree, so dependency metadata repairs must happen before that tree is finalized
- linked package identity includes the resolved peer dependency set, so `peerDependencies` and `peerDependenciesMeta` extensions must be applied before peer sets are resolved and hashed

This RFC is the local dependency-declaration feature that RFC 0042 left as a possible follow-up.

### Native Dependency Patching

The [Native Dependency Patching RFC](https://github.com/npm/rfcs/pull/862) proposes source-controlled patches that apply during reify and work across install strategies. It is complementary: patching is for package contents after resolution; package extensions are for dependency metadata before resolution.

### Make Install Scripts Opt-In

The [Make Install Scripts Opt-In RFC](https://github.com/npm/rfcs/pull/868) proposes a declarative, root-owned policy for dependency lifecycle script execution. This RFC follows the same direction: install-time behavior should be explicit, auditable, root-controlled, and represented in project metadata.

## Unresolved Questions and Bikeshedding

1. **Lockfile placement and versioning.** Should the canonical root extension hash live on `packages[""]` or in a top-level lockfile section? Does this require a lockfile version bump, or is an additive field enough?

2. **Deletion.** Should v1 support removing dependency entries with a sentinel such as `"-"`? This would match some package-manager prior art, but it also increases the risk of deleting dependencies that are needed at runtime.

3. **Where should the field live?** `package.json` is consistent with npm's current lack of a workspace config file. If npm later introduces an `npm-workspace.yaml` or similar file, `packageExtensions` may be a good candidate for migration.

4. **Should npm provide management commands?** A future command such as `npm package-extensions ls` or `npm explain --extensions` could identify extension rules that no longer match any package, rules made redundant by upstream fixes, or extension-created edges.

5. **Shared ecosystem database.** Should npm participate in a shared package-extension database, similar to `@yarnpkg/extensions`, or should all extensions remain project-local?

6. **Imperative hooks.** If the declarative field is not sufficient, should npm add `.npmfile.mjs` / `.npmfile.cjs` with a `readPackage` hook? If so, how should hook output be represented in the lockfile, and what restrictions are needed to keep `npm ci` deterministic?
