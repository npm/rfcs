# Package Variants

## Summary

A package can name complete, prebuilt replacements for itself and the conditions under which each one is installed in its place. The new `variants` field lists those packages. A client locks every one of them, installs exactly one, and links that package's commands straight at the native executable. Nothing about choosing or mounting the binary is an install script.

The case this proposal covers is the common one: a finished, singleton native build that can stand in for the package one-for-one. A platform CLI (`esbuild`, `biome`, `bun`, `@pnpm/exe`, `aube`) is the shape. The variant has the same role as the package the user named, it is installed alone with no install-time work of its own, and older clients keep using the `optionalDependencies` layout those packages already publish.

## Motivation

Two things changed since the first draft of this proposal.

Install scripts are off unless a user turns them back on. pnpm 10, Bun, vlt, aube, and npm 12 all skip dependency lifecycle scripts by default. That is the right default. It also means the usual way to fetch a native binary, or to move it onto the `bin` path, no longer runs. `npm i -g bun` can leave a bin that does not work. The remaining options are to allow arbitrary script execution again, to link the binary by hand, or to `curl | sh` an installer that skips the registry, the lockfile, and integrity checks. Package managers have started special-casing known packages to paper over this. That does not scale, and publishers cannot target it.

The packages people are installing this way are themselves native binaries. `esbuild`, `swc`, `biome`, `oxc`, `rolldown`, `bun`, `pnpm`, and `aube` all ship platform builds through the registry (`yarn` is heading the same way). The working pattern is one package per platform, listed as `optionalDependencies`, plus either a script that selects and relocates the binary or a JavaScript shim that detects the platform again at runtime and spawns it. The shim starts Node on every invocation of a tool that was written so it would not need Node. The script exists because `bin` has to point at something at publish time, before anyone knows which platform package will be present. Mounting a binary with a lifecycle script was always a workaround. A script can do anything, so there is no useful line between a script that only copies a file and a script that does something else. The installer already knows which build it picked. It should link that file.

`optionalDependencies` get part of the way there and then stop. A lockfile written on Windows omits the macOS package, and the next Mac install rewrites it ([npm/cli#4828](https://github.com/npm/cli/issues/4828)). Nothing requires any of the optional packages to be installed, so a tree with all of them missing is valid. After install, the package still has to `try`/`catch` its way through `require` to find out which one showed up. And the pattern needs a second package name per platform, published on its own, often a few minutes apart.

## Detailed Explanation

### What this specifies

This RFC specifies what a client installs and links for a given manifest and target, so that every client that implements it installs the same package. It does not specify:

- how variants are named, which scope they live under, or who owns them;
- where, by whom, or from which repository variants are built and published;
- what publishing tools check, lint, or warn about;
- how clients and other tools report variants to users.

Publishers, registries, and tools already have their own policies for packages in general, and those apply to variants unchanged. Sections that touch these topics, such as [Publishers](#publishers) and [Tooling](#tooling), are guidance, not requirements.

### The field

`variants` is an array on `package.json`. Order is the selection order. Each entry names one registry package at an exact version and, optionally, the environment it covers.

```json
{
  "name": "esbuild",
  "version": "0.25.0",
  "bin": {
    "esbuild": "bin/esbuild.js"
  },
  "optionalDependencies": {
    "@esbuild/linux-x64": "0.25.0",
    "@esbuild/linux-x64-musl": "0.25.0",
    "@esbuild/darwin-arm64": "0.25.0",
    "@esbuild/win32-x64": "0.25.0"
  },
  "variants": [
    {
      "os": ["linux"],
      "cpu": ["x64"],
      "libc": ["musl"],
      "package": "@esbuild/linux-x64-musl@0.25.0",
      "bin": { "esbuild": "bin/esbuild" }
    },
    {
      "os": ["linux"],
      "cpu": ["x64"],
      "libc": ["glibc"],
      "package": "@esbuild/linux-x64@0.25.0",
      "bin": { "esbuild": "bin/esbuild" }
    },
    {
      "os": ["darwin"],
      "cpu": ["arm64"],
      "package": "@esbuild/darwin-arm64@0.25.0",
      "bin": { "esbuild": "bin/esbuild" }
    },
    {
      "os": ["win32"],
      "cpu": ["x64"],
      "package": "@esbuild/win32-x64@0.25.0",
      "bin": { "esbuild": "esbuild.exe" }
    },
    {
      "package": "esbuild-wasm@0.25.0"
    }
  ]
}
```

An entry has two kinds of keys.

| Key | Kind | Meaning |
| --- | --- | --- |
| `package` | data | Required. `name@version`, where `version` is an exact semver version. A range, tag, or any other specifier makes the entry ineligible. |
| `bin` | data | Optional. Paths inside the variant package for the parent's commands. See [Bins](#bins). |
| `os`, `cpu` | condition | Optional. Arrays, with the matching rules of those fields on `package.json`, including `!value` exclusions. |
| `libc` | condition | Optional. An array of `glibc` and `musl`. Matches only when the target OS is `linux`. |
| `libcVersion` | condition | Optional. A glibc floor, such as `"2.17"`, with `manylinux` semantics. Matches only a Linux target running glibc at that version or later. |
| `osVersion` | condition | Optional. A macOS or Windows floor, such as `"11.0"`. Matches only a `darwin` or `win32` target whose OS version is that version or later. |
| `napi` | condition | Optional. An integer: the lowest N-API version the build needs. Matches a target whose N-API version is at least that. |
| `nodeAbi` | condition | Optional. `"node-<NODE_MODULE_VERSION>"` or `"electron-<NODE_MODULE_VERSION>"`, for addons built outside N-API. Matches a target whose runtime and ABI are exactly that. |
| `engines` | condition | Optional. An object whose only key is `node`, a semver range. |

`libcVersion`, `osVersion`, `napi`, and `nodeAbi` are pnpm's platform fields, with pnpm's meanings, so that a build described one way can be described the other way (see [One version, several archives](#one-version-several-archives)). A few rules apply to them and to `libc`:

- `libcVersion` and `osVersion` are written as `major` or `major.minor` and compared as numbers, never as strings. `11` and `11.0` are the same floor.
- `libcVersion` implies glibc. It never matches a musl target, so it cannot be combined with `"libc": ["musl"]`.
- `osVersion` never matches a target whose OS is not `darwin` or `win32`. On macOS it is the product version (`11.0` is Big Sur), not the Darwin kernel version.
- `napi` and `nodeAbi` cannot both be set on one entry.
- `nodeAbi` is matched against the runtime the build loads into. That is the project's Node unless the client is configured for another runtime, such as an Electron app's version, as `@electron/rebuild` is today.
- `libc` is stricter here than on `package.json`. There, `libc` is ignored when the OS is not Linux. Here, an entry with `libc` does not match a non-Linux target, so `{ "libc": ["musl"] }` without `os` cannot select a musl build on macOS.
- `cpu: ["arm"]` means ARMv7, which is what `process.arch` reports for both ARMv6 and ARMv7 and what napi-rs builds as `arm`. An ARMv6 build needs a future condition (see [Future extensions](#future-extensions)).

An entry with any other key, with any key under `engines` other than `node`, or with a value of the wrong shape is ineligible. Selection skips it. That is how a later revision can add a condition without a client from this revision installing a build it could not check.

A `variants` value that is not an array is ignored, and the package installs as it does today. An entry that is not an object is ineligible.

### What a variant is

A variant is a complete replacement for the package, for one environment. It is an ordinary package, with an ordinary tarball, integrity, and (where the publisher has it) provenance. It is not an overlay, a patch, or a sidecar file the parent loads. `require("esbuild")`, `import "esbuild"`, the types, and the `esbuild` command all resolve to the variant that was selected.

In this revision a variant is installed alone, and it takes the parent's place in the tree:

- The client does not install the variant's own `dependencies`, `optionalDependencies`, or `peerDependencies`. Anything the variant needs at run time ships in its tarball, as bundled dependencies already do.
- The package keeps the parent's peers. Dependents' edges, and the peers the package resolves, come from the parent's manifest, so a peer that only one platform's build declared cannot make the lockfile depend on the machine that wrote it.

The client does not judge what a variant declares. A variant whose manifest lists dependencies is still selected and installed, without them, the same way on every client.

This matches how platform builds are published today. Across 32 popular packages that use the platform-package pattern (checked against their November 2026 releases), the platform packages that declare dependencies fall into three groups. One is sharp's addons, which depend on `@img/sharp-libvips-*`. Another is the napi-rs `wasm32-wasi` fallbacks of `@rspack/binding`, `rolldown`, and `@tailwindcss/oxide`, which depend on the wasm runtime. The third is sass-embedded's fallback, which depends on `sass`. Every native CLI build has none: esbuild, biome, bun, deno, `@pnpm/exe`, turbo, `@openai/codex`, `@anthropic-ai/claude-code`, dprint, and the rest. The wasm fallbacks keep working without a variant, because the parent is the fallback, and the parent installs its `optionalDependencies` exactly as it does today. sharp keeps its JavaScript in the parent and loads an addon from the platform package, so it was never a one-for-one swap. Support for variant dependencies is listed in [Future extensions](#future-extensions).

The variant's own `os`, `cpu`, `libc`, and `engines` fields, and any platform fields it carries, do not affect selection. The entry's conditions decide. `libc` is not in the abbreviated packument, so a rule that read the child's own fields would select differently depending on which document a client fetched.

An entry is one conjunction. `os`, `cpu`, and `libc` each match if any listed value matches, so an entry that sets all three matches their cross product. `os: ["linux", "darwin"]` together with `cpu: ["x64", "arm64"]` claims four platforms. A set of platforms that is not a cross product needs several entries. A macOS universal binary is one entry with `"os": ["darwin"]` and `"cpu": ["arm64", "x64"]`. A static Linux binary that runs on glibc and musl is one entry that sets `os` and `cpu` and omits `libc`. The same `package` may appear on more than one entry when one tarball serves those hosts.

### Selection

The client evaluates entries against a target. By default the target is the host:

- `os` and `cpu`: `process.platform` and `process.arch`.
- `libc` and the glibc version: what the host actually runs, detected the way the client already detects it for the `libc` field.
- The OS version: the macOS or Windows product version.
- The Node version the project will run, its N-API version (`process.versions.napi`), and its ABI (`node-` followed by `process.versions.modules`). This is the Node running the client unless the client supports declaring a different one, as with `devEngines.runtime`, or a different runtime, as for Electron.

A target value the client cannot determine is unknown. An entry that sets a condition whose target value is unknown does not match. Linking a build the host may not be able to run is worse than falling through to the next entry or the parent.

1. Walk the array in order.
2. Skip an entry that is ineligible: no exact-version `package`, an unknown key, or a malformed value.
3. Skip an entry with any condition that does not match the target. An omitted condition matches anything.
4. Skip an entry whose package was not found. See [What gets installed](#what-gets-installed).
5. The first remaining entry is the selection.
6. If none remain, the parent package is installed as published.

An entry with no conditions matches every target. Listed last, it is the fallback for hosts with no native build, such as a WASM or pure JavaScript build. pnpm's `wasm32` tag means the same thing. There is no separate fallback field.

Order is the publisher's statement of preference, so narrow entries go first:

- a higher `libcVersion` or `osVersion` floor before a lower one, and both before an entry with no floor;
- `nodeAbi` before `napi`, a higher `napi` before a lower one, and both before an entry with no ABI condition;
- the musl build, then the glibc build, then an entry that omits `libc`;
- every native entry before an unconditional fallback.

A napi-rs addon with a modern and a baseline glibc build looks like this:

```json
"variants": [
  { "os": ["linux"], "cpu": ["x64"], "libc": ["musl"], "napi": 8, "package": "@scope/binding-linux-x64-musl@2.3.0" },
  { "os": ["linux"], "cpu": ["x64"], "libcVersion": "2.28", "napi": 8, "package": "@scope/binding-linux-x64-gnu-2-28@2.3.0" },
  { "os": ["linux"], "cpu": ["x64"], "libcVersion": "2.17", "napi": 8, "package": "@scope/binding-linux-x64-gnu@2.3.0" },
  { "os": ["darwin"], "cpu": ["arm64", "x64"], "osVersion": "11.0", "napi": 8, "package": "@scope/binding-darwin-universal@2.3.0" },
  { "os": ["win32"], "cpu": ["x64"], "napi": 8, "package": "@scope/binding-win32-x64@2.3.0" }
]
```

This is the same ordering pnpm's selection computes by rank. pnpm ranks each of its variant archives by how specific its matching platform is: more conditions, then higher floors, then `nodeAbi` over `napi` over neither, with `wasm32` last. Each entry here is one conjunction, so an entry's rank is the same on every host it matches. Sorting the entries by that rank gives an order that first match follows, and on every host it selects what pnpm's rank would. Publishing tools can do that sort. pnpm's harder case, one archive listing several platforms that should win on different hosts, becomes several entries here, each with its own place in the order.

When nothing matches, the parent is the fallback. A package with no portable build can set `os` and `cpu` on the parent to the union of the builds it actually ships. The client's existing platform check then fails the install on a host none of them cover. A parent that stays installable everywhere is the JavaScript or WASM package that users of older clients already get.

### Targets other than the host

Clients must let a user install for a target other than the host, for container images, Lambda bundles, Electron apps, and cross-platform CI. The configuration is the shape clients already have for optional dependencies: lists of `os`, `cpu`, and `libc` values, as in npm's `--os`, `--cpu`, and `--libc` settings and pnpm's `supportedArchitectures` (including its `current` value for the host). A target can also state its glibc floor, OS version, N-API version, or ABI, in pnpm's platform-tag syntax (`linux-x64-manylinux_2_26-node127`) or the client's own config keys. Anything a non-host target does not state is unknown.

- Each configured target's variants are fetched into the cache or store, so a later offline install for that target works. Fetching is looser than selection: for a target that does not state its floors or ABI, every entry matching its `os`, `cpu`, and `libc` is fetched, whatever floors or ABI those entries set. Fetching a build the target cannot use only costs disk. Skipping the one it needs makes an offline install fail. This is pnpm's rule.
- Only one variant is linked under the package's name. It is the host's selection, unless the configuration names exactly one target and does not include the host. In that case it is that target's selection, made with that target's unknown values treated as unknown, so a Lambda bundle built on a laptop states the Lambda runtime's glibc floor to get a floored build. This is also pnpm's rule.
- The client keeps track of which variant it linked for each package and relinks when the selection changes. Examples: the target configuration changed, `node_modules` was mounted into a musl container, the host's glibc or OS was upgraded, or the Node version changed for a package whose entries use `engines`, `napi`, or `nodeAbi`. The lockfile does not change in any of these cases, so nothing else tells the client that the linked build is stale.

### What gets installed

This proposal does not specify lockfile formats. Each client records what it needs in its own format. The requirements are about behavior:

- **The lockfile is the same on every machine.** Every entry is locked whether or not this host selected it, so resolving on macOS and on Linux produces the same lockfile.
- **Selection is not locked.** The lockfile does not record which entry was selected. A frozen install selects again from the lockfile, for any target, without the network and without treating a different target as a lockfile change.
- **Newer clients are not limited by older ones.** An entry with a condition the locking client did not understand is still locked, so a newer client reading the same lockfile can select it.
- **Late builds are picked up.** An entry whose package was not found (a 404) is skipped. A frozen install keeps skipping it. A non-frozen install looks it up again, so a platform build published after the parent is picked up by the next ordinary install. Any other failure, such as a network error, fails the install the same way it would for any dependency.
- **The parent stays locked.** The parent's own dependencies, including the `optionalDependencies` it still lists for older clients, stay in the lockfile. They are installed only when the parent itself is selected. A lockfile shared with an older version of the same client keeps working for that version.

On disk, the selected variant is the package. Its tarball is what gets extracted at the location the user depended on (`node_modules/esbuild`), or what that location links to in a store-based layout. The parent's tarball is not extracted. Neither are the other variants, except into the cache for an extra configured target. A content-addressed store includes the selected variant in the identity of that directory, so two projects that selected different builds of the same parent do not share one directory.

When a variant is selected, the parent's `dependencies` and `optionalDependencies` are not installed, because the parent is not installed. That includes the platform packages it lists for older clients, so a client that reads `variants` never installs two copies of the same build. When the parent is selected, its dependencies and `optionalDependencies` are installed exactly as they are today, so the shim and the platform packages still work on that path.

### Where the field applies

- Only on packages resolved from a registry, including through `npm:` aliases and `registry:` specifiers. The field is ignored on the root project, on workspaces, and on `file:`, `link:`, git, and remote tarball dependencies. Those manifests do not come from a packument, and a project's own `package.json` is not a published version.
- Not recursively. A variant's own `variants` field is ignored.
- Under aliases. `"build": "npm:esbuild@0.25.0"` links the selected variant at `node_modules/build`.
- In global installs. `npm i -g bun` selects a variant the same way and links the global `bun` command at the native executable. This is the case that breaks today when scripts are off.
- With overrides. `overrides` (and `pnpm.overrides`, `resolutions`) apply to variant packages like any other edge, by package name. A user can patch a vulnerable build. An override that changes the parent's version changes which parent manifest is used, and so which `variants` list is used.

### Bins

The parent's `bin` decides which command names exist. When a variant is selected, those are the only commands the client links, so no platform grows a command the others lack, and a variant cannot add one. The string form of `bin` names a single command after the package, as it does today.

For each command, the path inside the variant comes from the entry's `bin` first, then from the variant package's own `bin`. A command that has neither is not linked. The parent's `bin` paths are never used when a variant is selected; they belong to the parent's tarball, which was not extracted.

The entry's `bin` exists for the transition. If a platform package that is also listed in the parent's `optionalDependencies` declares its own `bin`, an older client links that command next to the parent's shim. The entry's `bin` lets such a package leave its own `bin` off. A platform package that is only installed through `variants` can carry a normal `bin`, and its entries can omit one.

The client links the command at the file itself:

- If the file starts with `#!`, it is a script, and the client links it the way it links any bin today, including the shims it writes on Windows. This is the WASM or JavaScript fallback case.
- Otherwise it is a native executable, and the command is that executable with no Node process in front of it. On Unix the client symlinks it, or copies it. It sets the executable bit on the extracted file, never by changing the mode of a file hardlinked into a content-addressed store; when the stored file is not already executable, the client copies it. On Windows the client links or copies it as a `.exe`, or writes a shim that runs it directly rather than through `node`.

A path must stay inside the variant package after symlink resolution. The client does not link a path that escapes it.

### Scripts

Selecting a variant and linking its commands are the installer's job. They are not a lifecycle script.

When a variant is selected, the parent is not installed, so the parent's scripts do not run. The variant's scripts do not run either. A client that asks before running scripts does not ask about them and does not warn that they were skipped. A prebuilt package has nothing to build. Publishers do not mark which scripts are the "good" ones. A script is arbitrary code, and this path does not run any.

When no variant matches, the parent installs under the client's normal rules, including its normal script policy. A source build that has to compile (`node-gyp`, a `binding.gyp`) lives on that parent. Hosts with a prebuilt variant never reach it. Hosts without one get today's behavior, which for most clients means the build does not run until the user allows it.

### Registry changes

`variants` has to be a field the registry promises to keep, not just a key a publisher can put in `package.json`.

The registry serves two packuments. The full document (`Accept: application/json`) echoes whatever fields the publisher put in the manifest, so a `variants` array would show up there today with no registry change. The abbreviated document (`Accept: application/vnd.npm.install-v1+json`, the corgi doc) is an allow-list. The registry copies a fixed set of fields onto each version object (`dependencies`, `optionalDependencies`, `bin`, `os`, `cpu`, `engines`, and so on) and drops the rest. Anything dropped is invisible to a client on that path. Choosing a tarball requires the field before the tarball is downloaded, so reading it out of the tarball is too late.

The registry change is: copy `variants` verbatim from the published manifest onto the abbreviated version object, and list it in the registry's [package metadata documentation](https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md). Same kind of change as adding `funding` or `cpu`. That is the npm registry's buy-in. Without it, the feature exists only for clients that fetch the full document, and it disappears the day those clients go back to the abbreviated one.

`libc` is already that story. It has been a real `package.json` field since npm 10.4. As of November 2026 the abbreviated document still omits it: `@img/sharp-linux-x64@0.35.5` carries `"libc": ["glibc"]` in the full document and not in the abbreviated one. npm's resolution path still requests the full packument because of that ([npm/cli@8382fb3](https://github.com/npm/cli/commit/8382fb3f6acfa39d45d191c3215c7b899966b1f6), [npm/cli#7529](https://github.com/npm/cli/issues/7529)). Adding `variants` to manifests, and leaving it off the allow-list, signs the project up for the same permanent full-document fetch. Blessing the field is what lets installers use the abbreviated document and still see it.

v1 asks the registry for that one change and nothing else.

- No new tarball route. Each variant is a package the registry already knows how to store and serve, with its existing `dist.tarball` and `dist.integrity`.
- No new media type.
- No requirement that one version hold several archives. That is a larger protocol change, which [pnpm's platform-variants proposal](https://github.com/pnpm/rfcs/blob/main/pnpr/text/0000-platform-variants.md) designs for pnpr. See [One version, several archives](#one-version-several-archives) for how the two fit together.
- No requirement that the registry validate the array. Clients treat a malformed value as absent and a malformed entry as ineligible. Registries may apply their own publishing policies, as they do for any field.

Installing reads only the parent's abbreviated document plus each variant's `dist` and `bin`. Both are already in the abbreviated document. `libc` on the child is not needed.

### Shipping ahead of the npm registry

On `registry.npmjs.org` the field is visible in the full packument and absent from the abbreviated one until the allow-list includes it. It does not have to wait on that allow-list to become real.

pnpm operates [pnpr](https://github.com/pnpm/rfcs), its own registry. pnpr can carry the field in each version's `manifest` in the package document pnpm already installs from, which plays the same role for pnpm that the corgi allow-list plays for npm. That keeps it apart from the `variants` key pnpr already puts on each version entry for its own variant archives. vlt can implement the same client behavior, reading the field from any document that carries it, and reading the full packument on `registry.npmjs.org` in the meantime. The two of them can ship the install path, and authors can publish the field, before npm's registry changes anything.

That is the adoption path:

- Authors keep publishing `optionalDependencies` and the JavaScript shim, so npm, Yarn, and Bun users are unaffected.
- pnpm and vlt users, against a registry that surfaces the field, get one build, a native command, and no script.
- The manifest those authors publish is the manifest npm is asked to copy. When the allow-list gains `variants`, the npm CLI implements the same client behavior against a document that finally contains the field. A publisher writes one field.

A client that implements selection only against pnpr, or that keeps fetching full packuments after the allow-list changes, has implemented a fork. The useful early implementation reads `variants` from whatever document has it and behaves exactly as today when the field is absent.

### Security

- **Integrity.** Every variant is locked and verified like any other dependency, from cache, mirror, or network. No bytes come from outside the registry.
- **No code runs on the selection path.** No lifecycle script of the parent or the variant runs when a variant is selected. Clients do not need a script allow-list entry to install a native tool.
- **Exact pins.** A range in an immutable manifest could later resolve to a build that was never made with this parent. Exact versions rule that out.
- **Unpublished names.** A missing entry is skipped, and a non-frozen install looks it up again. An entry that names a package nobody has published yet can therefore be claimed by whoever publishes that name first, and the next non-frozen install would lock it. Publishing every variant before the parent closes that window, and the registry's ordinary name policies apply as they do to any package. Once an entry is locked, the lockfile pins it.
- **Command names.** Only the parent's command names are ever linked, so a compromised variant can change what an existing command runs but cannot add a command.
- **Path containment.** A bin path that escapes the variant package is not linked.
- **Provenance.** A variant carries its own provenance, like any package. Clients that display provenance can show the selected variant's beside the parent's.

## Rationale and Alternatives

### Optional dependencies, left as they are

Today's best practice is the layout in the example above, minus `variants`. It is a reasonable fallback for clients that do not know the field, which is why publishers should keep shipping it. It is a bad primary mechanism. The lockfile tracks whichever optional packages the resolving machine could install. A tree with none of them installed is valid. The package has to probe at runtime to find the one that landed. And it can only represent packages, so libraries that download a binary in `postinstall` cannot move onto it without first publishing those binaries as packages. This proposal assumes that publish has happened. Downloading from somewhere other than the registry stays out of scope: a binary that is not a package has no integrity in the lockfile.

Recording every optional dependency in the lockfile, on every machine, would fix the churn and would not fix the rest. pnpm already locks them all and still has the extra names, the shim, and the script that swaps the shim for the executable.

### Install scripts

A `postinstall` that picks a URL and downloads a binary does not run when scripts are off, does not cache or integrity-check unless the author reimplemented both, and trusts a host other than the registry. The npm CLI has treated this as something to retire for years. The ecosystem has now retired it by default, and the packages that still need a binary are the ones that broke.

This proposal does not try to classify scripts. The selected package is already built, the installer links it, and no script runs. The parent's scripts run only when the parent is what got installed, under whatever policy the user already has.

### One version, several archives

[pnpm's platform variants](https://github.com/pnpm/rfcs/blob/main/pnpr/text/0000-platform-variants.md) give one version a primary archive and a set of variant archives, published together, named by a platform tag, and selected by a specificity rank. The install result it wants is the one this RFC wants: the selected archive is the package, `bin` is the executable, the archive does not build, the lockfile is the same everywhere, and peers do not depend on the platform. Both proposals call the thing being selected a variant. Here a variant is a separate package. In pnpr it is an archive of the same version.

The publishing model is the difference. Variant archives need a registry that can store more than one tarball on a version, serve them, and make them visible in one commit. npm's registry stores one tarball per version. The packages this proposal covers already have a tarball per platform. Pointing `variants` at those packages works on every npm-compatible registry once the field is visible in the install document.

What this proposal takes from that design:

- its platform fields with their meanings: `libc`, `libcVersion`, `osVersion`, `napi`, and `nodeAbi`;
- unknown target values never satisfying a condition;
- `cpu: arm` meaning ARMv7;
- `nodeAbi` matched against the runtime the build loads into;
- a direct native command, no build on the selected package, and matching peers;
- a static or universal binary expressed as one entry that covers several hosts;
- an explicit target, with pnpm's rules for what to fetch and what to link;
- relinking when the selection changes, and a store identity that includes the selected build.

What it leaves there: several archives per version, dependencies that differ per archive, a computed rank, registry-enforced invariants, platform tags as the published form, and implicit glibc. [Differences from pnpm's platform variants](#differences-from-pnpms-platform-variants) gives the reason for each.

The two designs share one install contract, and pnpr can connect them. pnpm's proposal leaves a view of variant archives for clients that do not read pnpr's format out of scope for now. Such a view can project a version's archives onto the `variants` field. npm-format documents would list each variant archive as a generated package under a reserved name and carry `variants` entries pointing at it. Each entry is one of the archive's platforms, with its fields as conditions, and implicit glibc is written out as `"libc": ["glibc"]`. Entries are sorted by pnpm's rank, and the primary archive is the parent. The fields are the same, so the projection is exact: every host selects the archive pnpm would have selected. npm, vlt, Yarn, Bun, and aube then install pnpr's variant archives natively once they implement this field, and pnpm keeps its registry design.

### Slots beside the parent

[aube's binary artifacts draft](https://github.com/aubepkg/aube/pull/1289) keeps the parent package and adds an `artifacts` map of named slots. Each slot is an ordered list of packages with similar conditions. The selected package is linked under a `_slot` name that the parent's code can `require`, and an `artifact.bin` field on the child, which older clients ignore, overrides the parent's shim. A `supersedesScripts` list names the parent scripts that must not run when a slot hits.

The selection rules are close to these: first match wins, `os` / `cpu` / `libc` / `napi` / `engines.node`, an unconditional last entry is the fallback, unknown keys do not match, exact pins, every candidate is locked, one is installed, and older clients ignore the field and keep `optionalDependencies`. Those are the right rules for a singleton, and this proposal uses them, along with aube's rule that only the parent's command names are linked and its requirement that a native command not go through Node.

The slot model earns its complexity when one package carries several independent binaries (Prisma's engines), or when the parent's JavaScript has to stay and only a `.node` file changes. That is a real population, and it is not the one this proposal is trying to move. For a finished binary that replaces the package, the parent's name is already the stable name, `require("esbuild")` already points at the right code, and there is no `_slot` directory for `npm ls` and packagers to learn. The parent is not extracted, so its scripts do not run, and there is no list of script names to maintain. The double run that `supersedesScripts` exists to prevent (the installer lays down the binary, then the legacy script downloads one too) cannot happen, because the script's package was not installed.

The trade is the one aube names. Adopting this for a library means each variant is a complete package, not a one-line addition to the parent. A CLI that is already a per-platform executable is most of the way there. A library that wants to keep a single copy of its JavaScript and swap only the addon stays on `optionalDependencies` until a slot design is specified. Slots are listed in [Future extensions](#future-extensions) and can share this proposal's selection rules unchanged.

One link per name is also deliberate. Fetching other targets into the store is supported. Linking two platforms under one name at once is not. A `node_modules` mounted into a container with a different libc is relinked on install, it does not contain both.

### Other directions that were set aside

Shipping every platform's binary inside one tarball needs no registry change and makes every install download every platform. For `@swc/core` that is an order of magnitude more bytes than any one host runs.

A new `exports` condition would select a file inside one tarball. It needs Node, Bun, and every bundler to understand it, and it cannot point `bin` at a different package.

Leaving each package manager to special-case the packages it knows about is already happening. Publishers cannot target a hard-coded list.

Consumer-chosen variants (a "full" package with tests and docs, a slim one, a build for legacy engines that a user opts into) fit an ordered list of packages, and they are not this proposal. The conditions here are facts about the machine. A condition a user opts into is a different feature, and the bandwidth case for it is strong enough to design on its own rather than fold into the platform rules. It is listed in [Future extensions](#future-extensions).

### The name

Earlier drafts called this field `distributions`. It is `variants` now, for three reasons.

- **It says what the thing is.** A variant is a different form of the same thing, which is what an entry names: a complete stand-in for the package the user depended on. The word is standard in build tooling for this idea: Gradle's variant-aware resolution, Android build variants, Conda build variants, Python's wheel variants proposal.
- **"Distribution" was ambiguous here.** The conditions talk about glibc and musl, so "distributions" read as Linux distributions. It also sat awkwardly next to npm's existing `dist`, `dist.tarball`, and `dist-tags`.
- **Yarn and pnpm already use the word.** Yarn's proposal uses the same model under the same name. pnpm uses it for the same install result.

pnpr already uses the word in its own formats. A variant archive's `package.json` has a singular `variant` field, and pnpr's install document lists a version's archives under `variants`. Those live in pnpr's formats and describe archives of one version. This field lives in `package.json`, in npm-format documents, and in the `manifest` of pnpr's document, and it names separate packages. The projection in [One version, several archives](#one-version-several-archives) maps one onto the other.

## Implementation

### Publishers

This is guidance for getting the behavior above. None of it is enforced.

- Publish the parent with `variants`, and keep publishing the `optionalDependencies` and the shim that older clients use.
- Publish each variant as its own package, before the parent. Pin each entry to the exact version that was built with this parent.
- Make each variant complete. It needs its own `main` or `exports` if the package is imported, and its own types (`.d.ts`) if the parent shipped them. Bundle anything it needs at run time, since its own dependencies are not installed, and give it the parent's peers, since the parent's are the ones that apply.
- Order entries from narrow to broad, as [Selection](#selection) describes. Put an unconditional fallback last, or leave it out and let the parent be the fallback.
- Prefer `napi` over `nodeAbi`. One N-API build covers every Node version that supports it. A package that still builds per ABI needs one entry per Node and Electron ABI it supports.
- While a platform package is also listed in `optionalDependencies`, leave `bin` off it and put each command's path on the entry.
- Publish the parent even if a platform build failed or is late. A missing entry is skipped, and the next ordinary install picks the package up once it is published. Changing the set of entries means publishing a new parent version; the field is part of the immutable version.

napi-rs binding packages whose parent only re-exports the native addon qualify, as long as each platform package carries the types and entry point the parent had. Packages that keep a JavaScript loader in the parent and load an addon from the platform package (sharp) do not, and stay on `optionalDependencies`.

### Publishing tools

This RFC does not standardize publish-time checks. Every client skips an ineligible entry at install time, so a tool that refuses to publish one only reports earlier what every client would do anyway. Anything beyond that is each tool's choice, and tools are free to differ.

Mistakes a lint can catch, for tools that want one: an entry that an earlier entry shadows on every target, an entry whose conditions disagree with the variant's own `os`, `cpu`, or `libc`, and a parent command that neither the entry nor the variant gives a path for.

### Clients

A client that sees no `variants` field, or sees one it cannot parse, installs the package exactly as it would have.

A client that sees the field:

1. Resolves every entry that has an exact-version `package`, regardless of its conditions, and locks it, as [What gets installed](#what-gets-installed) requires.
2. Selects one entry for the target, as [Selection](#selection) describes.
3. Installs that variant's tarball as the package. It does not extract the parent or the unselected variants, except into the cache for extra configured targets.
4. Links the parent's commands at the variant's files, as [Bins](#bins) describes.
5. Runs no lifecycle script of the parent or of the selected variant, and does not prompt for them.
6. Records which variant it linked, and relinks when that changes.

A frozen install repeats step 2 from the lockfile alone. A different target is not a lockfile mismatch. A missing selected tarball is an ordinary integrity or network failure, the same as for any other locked package.

### npm

- `pacote` and Arborist read `variants` from the abbreviated packument once the registry allow-list includes it.
- `buildIdealTree` resolves each entry's packument at its exact version, applies the eligibility checks, and keeps the results on the parent node. The ideal tree does not depend on the host. A variant's own dependencies are not installed, so it never needs its own position in the tree.
- `reify` selects for the target and extracts the selected variant's tarball at the parent node's location. It does not reify the parent's dependencies or optional dependencies on that path.
- The node at `node_modules/esbuild` then holds a `package.json` named `@esbuild/linux-x64-musl`. Arborist already handles this shape for `npm:` aliases, where the folder name and the manifest name differ. Edges from dependents are validated against the parent's locked name and version, not against the variant's manifest.
- `bin-links` links the parent's command names at the variant's files and skips the Node shim for native executables.
- npm tracks the linked selection so `npm install` can tell when to relink.
- Host detection adds the glibc version, the OS version, and the N-API version and ABI of the target Node.
- `npm ls` shows the dependency and the installed build together, for example `esbuild@0.25.0 (@esbuild/linux-x64-musl@0.25.0)`, as it does for aliases.
- `npm install --os --cpu --libc` set the target as described in [Targets other than the host](#targets-other-than-the-host). npm adds settings for the floors and ABI a non-host target can state.

### pnpm and pnpr

- pnpr carries the field in each version's `manifest` in its install document, apart from its own top-level `variants` list of archives.
- pnpm reads it from pnpr, from npm's full packument until the allow-list changes, and from the abbreviated packument after. It selects, links, and relinks as described, reusing the platform matching it already has for runtimes and variant archives.
- `supportedArchitectures`, including its platform-tag form with floors and ABI, is the target configuration.
- Optionally, pnpr's view for clients that do not read its format projects variant archives onto the `variants` field, as described in [One version, several archives](#one-version-several-archives).

### vlt, aube, Yarn, and Bun

Each implements the client behavior in [Clients](#clients) and uses its existing target configuration for optional dependencies (Yarn's `supportedArchitectures`, for example). vlt is implementing it now. aube's slots are a follow-on, and they can share these selection rules.

### Tooling

Tools that report on installed packages need to know that a variant stands in for its parent. This RFC does not specify their output. Some reasonable defaults:

- **Listings** (`npm ls`, `pnpm list`, `vlt ls`) can show the declared package and the installed variant together.
- **Audit** can check both the parent at its locked version and the variant actually installed, since an advisory against either is relevant.
- **SBOMs** can list the installed variant as a component, related to the parent it stands in for.
- **License tools** can report the installed variant's license, since that is the code on disk.
- **`why`/`explain`** can report the variant as installed in place of the parent.

### Conformance

Clients agree on behavior through a shared set of test fixtures, kept in a neutral repository. The OpenJS Package Metadata Interoperability WG is the default home. Each fixture gives:

- a parent manifest with `variants`;
- abbreviated packuments for each variant, or a 404;
- a target (`os`, `cpu`, `libc`, glibc version, OS version, Node version, N-API version, ABI), where any value may be unknown;
- the expected selected entry, or the parent;
- the expected command links, and whether each is native or a script.

The fixtures cover at least:

- first match over overlapping entries;
- `libc` on a non-Linux target;
- `!value` exclusions;
- `engines.node`;
- `libcVersion` at, above, and below the host's glibc, on a musl host, and with an unknown glibc version;
- `osVersion` on macOS and Windows, compared numerically (`10.15` below `11.0`), and on Linux;
- `napi` floors, an exact `nodeAbi` match, an Electron ABI, and an entry setting both `napi` and `nodeAbi`;
- floors and ABI on a non-host target that does not state them, for linking and for fetching;
- an unknown key, an unknown `engines` key, and a malformed condition value;
- a range or tag in `package`;
- a variant whose own manifest declares dependencies, optional dependencies, and different peers, which are not installed while the parent's peers apply;
- a missing entry on frozen and non-frozen installs;
- the parent as fallback;
- an unconditional fallback entry;
- a parent command with no path;
- a bin path that escapes the package;
- a script bin versus a native bin;
- a single non-host target.

vlt, pnpm, aube, and npm run the same fixtures. Two clients that pass them select the same variant for the same manifest and target. pnpm's proposal asks for one specification of platform fields shared with its side-effects cache; these fixtures can be that shared set.

## Use cases

### A platform CLI

The `esbuild` example above. On a musl x64 Linux host, a conforming client locks every entry, installs `@esbuild/linux-x64-musl` as `esbuild`, points the `esbuild` command at the native binary, and runs no script. On a host with no native entry, it installs `esbuild-wasm` and links its script with the ordinary shim. An older client ignores `variants`, installs the matching optional dependency if it can, and runs the shim.

### A global install of a package manager or runtime

`npm i -g bun` (or `@pnpm/exe`, or `aube`) selects the host's build, installs it as the global package, and links the global command at the native executable. No script has to be allowed, nothing is downloaded outside the registry, and there is no Node process in front of the tool.

### A napi-rs binding package

A binding package whose parent only re-exports its addon publishes each platform package with the addon as its `main` and the parent's types. `require("@scope/binding")` loads the addon directly from the selected variant. The `wasm32-wasi` fallback, which depends on the wasm runtime, stays in the parent's `optionalDependencies`, and hosts with no native entry get it through the parent.

### A build that is late in CI

Publish the parent with an entry for every platform the matrix should produce. A job that fails or finishes late leaves an entry that is not found. Installs skip it and use the next entry or the parent. When the package is published, the next ordinary install picks it up. The parent does not need a new version.

## Prior Art

- The first draft of this RFC and the discussion on [npm/rfcs#519](https://github.com/npm/rfcs/pull/519). The substitution model, the lock-all, install-one rule, and the migration path through `optionalDependencies` come from there. That draft named the field `distributions`. Its `platform` and `arch` are `os` and `cpu` here, matching `package.json`.
- Yarn's [package variants](https://github.com/yarnpkg/berry/issues/2751). The same model, other packages substituted by condition, and the source of this proposal's name. Yarn's version uses a parameter matrix and a condition language consumers can extend. This proposal keeps a closed condition list on purpose.
- [pnpm platform variants](https://github.com/pnpm/rfcs/blob/main/pnpr/text/0000-platform-variants.md). The platform fields, their matching rules, the rules for non-host targets, and a prototype that linked `bin` at the native executable for esbuild, biome, and typst.
- Python's [platform compatibility tags](https://packaging.python.org/en/latest/specifications/platform-compatibility-tags/) (PEP 425, 600, 656), the source of `manylinux` glibc floors.
- [aube binary artifacts](https://github.com/aubepkg/aube/pull/1289). The ordered candidate list, the unknown-key rule, exact pins, parent-owned command names, and native commands that do not go through Node.
- npm's `libc` field ([npm/rfcs#438](https://github.com/npm/rfcs/issues/438), shipped in the CLI in 10.4), and the gap it still has in the abbreviated packument.
- pnpm's `supportedArchitectures` and npm's `--os`, `--cpu`, and `--libc`, for installing for a target other than the host.
- The `optionalDependencies` plus shim layout used by esbuild, napi-rs, sharp, and Next.js.

## Sign-off checklist

The design is complete. These are the agreements and implementations still needed.

| Party | Ask |
| --- | --- |
| npm registry | Copy `variants` onto abbreviated version objects and document it. |
| npm CLI | Arborist, `bin-links`, and `pacote` support as described in [npm](#npm). |
| pnpm | Client support, and agreement that the platform fields here are the same specification as pnpr's. |
| pnpr | Carry the field in each version's `manifest` in its install document. Optionally, project variant archives onto the `variants` field for clients that do not read pnpr's format. |
| vlt | Client support (in progress, led by @ruyadorno). |
| aube | Client support. Slots as a follow-on that reuses these selection rules. |
| Yarn | Client support. |
| Bun | Client support, which replaces its special-casing of known native packages. |
| All clients | Pass the shared conformance fixtures. |

## Future extensions

Each of these can be added later without breaking v1 clients. An unknown condition key makes an entry ineligible, so older clients skip entries that use a new condition and fall through to a broader entry or to the parent.

- **More platform conditions**, added to pnpm's vocabulary and this one together: `armVersion` for ARMv6 builds (gh, golangci-lint, and gitleaks publish them), an accelerator dimension (CUDA, Vulkan, Metal) like Python's wheel variants proposal, and `cpuFeatures` (reserved in aube's draft). Install-time detection is weaker for the last two, because the install machine is not always the machine that runs the build.
- **Emulated CPUs**: whether a host should select an `x64` executable under Rosetta or Windows on ARM when no native build exists. This works for executables and never for addons.
- **Variant dependencies**, for platform builds that need their own dependencies, as sharp's libvips packages and the napi-rs wasm runtime do. Each variant's dependency graph would then need its own place in the tree. An entry would opt in with a new key, so clients from this revision skip it instead of installing the variant without its dependencies.
- **Slots beside the parent**, for packages with several binaries or a loader plus an addon, reusing these selection rules.
- **Several archives per version**, as pnpr designs, with the projection onto `variants` keeping one install contract.
- **Inlined variant metadata.** Entries pin exact versions, and versions are immutable, so a registry could serve each entry's `dist` and `bin` beside it in the parent's abbreviated document. Clients would skip the per-variant fetch when those fields are present. A registry that does this has to update the parent's document when a late entry is published.
- **Consumer opt-in variants**, such as slim or full builds, or builds for legacy engines, chosen by the user rather than by facts about the machine.

## Known limits

- **The folder name and the manifest name differ.** `node_modules/esbuild/package.json` contains `"name": "@esbuild/linux-x64-musl"`. Rewriting that file would break the tarball's integrity and content-addressed stores. `npm:` aliases already produce this shape, and tools handle it there. Tools that key off the folder see the name the user depended on; tools that read the manifest see the variant.
- **One package per platform, published on its own.** That means extra names, releases that are not one transaction, and one packument fetch per variant. These are the same costs as the optional-dependency pattern this replaces. Missing entries are skipped, so a late or failed publish degrades to another entry or to the parent.
- **One link per name.** A single `node_modules` does not contain two platforms of the same package under that package's name. Other targets can be fetched and kept in the cache or store.
- **Variants are installed alone.** A variant's own dependencies are not installed, and the parent's peers apply. Builds that need dependencies stay on `optionalDependencies` until variant dependencies are added.
- **Complete packages only.** A variant that is only a `.node` file, or only one of several binaries the parent needs, cannot replace the whole package.

## Differences from pnpm's platform variants

[pnpm's proposal](https://github.com/pnpm/rfcs/blob/main/pnpr/text/0000-platform-variants.md) and this one want the same install result and use the same platform fields. pnpm's proposal considered an earlier draft of this RFC and set it aside. One package per platform keeps separate owners, separate publications, and the metadata fan-out, and a client learned a selected package's dependencies only after fetching it. This section answers those objections and gives the reason for every other place the two designs differ.

### Separate packages, not several archives per version

In pnpm's design, one version holds a primary archive and its variant archives under one name, published in one transaction. Here, each variant is its own package.

- **It works on the npm registry as it is.** The only registry change is one allow-list entry. Several archives per version needs new storage, new routes, staged uploads, and a new install document, on every registry that wants it. npm has not taken that on, and a design that waits for it leaves npm, Yarn, and Bun users where they are.
- **The packages already exist.** Every package this RFC targets publishes one package per platform today. Adopting it means adding a field to the parent, not changing how builds are packed or published.
- **One publication serves every client.** Under pnpm's design, a publisher with users outside pnpm publishes each release twice during the migration: variant archives to pnpr, and the primary plus separate platform packages to npm. Here the same packages serve every registry and client, and older clients keep the `optionalDependencies` layout.

pnpm's objections to the earlier draft, and what this design does about each:

- **Separate owners.** Entries pin exact versions, so publishing a new version under a variant's name cannot change what an existing parent installs, and only the parent's command names are linked (see [Security](#security)). Who owns a variant's name, and under what scope, is the publisher's choice, as it is for platform packages today. The remaining gap is a variant name that nobody has published yet, which publishing variants before the parent closes.
- **Separate publications.** A late or failed build is a missing entry. Installs skip it, so the result is the next entry or the parent, not a broken install, and the lockfile makes that result reproducible. This design does not give pnpm's guarantee that one `name@version` resolves to the same bytes before and after the last build lands. A non-frozen install after a late publish selects the new build.
- **Metadata fan-out.** Locking every entry means fetching every variant's packument, as the optional-dependency pattern does today. That cost is unchanged, not added. Because entries pin exact, immutable versions, a registry can later serve the fields a client needs inside the parent's document (see [Future extensions](#future-extensions)).
- **Dependencies learned late.** A variant's own dependencies are never installed, and the parent's manifest decides the package's place in the tree. Nothing about the tree is learned after selection.

The designs converge through pnpr. pnpr keeps several archives per version and projects them onto this field, so every client that implements `variants` installs them. Nothing here prevents npm's registry from adopting several archives later.

### Variants installed alone, not per-variant dependencies

In pnpm's design, each archive may declare its own dependencies, which are resolved into the lockfile beside it. Here, a variant is installed alone: its own dependencies are not installed, and the parent's peers apply.

- **The packages this RFC targets do not need them.** Across 32 packages that use platform packages, no native CLI build declares a dependency. The three groups that do (sharp's addons, the napi-rs wasm fallbacks, and sass-embedded's fallback) keep working through the parent, as [What a variant is](#what-a-variant-is) describes.
- **No lockfile changes are needed to keep the tree the same on every host.** With per-variant dependencies, a lockfile holds a subgraph for each variant, and a client picks which subgraph to install for each target. Most of pnpm's lockfile design (the `variations` resolution and per-variant snapshot keys) exists for this. Variants installed alone need none of it, so every client can implement this field without changing its lockfile format.
- **There is no rule about what a variant may declare.** Requiring variants to have no dependencies would mean every client checks the same rule the same way and skips variants that fail it, and publishers would argue about the edge cases. Not installing a variant's dependencies is one behavior, with nothing to validate.

Dependencies can be added later. An entry would opt in with a new key, and a client from this revision skips entries with unknown keys, so it never installs a variant without dependencies it was meant to have.

### Author order, not a computed rank

pnpm's client ranks matching archives by specificity. pnpr rejects a publication where two archives can tie, and clients reject tied metadata. Here, the first matching entry in the publisher's order wins.

- **It selects the same builds.** Each entry is one conjunction, so pnpm's rank is a fixed sort order. Publishing tools apply it once, and first match follows it (see [Selection](#selection)).
- **It is simpler to make identical across clients.** Six clients have to agree. A walk down a list is easier to implement the same way, and to test with shared fixtures, than a scoring function. A reader of the manifest sees what every client will do.
- **Selection never fails because of metadata.** No registry in this design inspects the list, so a tie pnpr would reject at publication could reach installs. Failing the install of an immutable, already-published version over a tie is worse than taking the earlier entry. Publishing tools can lint for the same mistakes before publication if they choose.

The cost is that a badly ordered list selects a broader build where pnpm would select a narrower one. A lint can catch an entry that is completely shadowed, but not two entries that overlap on some hosts and not others. Publishing tools that sort by pnpm's rank avoid both.

### Behavior, not registry checks

pnpr derives each archive's manifest at publication. It rejects the version when peers differ, when a variant requires a build, when a variant archive does not declare its platforms in its own `variant` field, or when two archives overlap. A version published with provenance has one statement that names every archive. Here, the npm registry is asked only to pass the field through, and nothing checks what a variant is.

- **The registry ask stays at one line.** Every check pnpr makes at publication is a feature npm's registry would have to build and operate. That work is why registry-side designs wait on the registry.
- **The tree guarantees hold without checks.** A variant's own dependencies are not installed and the parent's peers apply, so the tree is the same on every host whatever a variant declares. Overlapping entries cannot tie, because order decides. A variant's scripts never run, so no variant needs an `allowBuilds` entry. The difference is when a mistake shows up: a variant that needed a dependency or a build fails when it runs, where pnpr would have rejected it at publication.
- **Where each build runs is declared once, on the parent.** pnpm puts the declaration in each archive so that the archive's provenance covers it. Here it sits in the parent's manifest, so the parent's provenance covers every claim about where each build runs.

The gap is pnpm's single provenance statement, which proves every archive came from one build. Here, each variant carries its own provenance, which clients that display provenance can show beside the parent's. A field on the variant that names its parent would add little: whoever can publish the variant can write that field.

### Fields, not platform tags

In pnpm's design, a platform tag such as `linux-x64-manylinux_2_28-napi8` is an archive's identity, in routes, lockfile keys, and `--variant` flags. Here, an entry is identified by its package name, and its conditions are fields shaped like the `os`, `cpu`, and `libc` fields publishers already write.

A separate package already has a stable name, so this design has no need for a derived identifier, and clients parse no string grammar at install time. The tag syntax is still accepted where one string is convenient: configuring a target other than the host. The field values are pnpm's, so a tag converts to an entry and back.

### An entry without `libc` matches glibc and musl

In pnpm's design, a Linux platform without `libc` means glibc. Here, an omitted `libc` is no constraint.

That is what an absent `libc` means everywhere in `package.json` today. npm checks `libc` only where it is declared. esbuild, `@bufbuild/buf`, `@vscode/ripgrep`, turbo, and `@sentry/cli` already publish Linux packages without it, which npm installs on glibc and musl alike. A static binary covers both C libraries in one entry. pnpm expresses the same build as one archive with two platforms.

The cost is that a glibc-only build whose entry leaves out `libc` would be selected on musl. A publishing tool can flag an entry that leaves out `libc` when the variant declares one, as glibc-only platform packages do today. pnpr's projection writes glibc out explicitly.

### The parent always exists

In pnpm's design, the primary archive is optional. Without one, pnpm fails on a host no variant matches, and pnpr generates a minimal primary for npm's documents. Here, the parent is the package the user depends on, so it always exists. During migration, it is also the package that older clients install, with its `optionalDependencies` and shim.

A package with no portable build sets `os` and `cpu` on the parent to the union of the builds it ships. That gives the same unsupported-platform failure as pnpr's generated primary, from a file the publisher controls.

### Publishing is left to tools

pnpm's `publishConfig.variants` declares every archive from one package directory, with uploads staged from CI machines and committed once. This RFC defines what is published, not how. Projects build their platform packages with napi-rs, their own release scripts, or a CI matrix, and those tools keep working.

pnpm set aside a top-level `package.json` field for its declaration because the declaration holds publisher paths and is easy to confuse with an archive's `variant` field. The `variants` field here is meant for installers. It holds package specifiers, conditions, and paths inside the variant, not paths on the publisher's machine. [The name](#the-name) covers the overlap with pnpr's field. `publishConfig.variants` could also serve as an authoring format for this field. When publishing to a registry that does not support several archives per version, pnpm could generate a package per variant and the parent's `variants` from the same declaration.

### Behavior, not lockfile formats

pnpm's proposal specifies its lockfile entries. This RFC states only the behavior every lockfile must have (see [What gets installed](#what-gets-installed)). Each client owns its lockfile format, and the requirements are what make clients behave the same. Without per-variant dependencies, there are no per-variant subgraphs to key.
