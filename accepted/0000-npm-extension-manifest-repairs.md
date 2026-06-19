# npm Extension for Manifest Repairs

## Summary

Add a root-owned `.npm-extension.mjs` / `.npm-extension.cjs` file with a top-level `transformManifest(pkg, context)` extension point that lets a project imperatively repair dependency package manifests before npm finalizes the ideal dependency tree. This builds on the accepted [Package Manifest Extensions proposal](https://github.com/npm/rfcs/pull/889) and its [npm CLI implementation](https://github.com/npm/cli/pull/9496), which established the pre-resolution manifest repair phase and the lockfile visibility model for root-owned dependency metadata repairs. `packageExtensions` remains the safer declarative default for common dependency metadata repairs, while `.npm-extension` covers cases that need comments, issue links, repeated transformations, conditional logic, reading existing manifest values, deletion, or a local configuration location outside `package.json`.

## Motivation

The accepted [Package Manifest Extensions proposal](https://github.com/npm/rfcs/pull/889) added `packageExtensions`, a root-only `package.json` field for deterministic, declarative package manifest repairs. That feature addresses the most common migration blockers for `install-strategy=linked`: missing dependencies, missing type dependencies, incorrect peer ranges, and missing `peerDependenciesMeta.optional` entries. It also deliberately drew tight boundaries. `packageExtensions` is JSON, so it cannot contain comments or links explaining why a repair exists. `packageExtensions` is selector-based data, so repeated repairs can become verbose when many packages need the same pattern. `packageExtensions` is add-only for normal dependency fields, so it cannot remove a dependency entry or rewrite a normal dependency range. `packageExtensions` lives in `package.json`, so npm now rejects it during publish for non-private packages to avoid publishing root-only application policy.

Those constraints are useful for the declarative feature, but they leave a real gap for projects that need more expressive local install policy. During the [Package Manifest Extensions proposal discussion](https://github.com/npm/rfcs/pull/889#issuecomment-4634294326), a Gutenberg migration example showed a long `packageExtensions` block that repeated the same `@types/react` optional peer repair across many React-related dependencies. The declarative form was still understandable, but the repeated structure made the intended policy harder to maintain than the underlying rule. In code, the same repair can be written as a named list or predicate with comments and links to upstream issues. For example, a project might want to express "these packages import React types but do not declare an optional `@types/react` peer" once, then apply that repair to a list of package names. Large repositories also need conditional repairs.

Examples include adding `@types/react-dom` only when a package already declares a `react-dom` peer, narrowing a peer range only for a known bad version family, or copying an existing peer range into a corresponding type package dependency. Those cases can be encoded as generated JSON, but generated `packageExtensions` turns review into generated-output review instead of policy review. A root-owned imperative extension file keeps the policy itself in source control. The publish behavior from the [Package Manifest Extensions proposal](https://github.com/npm/rfcs/pull/889) creates another motivation. A public library with a single root `package.json` may need local dependency repairs for its own tests, build, or linked-install migration, but it cannot publish while `packageExtensions` is present in `package.json`.

Moving the imperative form to `.npm-extension.mjs` / `.npm-extension.cjs` gives npm a non-package-manifest location for local install policy, so public packages can use the extension locally without adding that policy to the published registry manifest. The expected outcome is not to make every project write install-time extension code. The expected outcome is to give advanced projects an explicit escape hatch when the accepted declarative subset is too repetitive, too limited, or in the wrong file.

## Detailed Explanation

### npm extension file location

npm should look for one root `.npm-extension.mjs` or `.npm-extension.cjs` file next to the root project lockfile by default. In a workspace project with a shared lockfile, the file lives at the workspace root. Dependency packages and non-root workspace packages are not allowed to provide extensions that affect their consumers. npm should ignore `.npm-extension` files from dependency packages. npm should warn when a non-root workspace package contains `.npm-extension.mjs` or `.npm-extension.cjs`, because a workspace author might otherwise assume that file is active. If both `.npm-extension.mjs` and `.npm-extension.cjs` are present in the same root, npm should fail with a clear error instead of choosing one implicitly. The `.mjs` form uses ESM exports, and the `.cjs` form uses CommonJS exports.

There is intentionally no `.npm-extension.js` form, because resolving the module format through package `type` would make a root install policy file less obvious to read. npm should also add an `extension-file` path config with a default of `null`. When `extension-file` is unset, npm uses the default root discovery behavior above. When `extension-file` is set, npm loads that configured file instead of discovering `.npm-extension.mjs` or `.npm-extension.cjs`. Relative `extension-file` values are resolved from the project root, and the configured path must still point inside the project root. The configured file must use a `.mjs` or `.cjs` extension. To avoid turning `extension-file` into an implicit global extension mechanism, npm should accept `extension-file` only from project configuration or an explicit command-line option. npm should reject `extension-file` values from user, global, or builtin config sources.

The `.npm-extension` name is intentionally broader than the manifest repair extension point defined by this RFC. Future RFCs may add other root-owned extension points to the same file without introducing a second JavaScript policy file at the project root.

### Extension point shape

This RFC defines only one extension point: `transformManifest`. The extension point name is intentionally not `readPackage`. npm's implementation and user-facing docs already use "manifest" for package metadata, and this extension point transforms an already-read manifest before Arborist consumes its dependency edges.

Example `.npm-extension.mjs`:

```js
const reactTypePeerPackages = new Set([
  '@ariakit/react-core',
  '@ariakit/test',
  '@dnd-kit/accessibility',
  '@dnd-kit/core',
  '@dnd-kit/sortable',
  '@dnd-kit/utilities',
  '@emotion/primitives-core',
  '@emotion/use-insertion-effect-with-fallbacks',
  '@floating-ui/react-dom',
  '@use-gesture/react',
  'cmdk',
  'framer-motion',
  're-resizable',
  'react-autosize-textarea',
  'react-colorful',
  'react-day-picker',
  'react-easy-crop',
  'react-freeze',
  'reselect',
  // See https://github.com/example/use-latest-callback/issues/1234.
  'use-latest-callback',
])

export function transformManifest (pkg, context) {
  if (!reactTypePeerPackages.has(pkg.name)) {
    return pkg
  }

  // These packages import React types but do not declare the optional peer.
  // Remove this repair when the upstream manifests are fixed.
  pkg.peerDependencies = {
    ...pkg.peerDependencies,
    '@types/react': '*',
  }
  pkg.peerDependenciesMeta = {
    ...pkg.peerDependenciesMeta,
    '@types/react': {
      ...pkg.peerDependenciesMeta?.['@types/react'],
      optional: true,
    },
  }
  context.log(`added optional @types/react peer metadata to ${pkg.name}`)
  return pkg
}
```

Example `.npm-extension.cjs`:

```js
module.exports = {
  transformManifest (pkg, context) {
    if (pkg.name === 'foo' && pkg.version.startsWith('1.')) {
      pkg.dependencies = {
        ...pkg.dependencies,
        bar: '^2.0.0',
      }
      context.log('added bar to foo@1')
    }
    return pkg
  },
}
```

A project may also throw intentionally when an upstream package no longer needs a local repair:

```js
export function transformManifest (pkg) {
  if (pkg.name !== 'some-package') {
    return pkg
  }

  if (pkg.peerDependencies?.['@types/react']) {
    throw new Error('Remove the some-package @types/react repair from .npm-extension; upstream now declares it.')
  }

  pkg.peerDependencies = {
    ...pkg.peerDependencies,
    '@types/react': '*',
  }
  return pkg
}
```

`transformManifest(pkg, context)` receives a deeply isolated mutable copy of a candidate dependency manifest. The extension point may mutate and return the same object or return a new manifest object. The extension point must return a manifest object synchronously; returning `null`, `undefined`, a primitive, an array, or a promise is an error. Synchronous extension points are deliberate. They reduce the risk of network-dependent installs, make extension execution easier to reason about during resolution, and avoid repeating pnpm's lockfile-staleness behavior where users may need to manually delete the lockfile after changing `readPackage` output.

The `context` object should be intentionally small:

- `context.log(message)` writes an npm debug log message associated with the extension point.
- `context.root` is the absolute path to the project root.
- `context.extensionPoint` is the string `"transformManifest"`.

npm should not provide registry, fetch, lockfile mutation, or package extraction helpers. This is not a sandbox, because the extension point still runs as project-owned JavaScript in Node. Documentation should recommend keeping the extension file self-contained or limited to Node builtins, because importing project dependencies is not portable from a clean checkout. npm should not guarantee that packages from the project dependency graph are available when `.npm-extension` is loaded. When projects import local helper files from `.npm-extension`, those helper files are outside the entry-file hash described by this RFC. Projects that want lockfile staleness detection for extension logic should keep the repair logic and data in the selected `.npm-extension.mjs` or `.npm-extension.cjs` entry file.

### Extension timing

npm should call `transformManifest` after it reads or fetches a non-workspace dependency manifest and before Arborist reads that manifest's outgoing dependency and peer edges. The extension point operates on in-memory manifest metadata. npm should call `transformManifest` at most once per unique resolved package identity during a single ideal-tree build and cache the effective manifest for that build. This identity-keyed cache is new implementation work for imperative extension output, separate from any existing raw-manifest cache keyed by the requested spec. The cache key should identify the resolved package instance rather than the incoming edge, so the same resolved package is not repeatedly transformed for every dependent that reaches it. The key should use the package integrity when available. When integrity is unavailable, the key should use the resolved URL or source identity plus the manifest name and version. These rules apply to any non-root, non-workspace dependency manifest that Arborist reads for ideal-tree construction, including registry packages, git dependencies, remote tarball dependencies, and local file, directory, or symlinked dependency manifests. The source-identity fallback exists for those cases where integrity may be unavailable or insufficient to identify the manifest before transformation. Supporting local directory and symlinked dependency manifests requires new wiring for Arborist paths that create `Link` nodes rather than fetched package nodes. npm must call `transformManifest` with a deeply isolated copy of the normalized manifest and must not mutate pacote's cached manifest object or any nested object reachable from it.

When npm reuses a transformed manifest result, it should pass consumers a deeply isolated copy rather than a shared mutable object. The package tarball and the installed `node_modules/<package>/package.json` file are not rewritten by this feature. The extension point is not called for the root project package. The extension point is not called for workspace package manifests, because workspace package manifests are source-controlled project files that should be edited directly. The extension point is not called for installed dependency `.npm-extension` files. This keeps the authority model the same as `packageExtensions`: only the root project can change the dependency graph that npm resolves.

### Supported mutations

The extension point may modify dependency metadata before resolution.

The fields that affect manifest-extension resolution are:

- `dependencies`
- `optionalDependencies`
- `peerDependencies`
- `peerDependenciesMeta`

Unlike `packageExtensions`, the extension point can delete entries from these fields because the returned manifest is the effective manifest npm will read. Unlike `packageExtensions`, the extension point can replace existing normal dependency ranges, although `overrides` remains the preferred tool when the only goal is to force a different resolution target for an existing edge. This makes the extension point an explicit advanced escape hatch for cases where the declarative merge rules are not expressive enough. npm should validate the returned manifest with the same manifest normalization and dependency field validation it uses for package metadata during ideal tree construction. If the extension point creates an invalid manifest, npm should fail the install with an error that names `.npm-extension` and the package being processed.

If the extension point throws, npm should fail the install with an error that names `.npm-extension`, `transformManifest`, and the package being processed. This makes intentional throws useful as stale-repair guards when a project wants CI to fail after an upstream package fixes metadata that the extension file was repairing locally. Changes to fields outside dependency and peer metadata are not supported by this RFC. Only the four fields listed above are honored as extension output. npm should start from a normalized baseline manifest, apply returned values for those allowlisted fields, and reject returned manifests that change other package fields such as `scripts`, `bin`, `engines`, `os`, `cpu`, `exports`, `main`, `types`, `bundleDependencies`, and `bundledDependencies`.

This avoids pnpm's documented ambiguity where changing `scripts` in `readPackage` does not affect package build behavior because build logic reads the manifest from the package archive. Users who need package contents or on-disk `package.json` changes should use native dependency patching, a fork, lifecycle-script policy, or publish-time manifest controls.

### Resolution order

When both `.npm-extension` and `packageExtensions` are present, npm should apply them in this order:

1. Load the root `.npm-extension` file if present.
2. Load the root `packageExtensions` rule set if present.
3. Fetch or read a candidate dependency manifest.
4. Apply `transformManifest` to a deeply isolated per-ideal-tree copy of that manifest.
5. Apply the matching `packageExtensions` rule to the extension output.
6. Read dependency and peer edges from the resulting effective manifest.
7. Apply `overrides` while resolving those edges.
8. Build and reify the resulting ideal tree according to the selected `install-strategy`.

Both mechanisms may affect the same dependency package, but projects should usually avoid targeting the same package with both mechanisms unless they intend to rely on the ordering below. When they do, `packageExtensions` is applied to the manifest returned by `transformManifest`, and its normal validation and conflict rules still apply to that resulting manifest. For example, if `transformManifest` adds `dependencies.bar`, a later `packageExtensions` rule for the same package must not also try to add or conflict with `dependencies.bar` in a way that would be invalid for ordinary `packageExtensions` application. `transformManifest` changes the ideal dependency graph, not the filesystem layout. The selected `install-strategy` is applied after the graph is resolved, so extension output should be the same for `hoisted`, `nested`, `shallow`, and `linked` installs. Running `transformManifest` before `packageExtensions` keeps the accepted `packageExtensions` merge rules and provenance model intact.

It also lets `transformManifest` inspect the upstream manifest before declarative repairs are applied, which is important for stale-repair guards that need to detect whether upstream has already fixed the package. For the insertion point, this order matches the current Arborist implementation shape: npm can run `transformManifest` before calling the existing `packageExtensions` apply step, leaving `packageExtensions` validation and provenance unchanged. The identity-keyed transform cache and the `npm ci` no-execution behavior are separate implementation work. If a project wants the imperative extension point to have final authority for a package, it should not also declare a `packageExtensions` rule for the same package.

### Lockfile behavior

A lockfile influenced by `.npm-extension` must record that influence. The root lockfile entry should record a digest over the selected `.npm-extension` file contents and module format. The digest should not include an absolute path or machine-specific configured path.

For example:

```json
{
  "packages": {
    "": {
      "npmExtensionHash": "sha512-..."
    },
    "node_modules/foo": {
      "version": "1.0.0",
      "dependencies": {
        "bar": "^2.0.0"
      },
      "npmExtensionApplied": {
        "extensionPoint": "transformManifest",
        "dependencies": [
          "bar"
        ],
        "peerDependencies": [
          "@types/react"
        ],
        "peerDependenciesMeta": [
          "@types/react"
        ]
      }
    }
  }
}
```

`npmExtensionApplied` should include `extensionPoint: "transformManifest"` plus one key for each changed allowlisted field. Each changed field key should contain a sorted array of dependency names affected in that field. The sorted order is a deterministic lockfile requirement for this feature, even if existing `packageExtensions` provenance preserves insertion order. The hash should be computed from an exact prefix and the bytes of the selected extension file after npm has selected the file to load. For `.mjs`, npm should hash `utf8("npm-extension:v1:mjs\n")` followed by the raw file bytes. For `.cjs`, npm should hash `utf8("npm-extension:v1:cjs\n")` followed by the raw file bytes. If there is no `.npm-extension`, npm records no `npmExtensionHash` and no `npmExtensionApplied` provenance. `npm ci` should not execute `transformManifest` when it can reify the locked graph from matching lockfile state. If the root `.npm-extension` is present but the lockfile lacks matching extension state, `npm ci` must fail.

If the lockfile contains extension state but the root `.npm-extension` is absent, `npm ci` must fail. If the root `.npm-extension` content changes, `npm install` must treat the locked dependency graph as stale and re-resolve using the new extension output. If the root `.npm-extension` content changes, `npm ci` must fail until the lockfile is regenerated. Package entries should continue to store their effective `dependencies`, `optionalDependencies`, `peerDependencies`, and `peerDependenciesMeta` after extension application. Package entries affected by `transformManifest` should store minimal provenance rather than a copy of the extension output. npm should compare the dependency and peer metadata before and after the extension point to decide whether `npmExtensionApplied` is needed for a package entry and which dependency names it should list.

The `npm ci` path should verify the selected extension file hash before importing any extension module. When the hash and lockfile extension state match, `npm ci` should reify from the locked effective dependency metadata. For directory or symlinked dependency sources, that means extension-influenced dependency edges recorded in the lockfile take precedence over the linked target's live manifest while `npm ci` is avoiding extension execution. If the implementation still constructs an ideal tree internally for `npm ci`, that path must run in a mode that trusts matching locked extension metadata and disables `transformManifest` execution. If npm cannot prove the lockfile extension state matches the selected extension file before such a build, `npm ci` must fail rather than execute `.npm-extension`.

Names recorded in `npmExtensionApplied` are affected dependency names, not only names for edges that still exist after transformation. For a created or changed edge, the affected name appears in the effective dependency field stored on the same package entry. For a deleted edge, the affected name appears in `npmExtensionApplied` but is absent from the effective dependency field, and that absence must not be treated as stale lockfile metadata.

Unlike `packageExtensions`, arbitrary JavaScript has no selector that lets npm predict which packages a changed extension file will affect. When `.npm-extension` content changes, `npm install` should not rely only on old provenance or selector-based selective re-resolution. It should re-run `transformManifest` across candidate manifests, subject to the per-identity cache, and rebuild the dependency graph from the new effective manifests. `npm ci` validation for `transformManifest` is hash-based: it verifies the selected extension entry file bytes and the lockfile's extension state without selector-level revalidation or extension execution.

npm should use the same minimum `lockfileVersion` required by `packageExtensions` lockfile state so older npm versions do not silently regenerate a lockfile that drops extension-influenced dependency metadata. In the current npm CLI implementation that minimum is `lockfileVersion: 4`, and the implementation should reuse the same centralized lockfile-version threshold rather than adding a second one. The lockfile hash does not make arbitrary JavaScript deterministic. It only proves that the install is using the same extension file bytes that generated the lockfile. Projects that make extension output depend on environment variables, the network, the clock, local files imported by the extension file, or other untracked inputs can still create non-reproducible installs. Projects should not make extension output depend on the selected `install-strategy`. Documentation should say that `.npm-extension` must be treated as trusted, deterministic project code. This still catches the common and reviewable case where the extension entry file itself changes without requiring users to manually delete or regenerate a lockfile.

`npm ci` can fail before trusting stale extension-influenced lockfile metadata when the recorded entry-file hash does not match.

### Visibility

Extension-created, extension-changed, or extension-removed dependency metadata should be visible in npm inspection commands.

Example `npm explain` output:

```text
bar@2.0.0
node_modules/bar
  bar@"^2.0.0" from foo@1.0.0 (changed by .npm-extension.mjs transformManifest dependencies.bar)
```

Example `npm ls` annotation:

```text
my-project@1.0.0
`-- foo@1.0.0 [.npm-extension: dependencies.bar]
    `-- bar@2.0.0
```

The goal is the same as the visibility requirement from the [Package Manifest Extensions proposal](https://github.com/npm/rfcs/pull/889): local install policy should be easy to audit and easy to remove.

The text format should mirror npm's existing `packageExtensions` annotations by showing the extension source and the affected `field.name` near the edge or node it explains. When one `transformManifest` call changes multiple fields or names, human output should render each relevant `field.name` where it is useful, and JSON output should expose the full `npmExtensionApplied` object recorded for the package.

Removed dependency edges cannot be annotated on an edge object because no edge exists after transformation. npm should surface deletion provenance on the source package node in human output and in JSON using `npmExtensionApplied`. For example, if a package entry lists `bar` in `npmExtensionApplied.dependencies` but the effective `dependencies` object has no `bar` entry, `.npm-extension` removed `dependencies.bar` from that package's resolved dependency graph. `npm explain` should annotate created or changed edges when an edge exists; deletion visibility may appear when explaining the package whose manifest was transformed or in `npm ls` and JSON output rather than when explaining the removed package.

### Lifecycle and security behavior

`.npm-extension` is root-owned install-time code. It is never loaded from dependency packages, and dependency packages cannot publish an `.npm-extension` that changes their consumers' dependency graphs. The security model is the same root-authority model used by `overrides` and `packageExtensions`, but with a larger local trust surface because the policy is JavaScript rather than data. npm should therefore treat `.npm-extension` as trusted project code and document that users should only run installs with `.npm-extension` enabled in repositories they trust. The extension point receives no npm-provided network, registry, fetch, lockfile mutation, package extraction, or lifecycle-script helpers. The extension point can still use JavaScript and Node APIs available to the running npm process, so this RFC does not claim sandboxing. Lifecycle-script behavior is not controlled through `transformManifest`.

Changing or deleting `scripts` in the extension output is unsupported and must not be relied on to prevent dependency lifecycle scripts from running. Projects that need lifecycle-script policy should use npm's script policy features, including the accepted install-scripts opt-in work.

### Disable behavior

npm should add an `ignore-extension` boolean config with a default of `false`. When `ignore-extension=true`, npm does not import or execute `.npm-extension.mjs` or `.npm-extension.cjs`. When `ignore-extension=true`, npm also does not import or execute a file configured through `extension-file`. When `ignore-scripts=true`, npm should also behave as if `ignore-extension=true`. This follows the conservative interpretation that users who disable install-time code should not run root install-time extension code either. `npm ci` is different because it can use the effective dependency metadata already recorded in the lockfile. When `npm ci` sees `npmExtensionHash` or `npmExtensionApplied`, it should verify the recorded extension hash and provenance without importing or executing `.npm-extension`. When `ignore-extension=true`, `npm ci` should still resolve and read the selected extension file for hash verification.

This means `npm ci` should still honor `extension-file` for selecting the file whose bytes are hashed, while skipping import and execution. `npm ci --ignore-extension` and `npm ci --ignore-scripts` should therefore succeed when the lockfile's extension state matches the extension entry file bytes. When `ignore-extension=true`, `npm install` may regenerate the lockfile without extension state. The dedicated `ignore-extension` config is useful even though `ignore-scripts=true` also disables this extension file, because lifecycle scripts and root-owned package-manager extension code are different install surfaces.

### Publish behavior

`.npm-extension.mjs` and `.npm-extension.cjs` are npm project configuration files, not package contents. npm should not include root `.npm-extension.mjs` or `.npm-extension.cjs` in the package tarball produced by `npm pack` or `npm publish`, even if the package's `files` list includes it. This follows npm's existing packlist model for strict exclusions such as `.npmrc`, VCS metadata, and patch files declared through native dependency patching, where project-local tool files are not package contents even when a broad `files` entry would otherwise include them. Because the extension file does not live in `package.json`, it does not affect the registry manifest or the packument for a public package. This is the main reason to prefer `.npm-extension` over adding a more powerful imperative field to `package.json`. A public package can use `.npm-extension` locally for its own install, tests, and linked-install migration without publishing that policy to its consumers.

## Rationale and Alternatives

### Why not extend `packageExtensions`?

`packageExtensions` is intentionally data. That makes it easy to review, hash, validate, explain, and keep out of arbitrary install-time code execution. Adding comments, conditionals, loops, deletion, or computed ranges to `packageExtensions` would turn it into a programming language inside `package.json`. `.npm-extension` keeps the declarative field simple and gives advanced users an explicit code-based surface when they need one.

### Why not generate `packageExtensions`?

A project can generate a large `packageExtensions` object from a script. That can work, but it moves review from the policy to generated JSON output. It also leaves the publish problem in place for public packages, because the generated data still lives in `package.json`. A checked-in `.npm-extension` lets reviewers read the policy directly, including comments and links to upstream issues.

### Why not put extension code in `package.json`?

Putting executable or computed policy in `package.json` has the same publication problem as `packageExtensions`, and it is worse for packument size and reviewability. If public packages are expected to use this locally, the configuration should not live in the package manifest that gets published to npm.

### Why allow root install-time JavaScript at all?

npm should continue to steer most users toward `packageExtensions`, `overrides`, native dependency patching, and lifecycle-script policy before they reach for `.npm-extension`. This RFC adds JavaScript only for the gap those declarative mechanisms intentionally leave: repeated manifest repairs, conditional repairs, deletion, stale-repair guards, and local policy that cannot live in a publishable `package.json`. The alternative is not always "no JavaScript"; large projects can already generate `packageExtensions`, fork packages, or move the policy into lifecycle scripts that run later and cannot affect the ideal dependency graph. `.npm-extension` makes that advanced policy explicit, root-owned, pre-resolution, lockfile-visible, publish-excluded, and disabled by the same install-time-code posture as `ignore-scripts` for commands that would otherwise execute it. For `npm ci`, npm should rely on the locked effective dependency metadata and verify extension state without executing the extension file.

This keeps a common no-script CI workflow available while still requiring a matching lockfile when a project uses `.npm-extension`.

### Why not call the file `.npmfile`?

`.npmfile` would be familiar to pnpm users, but it is vague and closely mirrors pnpm's naming. Copying the pnpm name would make the npm feature look like it intends to implement the same extension surface and compatibility contract. That is not the goal of this RFC. pnpm's file is a broad extension point that includes manifest hooks, lockfile mutation, pack hooks, custom resolvers, and custom fetchers. This RFC borrows the useful idea of a root-owned JavaScript policy file, but it deliberately defines npm-specific semantics for trust, lockfile validation, publish exclusion, disable behavior, and supported mutations. This RFC considered `.npm-hooks` because the file exports extension functions and could grow to hold future extension surfaces. However, npm already has an `npm hook` command and registry hook terminology for webhook-style registry event notifications.

Using `.npm-hooks` for install-time project policy would risk confusing local package-manager extension points with registry webhooks. This RFC uses `.npm-extension` instead because the file belongs to npm, avoids that existing terminology collision, and can remain the root JavaScript policy file if future RFCs add resolver, fetcher, pack, or other extension surfaces. The file name should not be limited to manifest repairs, because this RFC intentionally leaves room for future extension points without introducing another project-root JavaScript configuration file. The name is adjacent to `packageExtensions`, but it is not the imperative form of that field. `packageExtensions` is a declarative package-manifest field for common manifest repairs, while `.npm-extension` is a project-local JavaScript file that can host npm extension points now or in future RFCs.

### Why `transformManifest` instead of `readPackage`?

`readPackage` is pnpm's established hook name, but it is not quite accurate for npm's proposed API. Copying that name would again imply more compatibility with pnpm than this RFC provides. npm has already read or fetched the candidate package manifest before the extension point runs. The extension point receives that manifest, transforms the dependency metadata npm will consume, and returns the effective manifest. `transformManifest` also uses npm's existing "manifest" terminology from pacote, Arborist, lockfile metadata, publish, and pack behavior.

### Why top-level extension points instead of a `hooks` object?

The `.npm-extension` file is already the namespace. Putting `transformManifest` under a `hooks` object would copy pnpm's module shape without adding much value to npm. It would also keep "hook" in the public API after this RFC avoids `.npm-hooks` as the file name to prevent confusion with registry hooks. Top-level named exports make each supported extension point explicit and easy to validate. Future RFCs can add additional top-level extension points such as resolver, fetcher, or pack-related functions without changing the shape of the first extension point.

### Why `extension-file` and `ignore-extension`?

pnpm names the equivalent controls after pnpm's file name: `pnpmfile`, `ignorePnpmfile`, and `globalPnpmfile`. Because this RFC does not use `.npmfile`, the npm config names should describe the npm concept being controlled rather than copying pnpm's spelling. The file name keeps the `npm` prefix because it lives in the project root beside other tool dotfiles, while npm config keys are already npm-owned and do not need a second `npm-` prefix. `extension-file` means "use this project-local npm extension file path" without implying pnpm compatibility. `ignore-extension` means "disable npm extension execution" and can continue to make sense if future RFCs add resolver, fetcher, pack, or other extension points to `.npm-extension`.

### Why not support a global extension file?

pnpm supports `globalPnpmfile`, and npm may want an equivalent in the future for users or organizations that need to share dependency repair policy across projects. A global extension file would let user- or machine-level JavaScript alter a project's ideal tree outside the repository review boundary. This RFC focuses on project-local extension policy first, where the extension file can be reviewed with the project and represented in the project lockfile. For the same reason, this RFC limits `extension-file` to project configuration or an explicit command-line option rather than accepting user or global config values. If npm later supports a global extension file, it needs explicit semantics for lockfile hashing, provenance, `npm ci` validation, config precedence, and interaction with `ignore-extension`.

### Why not support all pnpm hooks?

pnpm's `.pnpmfile` supports more than `readPackage`, including lockfile mutation, pack hooks, custom resolvers, and custom fetchers. This RFC proposes the dependency manifest extension point because it builds directly on the phase introduced by the [Package Manifest Extensions implementation](https://github.com/npm/cli/pull/9496). Lockfile mutation, custom resolution, custom fetching, and pack-time manifest editing are different package-manager extension surfaces. Keeping them out of this RFC avoids turning a targeted dependency-manifest repair feature into a general plugin system. It also avoids repeating pnpm's broad hook surface before npm has a lockfile and security model for each additional hook type.

### Why not require native dependency patching?

Native dependency patching is appropriate when the package contents or the installed `package.json` file must change on disk. Manifest extension points are needed earlier, before Arborist reads outgoing dependency and peer edges. A patch applied during reify cannot retroactively change the ideal dependency tree that npm already resolved.

## Implementation

The implementation should build on the `packageExtensions` phase added to `npm/cli` and Arborist in https://github.com/npm/cli/pull/9496. The current implementation already has a phase that repairs manifest metadata before dependency and peer edges are created. The `transformManifest` extension point should operate in that same phase, before `packageExtensions` is applied.

Some behavior in this RFC is intentionally new rather than inherited from `packageExtensions`. npm needs an identity-keyed effective-manifest cache for `transformManifest` output, a deeply isolated manifest copy for user JavaScript before any user code runs, support for Arborist paths that create `Link` nodes for local dependency sources, linked-install actual-tree handling that preserves extension-created edges and provenance, a `npm ci` path that verifies extension state without executing the extension function, and source-aware config validation for `extension-file`.

### Affected packages

- **`npm/cli/workspaces/arborist`**
  - Load the root `.npm-extension.mjs`, `.npm-extension.cjs`, or configured `extension-file` once during ideal tree construction.
  - Reject projects that contain both `.npm-extension.mjs` and `.npm-extension.cjs`.
  - Call `transformManifest` with a deeply isolated per-ideal-tree manifest copy before reading dependency and peer edges.
  - Cache `transformManifest` output once per unique resolved package identity during an ideal-tree build, using a new effective-manifest cache rather than the existing raw-manifest cache keyed by requested spec.
  - Keep extension mutations isolated from pacote's cached manifest objects, including nested objects not honored as extension output.
  - Reject extension-point return values that are not manifest objects, including promises.
  - Skip root and workspace package manifests as extension targets.
  - Run `transformManifest` for non-root, non-workspace dependency manifests regardless of whether they came from the registry, git, a remote tarball, a local file, a local directory, or a symlinked dependency source.
  - Add transform support for local dependency sources that currently create `Link` nodes rather than fetched package nodes.
  - Ignore `.npm-extension` files from installed dependencies.
  - Check workspace directories for `.npm-extension.mjs` or `.npm-extension.cjs` and warn when non-root workspace packages contain one.
  - Validate the extension-point return value before dependency edges are read.
  - Honor only `dependencies`, `optionalDependencies`, `peerDependencies`, and `peerDependenciesMeta` changes.
  - Reject changes to non-allowlisted manifest fields such as `scripts`, `bin`, `engines`, `os`, `cpu`, `exports`, `main`, `types`, `bundleDependencies`, and `bundledDependencies`.
  - Compare dependency and peer metadata before and after extension execution to record field-and-name provenance with sorted dependency-name arrays.
  - Treat deleted dependency names in `npmExtensionApplied` as valid node-level provenance even when no corresponding edge exists after transformation.
  - Apply peer-related `transformManifest` changes before virtual package / peer-set identity is calculated for linked installs.
  - Record the root extension hash and affected package provenance in the lockfile.
  - Re-run `transformManifest` across candidate manifests when the selected extension file changes instead of using the selector-based selective re-resolution model from `packageExtensions`.
  - Preserve extension-created edges and provenance when loading the linked actual tree, following the `packageExtensions` actual-tree fix in https://github.com/npm/cli/issues/9568 and https://github.com/npm/cli/pull/9569.
  - Ensure extension-influenced edges participate in peer resolution, deduplication, auditing, lifecycle-script policy, and all install strategies.
  - Surface extension provenance through edge and node explanation data.

- **`npm/cli`**
  - Add root file discovery for `.npm-extension.mjs` and `.npm-extension.cjs`.
  - Add the `ignore-extension` config.
  - Add the `extension-file` config for selecting a project-local extension file path.
  - Add source-aware config validation so `extension-file` values from user, global, or builtin config sources are rejected.
  - Add config flattening or command-level logic so `ignore-scripts=true` implies `ignore-extension=true`.
  - Add `npm ci` validation for extension hash state and stale extension provenance without importing or executing `.npm-extension`.
  - Ensure `npm ci` does not accidentally run the ideal-tree extension execution path while validating or reifying the locked tree.
  - Surface extension provenance in `npm ls` and `npm explain`.
  - Depend on a version of `npm-packlist` that excludes `.npm-extension.mjs` and `.npm-extension.cjs` from package tarballs.

- **`npm/cli/workspaces/package-json`**
  - No package manifest field is required for this RFC.

- **`npm/cli/docs`**
  - Document `.npm-extension.mjs`, `.npm-extension.cjs`, the `transformManifest` extension point, root-only behavior, lockfile behavior, interaction with `packageExtensions`, interaction with `overrides`, publish behavior, and deterministic extension guidance.

- **`npm-packlist`**
  - Force-exclude root `.npm-extension.mjs` and `.npm-extension.cjs` files from package tarballs.
  - Keep those files excluded even when the package's `files` list includes them.

- **`pacote`**
  - Depend on a version of `npm-packlist` that implements the `.npm-extension` tarball exclusion.

### Tests

Required test coverage:

- File discovery:
  - `.npm-extension.mjs` is loaded from the root next to the lockfile.
  - `.npm-extension.cjs` is loaded from the root next to the lockfile.
  - `extension-file=path/to/npm-extension.mjs` loads the configured project-local file instead of the default root file.
  - `extension-file` rejects paths outside the project root.
  - `extension-file` rejects files without a `.mjs` or `.cjs` extension.
  - `extension-file` rejects values from user, global, or builtin config sources.
  - A project with both files fails with a clear error.
  - A dependency package's `.npm-extension` is ignored.
  - A non-root workspace package's `.npm-extension` is ignored with a warning.

- Extension execution:
  - `transformManifest` can add a missing dependency edge.
  - `transformManifest` can add a missing peer dependency edge.
  - `transformManifest` can add `peerDependenciesMeta.<peer>.optional`.
  - `transformManifest` can replace an existing normal dependency range.
  - `transformManifest` can delete a dependency entry from a supported dependency field.
  - `transformManifest` can repair non-root, non-workspace dependency manifests from registry, git, remote tarball, local file, local directory, and symlinked dependency sources.
  - Returning `null`, `undefined`, a primitive, or an array fails with a clear error.
  - Returning a promise fails with a clear error.
  - Throwing from the extension point fails the install with package and extension-point context.
  - Unsupported field changes are rejected consistently.
  - `transformManifest` is called at most once per unique resolved package identity during one ideal-tree build.
  - Mutating the manifest passed to `transformManifest` does not mutate pacote's cached manifest object.
  - Mutating nested non-allowlisted manifest objects passed to `transformManifest` does not mutate pacote's cached manifest object.

- Interaction with `packageExtensions` and `overrides`:
  - `transformManifest` runs before `packageExtensions`.
  - `transformManifest` and `packageExtensions` can both apply to the same package.
  - `packageExtensions` can add a dependency to the extension output.
  - `packageExtensions` validation still rejects invalid normal dependency conflicts after extension output.
  - `overrides` sees extension-created edges.

- Lockfile behavior:
  - `npm install` records a root extension hash and minimal affected-package provenance.
  - The root extension hash uses the exact `.mjs` or `.cjs` prefix plus raw file bytes.
  - `npmExtensionApplied` records each changed allowlisted field with a sorted array of changed dependency names.
  - `npmExtensionApplied` can record a deleted dependency name that no longer appears in the effective dependency field.
  - `npm install` stores effective dependency and peer metadata after extension application.
  - `npm ci` succeeds when the extension hash and lockfile state match.
  - `npm ci` does not execute `transformManifest` when the extension hash and lockfile state match.
  - `npm ci` uses locked effective dependency edges for extension-influenced directory or symlinked dependency sources instead of the linked target's live manifest when extension execution is disabled by matching lockfile state.
  - `npm ci` accepts deletion provenance when the extension hash and lockfile state match.
  - `npm ci` fails before importing `.npm-extension` when the selected extension file hash does not match the lockfile.
  - `npm ci` fails when the extension file changes without updating the lockfile.
  - `npm ci` fails when the extension file is absent but extension state is present in the lockfile.
  - `npm ci` fails when the extension file is present but extension state is absent from the lockfile.
  - `npm install` re-runs `transformManifest` across candidate manifests after the extension file changes, including packages that were not listed in old extension provenance.
  - An extension-influenced lockfile remains valid when switching between `install-strategy=hoisted` and `install-strategy=linked`.

- Install strategies:
  - A missing dependency repaired by `transformManifest` installs under `install-strategy=hoisted`, `nested`, `shallow`, and `linked`.
  - A dependency repaired by `transformManifest` remains visible to actual-tree commands under `install-strategy=linked`.
  - Peer dependency and `peerDependenciesMeta` changes from `transformManifest` are applied before linked-install peer-set identity is calculated.
  - The extension context does not expose the selected `install-strategy`.

- Disable behavior:
  - `ignore-extension=true` prevents the extension point from running.
  - `ignore-extension=true` also prevents a configured `extension-file` from running.
  - `ignore-scripts=true` prevents the extension point from running.
  - `npm ci --ignore-extension` still honors `extension-file` for extension hash verification.
  - `npm ci --ignore-extension` succeeds without executing `transformManifest` when the lockfile contains matching extension state.
  - `npm ci --ignore-scripts` succeeds without executing `transformManifest` when the lockfile contains matching extension state.
  - `npm install --ignore-extension` can regenerate a lockfile without extension state.
  - `npm install --ignore-scripts` can regenerate a lockfile without extension state.

- Visibility:
  - `npm explain` identifies extension-created or extension-changed edges with `field.name` annotations consistent with existing package-extension output.
  - Removed dependency edges are surfaced as node-level provenance in `npm ls` and JSON output rather than as edge annotations.
  - `npm ls --json` exposes the full `npmExtensionApplied` metadata for affected nodes or edges.

- Publish behavior:
  - `npm pack` does not include `.npm-extension.mjs` or `.npm-extension.cjs` in the tarball.
  - `npm publish --dry-run` does not include `.npm-extension.mjs` or `.npm-extension.cjs` in the tarball.
  - `.npm-extension.mjs` and `.npm-extension.cjs` are excluded even when the package's `files` list includes them.
  - A public package can keep `.npm-extension` in its repository without failing publish.

## Prior Art

### pnpm `.pnpmfile.mjs` / `.pnpmfile.cjs`

pnpm supports install hooks in `.pnpmfile.mjs` and `.pnpmfile.cjs`: https://pnpm.io/pnpmfile. Its `hooks.readPackage(pkg, context)` hook runs after pnpm parses a dependency manifest and before resolution. The returned manifest affects what gets resolved into the lockfile and installed. This RFC adopts that core manifest-transform idea but avoids three parts of pnpm's design that are not a good fit for npm's manifest-extension surface:

1. npm should not require users to manually delete the lockfile after changing `readPackage` output; the extension hash in `package-lock.json` should make stale extension state fail loudly.
2. npm should not make lifecycle-script behavior depend on manifest mutations that are not actually used by the build step; unsupported fields such as `scripts` are rejected instead.
3. npm should not expose lockfile mutation, pack hooks, custom resolvers, or custom fetchers through this RFC, because each one needs its own security and lockfile model.

### npm `packageExtensions`

The accepted [Package Manifest Extensions proposal](https://github.com/npm/rfcs/pull/889) added declarative root-owned package manifest repairs to npm. The [npm CLI implementation](https://github.com/npm/cli/pull/9496) created the pre-resolution manifest repair phase, lockfile hash validation, lockfile provenance, publish behavior, and `npm explain` / `npm ls` visibility model that this RFC builds on.

### Yarn and pnpm `packageExtensions`

Yarn and pnpm both support declarative `packageExtensions` for common dependency manifest repairs. Those features are still the best fit for simple, reviewable data-only repairs. This RFC is for the cases where declarative data becomes repetitive or cannot express the needed local policy. Yarn's documentation also keeps the same conceptual split npm adopted in the [Package Manifest Extensions proposal](https://github.com/npm/rfcs/pull/889): use package extensions for missing manifest metadata and use resolutions when rewriting existing dependency resolutions is the goal. That supports keeping `.npm-extension` as an advanced escape hatch rather than replacing the declarative feature.

### Yarn plugins and constraints

Yarn supports JavaScript-based plugins and constraints for project policy: https://yarnpkg.com/features/extensibility and https://yarnpkg.com/features/constraints. The useful lesson for npm is that imperative package-manager code should be explicit project configuration, not hidden inside a published package manifest. Yarn's plugin documentation also recommends writing plugins so they work without dependencies, because package-manager extension code can run before an install has made dependencies available. This RFC follows that by documenting `.npm-extension` as self-contained project code and not guaranteeing project dependencies while the extension file is loaded.

### Bun lifecycle-script and isolated-install policy

Bun's package manager supports strict isolated installs that prevent phantom dependencies: https://bun.sh/docs/pm/isolated-installs. Bun also treats lifecycle scripts as a security-sensitive install surface and does not execute arbitrary dependency lifecycle scripts by default: https://bun.sh/docs/pm/lifecycle. Those decisions point in the same direction for npm: extension code that executes JavaScript during install needs an explicit disable path and should not be conflated with data-only manifest repairs. This RFC makes `ignore-scripts=true` disable `.npm-extension`, while also providing a dedicated `ignore-extension` control for users who want to disable only this extension surface.

### Deno project configuration and lockfile policy

Deno keeps project-level dependency configuration in `deno.json` and uses a lockfile to make dependency state reproducible: https://docs.deno.com/runtime/reference/deno_json/. Deno's npm compatibility documentation also treats npm packages as running under Deno's broader permission model rather than as unbounded package-manager metadata: https://docs.deno.com/runtime/fundamentals/node/. The relevant lesson is that local project policy belongs in explicit project configuration and must have a clear reproducibility story. This RFC applies that lesson by keeping `.npm-extension` outside `package.json`, excluding it from published tarballs, and recording extension state in the lockfile.

### Native dependency patching

The accepted [Native Dependency Patching proposal](https://github.com/npm/rfcs/pull/862) added source-controlled dependency patches. Patching remains the right tool for source-code and on-disk package changes. `.npm-extension` is for dependency manifest metadata that must be changed before Arborist resolves the ideal tree.
