# Install Script Allowlist

## Summary

Add an opt-in mode where npm requires explicit approval before running install
lifecycle scripts (`preinstall`, `install`, `postinstall`, and auto-detected gyp
files). The default behavior is unchanged — scripts run as they do today. Users
who enable the feature choose between two enforcement modes: `ignore` (silently
skip unapproved scripts) and `error` (fail the install). Approved packages are
tracked in a JSON allowlist that can live in `package.json`, in one or more
standalone JSON files referenced by `.npmrc`, or both — all sources are merged
together.

## Motivation

This proposal builds on [npm/rfcs#488](https://github.com/npm/rfcs/pull/488) by
@tolmasky and the extensive community discussion there. The core security
argument from that RFC still holds and has only grown stronger:

- Install lifecycle scripts execute arbitrary code at install time, before the
  consuming project ever `require`s or `import`s the package. Only ~0.6% of
  packages on npm use install lifecycle scripts (12,035 out of ~2 million
  packages as of November 2021, per
  [tolmasky's analysis in RFC #488](https://github.com/npm/rfcs/pull/488)), yet
  they represent the easiest vector for supply-chain attacks.
- Real-world exploits continue to demonstrate the risk. The 2021 `coa`/`rc`
  compromises, the 2025–2026 "Shai Hulud" worm, and numerous typosquatting
  attacks all leveraged postinstall scripts to propagate.
- Alternatives to install lifecycle scripts have matured. N-API,
  prebuild-install, and platform-specific optional dependencies
  (`os`/`cpu`/`libc` fields) cover the many legitimate use cases that
  historically required compilation at install time.

The original RFC proposed changing the default so that scripts are off unless
explicitly allowed. That was rejected as too disruptive. This proposal takes a
different approach: **the default does not change**. Instead, npm gains a new
opt-in enforcement mode with an allowlist, giving security-conscious users and
organizations a first-class way to control which packages may run scripts —
without breaking anyone who doesn't opt in.

For organizations managing large codebases, shared management of the allowlist
is essential. Organizations need to populate a shared allowlist with every
package whose scripts are known to be in use, then enable `error` mode globally
so that any _new_ unapproved script is caught immediately. The allowlist must be
shareable across repositories without requiring changes to each project's
`package.json`. See [Allowlist sources](#allowlist-sources) and
[bikeshedding](#unresolved-questions-and-bikeshedding) for how this could work.

## Detailed Explanation

### Enforcement mode

A new `.npmrc` config value controls the feature:

```ini
install-script-policy=off|ignore|error
```

- `off` (default): Current behavior. All install lifecycle scripts run
  unconditionally.
- `ignore`: Unapproved scripts are silently skipped. At the end of
  `node_modules` construction, npm prints a summary of every package whose
  scripts were skipped.
- `error`: Unapproved scripts are skipped. At the end of `node_modules`
  construction, npm exits non-zero and prints the list of unapproved packages
  that had scripts.

In both `ignore` and `error` modes, npm collects the full list of skipped
packages and reports them together at the end of the install, rather than
failing on the first one. This makes it practical to build an allowlist in one
shot.

### Allowlist format

The allowlist is a JSON object with a single top-level field:

```json
{
  "approvedInstallScripts": {
    "node-gyp-build": "allowed",
    "esbuild": "allowed",
    "esbuild@>=0.25.0": "allowed",
    "sqlite3@4.x": "allowed",
    "husky": "ignored",
    "sponsorware-nag": "ignored"
  }
}
```

Keys are `<package-name>` or `<package-name>@<semver-range>`. A bare package
name (no `@range`) is equivalent to `@*` and matches all versions. Semver ranges
in this list match pre-release versions.

Values:

- `"allowed"` — the package's install lifecycle scripts will run.
- `"ignored"` — the package's install lifecycle scripts will not run, and the
  package will not be listed as an error in `error` mode. This is useful for
  packages whose scripts are non-essential (telemetry, sponsorship messages,
  optional native compilation with a JS fallback, etc.).

### Allowlist sources

We need allowlist entries to come from at least two places because npmrc's
config model flattens values — a project-level `.npmrc` replaces a global-level
value rather than merging with it. If the allowlist lived only in `.npmrc`, a
project that sets `install-script-allowlist=project-scripts.json` would silently
discard the global `install-script-allowlist=company-scripts.json`. That defeats
the central-management use case entirely.

The proposed solution uses two complementary sources:

1. **External JSON files referenced by `.npmrc`** — for shared and global
   config. An organization sets this once in a global or user `.npmrc` and every
   project inherits it.

   ```ini
   install-script-allowlist[]=/etc/npm/approved-scripts.json
   ```

2. **`package.json`** — for per-project entries that are tracked in source
   control alongside the code.

   ```json
   {
     "name": "my-app",
     "approvedInstallScripts": {
       "esbuild": "allowed"
     }
   }
   ```

All sources are merged (unioned). If the same key appears in multiple sources,
the most permissive value wins (`"allowed"` > `"ignored"`). The goal is to
reduce toil — an organization can maintain one shared list and have every
project inherit it automatically, while individual projects can still add their
own entries. Whether a project should also be able to _override_ a shared entry
(e.g. downgrade `"allowed"` to `"ignored"`) is an open question, but not a hard
requirement either way.

This two-source approach is a concrete proposal, but we're open to better ideas
for achieving the same goal: a project-level list that coexists with a
centrally-managed list. If there's a cleaner way to get mergeable lists out of
npmrc, or a different file format that works better, we'd welcome that.

### Interaction with `--ignore-scripts`

`--ignore-scripts` continues to work as today — it disables all scripts
unconditionally, regardless of the allowlist. The allowlist only applies when
`install-script-policy` is `ignore` or `error` and `--ignore-scripts` is not
set.

### Scope

This feature applies to the install lifecycle scripts that run during
`npm install` for dependencies:

- `preinstall`
- `install`
- `postinstall`
- Implicit `node-gyp rebuild` (when a `binding.gyp` is detected and no `install`
  script is defined)
- `prepare` scripts of git dependencies (which run during install to build the
  package from source)

It does not affect:

- Scripts in the root project and workspaces' `package.json` (the package being
  developed). It's specifically for installed dependencies.
- `npm run` / `npm test` / `npm start` etc.

## Rationale and Alternatives

### Alternative 1: Change the default (tolmasky's original RFC #488)

Making scripts opt-in by default is the ideal end state, but the npm team and
community rejected it as too disruptive in 2021–2022. This proposal provides the
same security benefit for users who opt in, without breaking anyone. It could
serve as a stepping stone toward eventually changing the default in a future
major version, once the ecosystem has had time to adapt.

### Alternative 2: Use `@lavamoat/allow-scripts` or similar userland tools

Tools like `@lavamoat/allow-scripts` and `can-i-ignore-scripts` exist and work
today. However, they require adding a dependency and a workflow change to every
project. A first-party npm feature would be more discoverable and require no
extra dependencies.

### Alternative 3: Migrate to `pnpm`

Package owners that would opt-in to install script allowlists could migrate to
pnpm instead. I know this would be a difficult migration for the codebase I
manage.

## Implementation

The implementation touches a few areas of the npm CLI:

1. **Config**: Add `install-script-policy` (enum: `off`, `ignore`, `error`) and
   `install-script-allowlist` (array of file paths) to the config schema.

2. **Allowlist loading**: At the start of `npm install` / `npm ci`, read and
   merge the allowlist from all configured sources (package.json + external
   files). Build a lookup structure mapping `(package-name, version)` →
   `allowed | ignored | unapproved`.

3. **Script gating**: In the lifecycle script runner (likely in
   `@npmcli/run-script` or the reification step in `@npmcli/arborist`), before
   executing an install lifecycle script for a dependency, check the merged
   allowlist. If the package+version is not approved, skip the script and record
   it.

4. **Reporting**: After reification completes, if any scripts were skipped,
   print a summary. In `error` mode, exit non-zero if any skipped packages were
   not marked `"ignored"`.

## Prior Art

- [npm/rfcs#488](https://github.com/npm/rfcs/pull/488) — @tolmasky's "Make npm
  install scripts opt-in" RFC (2021). Extensive discussion, 369 👍, not merged
  due to breaking-change concerns.
- [pnpm `onlyBuiltDependencies` / `allowBuilds`](https://pnpm.io/settings#allowbuilds)
  — pnpm 10 blocks lifecycle scripts by default with an allowlist in
  `package.json`.
- [`@lavamoat/allow-scripts`](https://www.npmjs.com/package/@lavamoat/allow-scripts)
  — Userland tool that disables scripts via `--ignore-scripts` and selectively
  re-runs them from an allowlist in `package.json`.
- [`can-i-ignore-scripts`](https://www.npmjs.com/package/can-i-ignore-scripts) —
  Helps audit which dependencies actually need install lifecycle scripts.

## Unresolved Questions and Bikeshedding

### Config key names

`install-script-policy`, `install-script-allowlist`, and the JSON field
`approvedInstallScripts` are suggestions. The names should be bikeshedded. What
matters is the semantics: a mode toggle, a list of external config files, and a
mergeable allowlist structure.

I proposed using both package.json fields and npmrc because that allows package
and global config. Another option could be to use npmrc, but merge the arrays
across rc files instead of replace them.

```
# ~/.npmrc
install-script-allowlist[]=/etc/npm/shared-approved-scripts.json

# /project/.npmrc
install-script-allowlist[]=./approved-scripts.json

# runtime sees ['/etc/npm/shared-approved-scripts.json', './approved-scripts.json']
```

I didn't propose this because it doesn't behave like other npm config arrays.

### Should `npm install <pkg>` in interactive mode prompt the user?

When adding a new dependency that has install lifecycle scripts, npm could
interactively ask whether to approve it, similar to how `apt` confirms disk
usage or how Composer prompts for plugin permissions.

### Should there be an `npm approve-scripts` command?

A helper command that scans `node_modules` (or the package tree) and
generates/updates the allowlist would make adoption much easier. Something like
`npm approve-scripts --init` to populate the allowlist with all
currently-installed packages that have scripts.

### Interaction with workspaces

In a monorepo, should each workspace have its own `approvedInstallScripts` in
its `package.json`, or should only the root's list apply? The external-file
approach naturally handles this (point all workspaces at the same file), but the
`package.json` story needs clarification.
