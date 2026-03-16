# Exclude `node_modules` from macOS Time Machine backups

## Summary

On macOS, npm should provide an opt-in flag that marks a project's `node_modules`
directory with the extended attribute that tells Time Machine to skip it. This
prevents `node_modules` — which can be fully reconstructed from `package-lock.json`
— from filling up backup disks and slowing down backup runs.

## Motivation

`node_modules` directories are, in effect, a local cache derived entirely from
`package-lock.json`. They can be recreated at any time with a single `npm install`
and therefore carry no unique, irreplaceable data.

On macOS, Apple's Time Machine backup tool backs up every file that it can see,
including the often tens-of-thousands of small files inside `node_modules`. This
has several painful side-effects:

* **Slow incremental backups.** Each `npm install` or `npm update` touches many
  files, forcing Time Machine to scan and snapshot all of them on the next backup
  run.
* **Rapid backup-disk consumption.** Accumulated snapshots of large
  `node_modules` trees eat disk space quickly and can cause backups to fail
  entirely when the backup volume fills up.
* **Slower system performance during backups.** The high file count in
  `node_modules` can cause noticeable I/O spikes while Time Machine is indexing.

The xattr-based "sticky exclusion" mechanism provided by macOS lets any tool
flag a directory so that it is permanently skipped by Time Machine — even when
the directory is moved or renamed — without requiring user interaction in System
Preferences.

## Detailed Explanation

### The macOS sticky-exclusion mechanism

macOS exposes a per-item backup exclusion flag through the extended attribute
key `com.apple.metadata:com_apple_backup_excludeItem`. When this attribute is
present on a file or directory with the value `com.apple.backupd`, Time Machine
(and the underlying `backupd` daemon) skips that item permanently. This is the
same mechanism used by the Xcode build toolchain for its `DerivedData`
directories, and is equivalent to running:

```sh
tmutil addexclusion -p /path/to/node_modules
```

### When the attribute is applied

When the opt-in flag is set, npm should apply this attribute on macOS
(i.e. `process.platform === 'darwin'`) as soon as a `node_modules` directory is
created on disk — that is, at directory-creation time inside
`@npmcli/arborist`, before any package files are written into it.

### Setting the attribute

Because Node.js does not provide a built-in API for extended attributes, npm
should shell out to the macOS `xattr` command-line utility, which ships with
every macOS installation:

```sh
xattr -w com.apple.metadata:com_apple_backup_excludeItem \
  com.apple.backupd \
  /path/to/node_modules
```

Writing the value as a plain UTF-8 string is sufficient — Time Machine respects
the attribute regardless of whether the value is a raw string or a binary plist.
The call is made with `child_process.execFile` (non-blocking, errors suppressed)
so that it does not affect npm's exit code or performance on non-macOS systems
or when the `xattr` binary is unavailable.

### New configuration option

A new boolean flag `time-machine-exclude` is added to npm's configuration:

| Key                    | Default  | Description |
|------------------------|----------|-------------|
| `time-machine-exclude` | `false`  | When `true`, marks `node_modules` with the macOS Time Machine exclusion xattr after every install on macOS. |

Users who want `node_modules` excluded from their backups set
`time-machine-exclude=true` in their `.npmrc` (or via `npm config set`).

## Rationale and Alternatives

### Alternative 1 – Opt-out (exclude by default)

npm could apply the xattr on every macOS install and provide a flag to opt back
in to backups. This would protect the majority of users automatically.

**Drawback:** Silently preventing something from being backed up — without the
user asking for it — is surprising behaviour and has caused concern among npm
collaborators. A user who relies on their backup for disaster recovery may not
realise `node_modules` is excluded until they attempt a restore. The opt-in
approach ensures the user has made a deliberate choice.

### Alternative 2 – Write the value as a binary plist

`tmutil addexclusion` writes the value as a binary plist encoding of the string
`com.apple.backupd`. This is technically the more correct form of the attribute.

**Drawback:** Generating a binary plist in Node.js without a native library
requires manual `Buffer` construction (or shelling out to an additional tool).
In practice, Time Machine respects the attribute whether the value is a raw
string or a binary plist — many projects write it as a plain string with the
same effect. Plain strings are simpler and carry no additional risk.

### Alternative 3 – Use `tmutil addexclusion`

`tmutil addexclusion -p /path/to/node_modules` is the official command-line
interface for adding a "sticky" backup exclusion.

**Drawback:** `tmutil` is significantly slower than writing the xattr directly,
which would noticeably increase install time.

### Alternative 4 – Use `NSURLIsExcludedFromBackupKey` / `kCFURLIsExcludedFromBackupKey`

Apple's official URL resource property (`NSURLIsExcludedFromBackupKey` in
Objective-C/Swift, `kCFURLIsExcludedFromBackupKey` in Core Foundation) is the
high-level API for the same underlying mechanism. This is the approach taken by
Cargo ([cargo#4386](https://github.com/rust-lang/cargo/pull/4386)).

**Drawback:** Node.js and libuv do not expose this API. Using it would require
a native add-on, which significantly increases implementation and maintenance
complexity.

### Alternative 5 – Require users to use `tmutil` manually

Users can already run `tmutil addexclusion -p ~/project/node_modules` themselves.
Some tools (e.g. `Finder`'s "Exclude from backups" checkbox) surface this, but
the exclusion must be re-applied after `node_modules` is deleted and reinstalled.
The "sticky exclusion" set by npm persists even across reinstalls because it
travels with the directory while it exists and is re-applied by npm on the next
install.

**Drawback:** Relies on the user taking manual action every time they start a
new project; does not scale.

### Chosen approach

The opt-in default is the conservative choice: npm does not silently alter backup
behaviour, but provides a first-class, project-level knob for developers who
actively want their `node_modules` excluded. Writing the xattr value as a plain
string is the simplest correct implementation — no native add-on, no binary plist
generation, no dependency on slow system utilities.

## Implementation

### Affected repositories / packages

* **`@npmcli/arborist`** – The code path that creates a new `node_modules`
  directory on disk is updated to immediately call a helper
  (`lib/utils/time-machine-exclude.js` or similar) when
  `process.platform === 'darwin'` and the `time-machine-exclude` config
  option is `true`.

* **`npm/cli`** – Adds the `time-machine-exclude` configuration key (type:
  `Boolean`, default: `false`) to `lib/utils/config/definitions.js` and exposes
  it in the docs.

### Helper implementation sketch

```js
// lib/utils/time-machine-exclude.js  (inside @npmcli/arborist or npm/cli)
const { execFile } = require('child_process')

const ATTR_NAME = 'com.apple.metadata:com_apple_backup_excludeItem'
const ATTR_VALUE = 'com.apple.backupd'

function excludeFromTimeMachine (nodeModulesPath) {
  if (process.platform !== 'darwin') {
    return
  }
  execFile('xattr', ['-w', ATTR_NAME, ATTR_VALUE, nodeModulesPath], () => {
    // errors intentionally ignored — absence of xattr binary or unsupported FS
    // must not break npm
  })
}

module.exports = { excludeFromTimeMachine }
```

### No native add-on required

The implementation shells out to `/usr/bin/xattr`, which is present on every
supported macOS version. No native Node.js add-on or additional npm dependency
is needed.

## Prior Art

* **Rust / Cargo** – Added the same xattr exclusion for `target/` directories in
  [cargo#4386](https://github.com/rust-lang/cargo/pull/4386). This is the
  primary inspiration for this RFC.
* **Python / Poetry** – Implemented the same exclusion for `.venv` directories
  in [poetry#4599](https://github.com/python-poetry/poetry/pull/4599).
* **Xcode** – Uses the same mechanism for `DerivedData`; Apple documents it in
  their backup-exclusion guides.

## Unresolved Questions and Bikeshedding

* **Config flag naming**: `backup-node-modules` vs `time-machine-exclude` vs
  `no-backup`? The name should make the purpose clear and follow npm config
  naming conventions.
* **Scope of exclusion**: Should only the top-level `node_modules` be excluded,
  or also nested `node_modules` within workspaces? The simplest initial
  implementation excludes only the root `node_modules` and each workspace's own
  `node_modules`, matching where Arborist writes packages.
* **Other backup tools**: The xattr is specific to Time Machine / `backupd`. It
  does not exclude `node_modules` from iCloud Drive sync, Dropbox, or other
  tools. Those cases may be addressed in a separate RFC.
* **Removal on `npm uninstall --global` or `rm -rf node_modules`**: The xattr
  lives on the directory; when the directory is deleted and recreated, npm
  re-applies the attribute on the next install.
