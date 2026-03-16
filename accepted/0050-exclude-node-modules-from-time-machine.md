# Exclude `node_modules` from macOS Time Machine backups

## Summary

When `npm install` creates a `node_modules` directory on macOS, npm should mark
it with the extended attribute (xattr) that tells Time Machine to skip it. This
prevents `node_modules` — which can be fully reconstructed from `package-lock.json`
— from filling up backup disks and slowing down backup runs. The behaviour can
be opted out of via an `.npmrc` flag for users who do wish to include
`node_modules` in their backups.

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
present on a file or directory with the binary-plist value `com.apple.backupd`,
Time Machine (and the underlying `backupd` daemon) skips that item permanently.
This is the same mechanism used by the Xcode build toolchain for its `DerivedData`
directories.

The binary plist value is:
```
62 70 6C 69 73 74 30 30 5F 10 11 63 6F 6D 2E 61  |bplist00_..com.a|
70 70 6C 65 2E 62 61 63 6B 75 70 64 08 00 00 00  |pple.backupd....|
00 00 00 01 01 00 00 00 00 00 00 00 01 00 00 00  |................|
00 00 00 00 00 00 00 00 00 00 00 00 1C           |.............|
```

This is equivalent to running:
```sh
tmutil addexclusion -p /path/to/node_modules
```

### When the attribute is applied

npm should set this attribute whenever it creates or updates a `node_modules`
directory on macOS (i.e. `process.platform === 'darwin'`). Concretely, this
means applying it after the reify step in `@npmcli/arborist` completes, once
the `node_modules` directory is known to exist on disk.

### Setting the attribute

Because Node.js does not provide a built-in API for extended attributes, npm
should shell out to the macOS `xattr` command-line utility, which ships with
every macOS installation:

```sh
xattr -w -x com.apple.metadata:com_apple_backup_excludeItem \
  "62706c6973743030 5f1011 636f6d2e6170706c652e6261636b757064 08 0000000000000101 0000000000000001 000000000000001c" \
  /path/to/node_modules
```

The call is made with `child_process.execFile` (non-blocking, errors suppressed)
so that it does not affect npm's exit code or performance on non-macOS systems
or when the `xattr` binary is unavailable.

### New configuration option

A new boolean flag `backup-node-modules` is added to npm's configuration:

| Key                  | Default  | Description |
|----------------------|----------|-------------|
| `backup-node-modules`| `false`  | When `true`, prevents npm from marking `node_modules` with the Time Machine exclusion xattr on macOS. |

Setting `backup-node-modules=true` in `.npmrc` (or via `npm config set`) gives
users who need `node_modules` in their backups a simple escape hatch.

## Rationale and Alternatives

### Alternative 1 – Opt-in (do nothing by default)

npm could expose the `backup-node-modules=false` flag but leave the default as
`true` (i.e. back up by default, opt out of backup exclusion). This mirrors the
current status quo.

**Drawback:** Users who suffer from bloated backups or slow backup runs must
first discover the problem, then discover the flag. Many users will never find
it. The downside of the default (disk-consuming, slow backups) is worse than
the downside of the proposed default (no backup of something that is
reconstructible), making opt-in a poorer default.

### Alternative 2 – Require users to use `tmutil` manually

Users can already run `tmutil addexclusion -p ~/project/node_modules` themselves.
Some tools (e.g. `Finder`'s "Exclude from backups" checkbox) surface this, but
the exclusion must be re-applied after `node_modules` is deleted and reinstalled.
The "sticky exclusion" set by npm persists even across reinstalls because it
travels with the directory while it exists and is re-applied by npm on the next
install.

**Drawback:** Relies on the user taking manual action every time they start a
new project; does not scale.

### Alternative 3 – Use a `.nobackup` file convention

Some tools place a sentinel file (e.g. `CACHEDIR.TAG`) inside directories to
hint that the contents are caches. This is not recognised by Time Machine and
would have no effect.

### Chosen approach

The proposed opt-out default strikes the best balance: the vast majority of
developers do not want `node_modules` in their backups (it is reproducible from
`package-lock.json`), while the minority who do can set one flag. The xattr
approach is the correct macOS-native mechanism, requires no third-party
dependency, and is battle-tested by both Xcode and the Rust toolchain.

## Implementation

### Affected repositories / packages

* **`@npmcli/arborist`** – After the `reify()` call writes `node_modules` to
  disk, a new helper (`lib/utils/time-machine-exclude.js` or similar) is invoked
  when `process.platform === 'darwin'` and the `backup-node-modules` config
  option is `false`.

* **`npm/cli`** – Adds the `backup-node-modules` configuration key (type:
  `Boolean`, default: `false`) to `lib/utils/config/definitions.js` and exposes
  it in the docs.

### Helper implementation sketch

```js
// lib/utils/time-machine-exclude.js  (inside @npmcli/arborist or npm/cli)
const { execFile } = require('child_process')

const ATTR_NAME = 'com.apple.metadata:com_apple_backup_excludeItem'
const ATTR_VALUE =
  '62706c6973743030' +
  '5f1011636f6d2e6170706c652e6261636b757064' +
  '0800000000000001010000000000000001' +
  '000000000000001c'

function excludeFromTimeMachine (nodeModulesPath) {
  if (process.platform !== 'darwin') {
    return
  }
  execFile('xattr', ['-w', '-x', ATTR_NAME, ATTR_VALUE, nodeModulesPath], () => {
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
