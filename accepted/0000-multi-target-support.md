# Multi-target support for packages and dependency chains

## Summary

Support multiple targets, target-specific packages, and OS-specific targets.

## Motivation

In many cases, operating systems provide tools or native APIs that significantly accelerate certain actions. These may often be too niche for Node.js core (such as file watching), but nevertheless are still very useful.

For one concrete example, consider [Chokidar](https://github.com/paulmillr/chokidar). It currently uses `fsevents` on macOS, a thin wrapper around that operating system's `FSEvents` API, if available, but it falls back to its own slower implementation.

For another, [Liftoff](https://github.com/js-cli/js-liftoff) could optimize its respawning routine to use the native `execvpe` on most \*nix operating systems, to avoid retaining the overhead of the existing Node.js process.

But in each of those cases, they would likely depend on two packages that only really work on some operating systems:

- [`fsevents`](https://www.npmjs.com/package/fsevents), a thin wrapper around `FSEvents`, works exclusively on macOS and nothing else.
- [`kexec`](https://www.npmjs.com/package/kexec), a thin wrapper around `execvpe`, only works on operating systems with a POSIX-compatible `execvpe`.

There's also numerous packages that are browser-only, enough that I don't feel the need to elaborate on this much. Just as a concrete example, [`@cycle/dom`](https://www.npmjs.com/package/@cycle/dom) requires a live DOM and so it will never work on Node.

And finally, some modules have multiple variants to them, and one might conceivably want to download part or all of them, such as Lodash, Cycle, or Angular.

## Detailed Explanation

These fields would be added to the `package.json`:

- `"supportedTargets": ...` - This would include a list of supported platforms. If omitted, all targets are considered supported.

- `"config": {"target": ...}` - This specifies the default list of platforms to install when running `npm install` (without a package) or `npm ci`. If omitted, it defaults to `"current"`.

- `"targets": {...}` - This would include a list of additional runtime scripts and dependencies, grouped by platform. Each target is a key/value pair, where the key is the target scope to match and the value is an object with the following fields:
  - `"additionalTargets": ...` - This specifies a list of additional targets to use.
  - `"files": [...]` - This is appended to the existing `files` array.
  - `"config": {...}` - This is mixed into the package's global `"config"`. It can replace existing config pairs, too.
  - `"publishConfig": {...}` - This is mixed into the package's global `"config"` on publish. It can replace existing config pairs, too.
  - `"scripts": {...}` - This is mixed into the package's global `"scripts"`. It can replace existing scripts, too.
  - `"dependencies": {...}` - This is mixed into the package's global `"dependencies"`. It can replace existing dependencies, too.
  - `"devDependencies": {...}` - This is mixed into the package's global `"devDependencies"`. It can replace existing dependencies, too.
  - `"peerDependencies": {...}` - This is mixed into the package's global `"peerDependencies"`. It can replace existing dependencies, too.
  - `"bundledDependencies": {...}` - This is mixed into the package's global `"bundledDependencies"`. It can replace existing dependencies, too.
  - `"optionalDependencies": {...}` - This is mixed into the package's global `"optionalDependencies"`. It can replace existing dependencies, too.

Target scopes would be specified as a list of comma-separated values, where:

- `target@version` expands to the target `target` with semver `version`.
  - `target` must be a valid target name, but no other constraints exist on it.
  - `version` may include spaces, but each version must be a valid [semver](https://github.com/npm/node-semver) string. Since valid semver strings never contain commas or ampersands, this just works.
- `platform` expands to the OS platform of that name.
  - `posix` implies all POSIX-like systems, including Linux, the various BSDs, and the experimental Android target.
  - For the special case of browsers, `browser` considered a valid platform.
- `cpu` expands to the CPU architecture of that name.
- `current` (ignored in `"targets"` keys) expands to a list that includes the following targets:
  - The current platform, read from `process.platform`
  - The current CPU architecture, read from `process.arch`
  - The current Node version, specified as `node@version` and read from `process.version`
  - The current client along with its version (for npm 5.0.0, it's `npm@5.0.0`, for example)
- `foo` expands to the target `foo`.
- `!foo` expands to all valid targets except `foo`.
  - The target can be wrapped in parentheses like `!(foo,bar,baz)`, in case you need to negate a union or intersection.
- `foo&bar&...` expands to the intersection of all targets, with higher precedence than `foo,bar,...`.
- `foo,bar,...` expands to the union of all targets, with lower precedence than `foo&bar&...`.
- Whitespace on either side of a target scope is trimmed, so `foo , bar & baz` is equivalent to `foo,bar&baz`.
- Order is not important with `foo&bar&...` and `foo,bar,...` - it's deliberately just working at the set level.
- Target names must match the following regexp, but there are no other restrictions: `/^@?[^\s(),&!]+$/`

When reading the config, all targets that represent a subset of the current target set are applied, in order of appearance in `"targets"`. `"files"` for each matching target are concatenated with the existing list, and all others are merged with the existing objects. Other notes:

- This can result in config entries, scripts, and dependencies being replaced in the config, which is sometimes useful, but also something to be careful with.
- If no `cpu` or `platform` is specified, it's equivalent to specifying all possible CPUs or platforms, respectively.

This proposal would replace a few existing fields, but I do not propose any of them be removed:

- `"os"` and `"cpu"` would just become standard targets, like `win32` or `mips`. If `"targets"` exists, these two fields would be ignored.
- `"engines"` would become `engine@version` targets. If `"targets"` exists, this field would be ignored.

These fields would be ignored if `"targets"` exists, and the relevant warnings for those would be emitted only if at least one platform is present in `"supportedTargets"`.

Packages could have additional targets specified in their version as `target=...`, so you can specify targets explicitly. These would be merged with the scope of the dependency via a simple union. The package lock format (for both `package-lock.json` and `npm-shrinkwrap.json`), it'd just involve a new `"target"` field for each dependency, stating which targets it's visible to. If omitted in child dependencies, it's the same set as the parent dependency, and in top-level dependencies, it's visible to all dependencies. (This normalizes both `target=...` and `"targets"`.)

When a child shares a dependency with the parent, the targets are merged together and both targets are downloaded as part of the module. This saves on network requests and keeps the file system tree much saner.

The current, fully-merged scope is available under the environment variable `npm_target_scope`, and it's anticipated that other utilities may wish to read this, especially in `install` scripts.

When performing `npm install` and `npm ci`, it does the following:

- Install all development dependencies with the target scope `current,npm-install`.
- Install all runtime dependencies with the union of the development target scope and the target scope specified in the config variable `target`, intersected with the union of the selected target's key if the dependency is specified in a target and applicable `target=...` scope.
- Run the installation scripts with the runtime's scope.
- Uninstall all installed dependencies that would've been ignored if `install` was omitted.

When performing `npm install --production` or `npm ci --production`, it does the following:

- Install all installation dependencies with the target scope `current,npm-install,production`.
- Install all runtime dependencies with the union of the target scope `production` and the target scope specified in the config variable `target`, intersected with the union of the selected target's key if the dependency is specified in a target and applicable `target=...` scope.
- Run the installation scripts with the runtime's scope.
- Uninstall all installed dependencies that would've been ignored if `npm-install` was omitted.

This proposal would (potentially in the future) add a new optional option for the registry API to choose which target to download files for. The registry would have awareness of what files each package has vs what files each target uses and use that info to send a custom tarball on each request.

For a couple concrete examples of how this would unfold:

- Chokidar might choose to add this to their `package.json`:

  ```json
  "target": {
    "darwin": {
      "fsevents": "^1.2.2"
    }
  },
  ```

- `kexec` might choose to add this to their `package.json` (`execvpe` is not available on AIX):

  ```json
  "supportedTargets": "posix & !aix",
  ```

- Liftoff, if they implemented that optimization, would potentially add this to their `package.json`:

  ```json
  "target": {
    "posix & !aix": {
      "kexec": "..."
    }
  },
  ```

## Rationale and Alternatives

The first alternative solution I considered was [just adding a bunch of `platform*Dependencies`](https://npm.community/t/there-needs-to-be-a-way-to-denote-os-specific-dependencies/4313) to mirror the existing dependency fields. This is the most obvious, but there's cons to this approach, and it's arguably the worst:

- It's just yet another bolt-on hack. There's already quite a few of these now.
- It's unnecessarily verbose. Consider potentially having both `platformDependencies` + `platformPeerDependencies` and having to specify each platform twice.
- It doesn't let you avoid (or exclusively install) browser-only dependencies. There's no reason to download `util-inspect` when you're not going to use it.
- If you need a dependency on all but 2 platforms, you'd have to duplicate it 5 times.

Another alternative solution is to do similar to mine, but only allow simple, known targets, like `win32,linux` or `!win32,!aix`. I initially considered that while drafting this, but there's still a couple issues, mostly in common with the above:

- Browser-specific dependencies would still have to be either bundled or depended on globally.
- It's not uncommon to have dependencies that are different to different runtimes.
- It doesn't make room for custom engines, like if someone wanted to bundle for a different non-CommonJS environment like, say, Nashorn or Moddable XS.

This, however, is open-ended, so anyone can come up with any variety of stuff. For example:

- Lodash could offer an `esm` target, a `global` target, an `amd` target, and a default `commonjs,!(esm,global,amd)` target, each with different files. Requesting the module just requests the variant you want, and instead of Lodash and the user doing all the work, it's npm.
- Angular could publish their entire module under `angular/*` and you just specify the features you want in the requested target, like `target=ng-animation,ng-http,ng-forms`. Dependencies would naturally get everything they asked for, and it's all magically deduplicated. Lodash could offer similar with `target=lodash.filter,lodash.map,lodash.matches` to replace their modular build, `target=lodash.core` to expose just the core parts of `lodash`, and `target=lodash.fp` to expose `lodash/fp`.
- `util-inspect` could be modified to download and use exactly 2 files when not downloading for browsers: `index.js` and `package.json`.
- You could have a `no-native` to only use pure-JS implementations (which may be slower), for modules that support it.
- Chokidar could actively depend on `fsevents`, only on macOS, but they could put it behind a `darwin&!no-native` target scope to allow people to have the escape hatch.
- React could bundle `ReactDOM` by default (exposed via `react/dom`), and just have people pass a `no-dom` target scope to require an explicit renderer implementation.

## Implementation

Not sure yet about details, because I'm only vaguely familiar with npm's internals.

It will require a new module for parsing, tracking, and effeciently checking target scopes. This would be used by npm itself as a dependency, but it'd be exposed for other users to use as well, much like `semver`. (It's particularly useful for install scripts.)

It will also have a pretty broad effect on dependency resolution, probably requiring a slight architectural change to accommodate the new constraint system.

## Prior Art

- Rust's Cargo has [`target.'cfg(platform)'.dependencies`](https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html#platform-specific-dependencies), which is basically this proposal.
- Python's `setuptools` library (widely-used sugar over their built-in `distutils` module) has [`install_requires`](https://setuptools.readthedocs.io/en/latest/setuptools.html#declaring-platform-specific-dependencies) for specifying a package as OS-specific on the library's end, and the config is in plain Python (so you can do platform-specific dependencies that way).
- RubyGems' configuration file is in Ruby, much like all other straight configuration files in that language, so you can just [use Ruby's `RUBY_PLATFORM` constant](https://stackoverflow.com/questions/170956/how-can-i-find-which-operating-system-my-ruby-program-is-running-on) to do what you need.
- Apache Maven [uses a combination of OS-specific build targets, target-specific dependencies, and target inheritance](https://stackoverflow.com/questions/7650727/builds-for-different-platforms-the-maven-way).
- Clojure's Leningen [uses profiles + dynamic profile alias + a package manager API call](https://github.com/technomancy/leiningen/blob/stable/doc/FAQ.md) for platform-specific dependencies. It's all plain Clojure, which simplifies it further.
- Gradle uses [multiple configurations with targets extending from them](https://stackoverflow.com/a/40555398).
- LuaRocks supports [platform-specific overrides](https://github.com/luarocks/luarocks/wiki/Platform-overrides) as well as [`supported_platforms`](https://github.com/luarocks/luarocks/wiki/Rockspec-format).

The effect is probably pretty obvious.

## Unresolved Questions and Bikeshedding

- Should other hooks have their own target scopes passed, like `npm-publish` when publishing or `npm-version` when running `npm version`? I'm leaning towards no.
- Should there be a scope of `*` to download and install all platforms? I'm torn, since although it's useful (especially `!*`, the empty set), scripts will almost certainly make false assumptions here, so it runs the risk of being a giant footgun.
- Naming is hard, and although I'm okay with `"supportedTargets"`, it reads a little more verbose than what I'd prefer.
- It seems a little weird putting the default target in config only, but it does simplify things some. I previously had it as a separate `package.json` property, so it might be better there?
- What else should be passed when expanding `current`? [Node has a lot of process- and runtime-related information exposed via `process`](https://nodejs.org/api/process.html), so anything beyond platforms, CPUs, and Node/npm versions was somewhat arbitrary.
