# Resolve packages based on Node.js version

## Summary

npm should be able to accept a semver range of a package and install the highest available version that supports the current Node.js version.

## Motivation

Developers often make apps/libraries that need to support multiple versions of the same package, which have different minimum Node.js versions.

A good use case for this is to allow "progressive upgrades": 
- my library supports Node.js 10.x and above
- package X releases `newVersion`, which supports Node.js 12.x and above
- I change my package X constraint from `"oldVersion"` to `"oldVersion || newVersion"`
- My code will then use `newVersion` when my code is running on 12.x, and fallback to `oldVersion` when running on 10.x
- This gives several benefits:
  - I can test out `newVersion` locally over time before upgrading the production server's Node.js version
  - I can support older Node.js versions while benefitting from package X's newer versions on newer Node.js versions

Right now, npm always installs the highest available version of the package, even if it isn't supported on my Node.js version, making this hard.

## Detailed Explanation

npm should take the current Node.js version into consideration when determining valid package versions to install.

For instance, Mocha v9 [dropped support for Node.js 10.x](https://github.com/mochajs/mocha/pull/4633) (using the `engines` field). However, in my library, Node.js 10.x is still supported for end users, so I'd like to use Mocha v8 to run tests on Node.js 10.x and v9 on 12.x. There are no major API changes, so this should be easy to do.

Currently, specifying a semver range like `"mocha": "^8.0.0 || ^9.0.0"` doesn't work. npm happily installs v9 even on Node.js 10.x (although it outputs a warning):

```
❯ npm i
npm WARN EBADENGINE Unsupported engine { package: 'mocha@9.0.1',
npm WARN EBADENGINE   required: { node: '>= 12.0.0' },
npm WARN EBADENGINE   current: { node: 'v10.24.1', npm: '7.17.0' } }

added 92 packages, and audited 93 packages in 1s

❯ npm list mocha
in@ C:\Users\shalvah\<projectpath>
`-- mocha@9.0.1
```

With the `--engine-strict` flag, the install is stopped:

```
❯ npm i --engine-strict
npm ERR! code EBADENGINE
npm ERR! engine Unsupported engine
npm ERR! engine Not compatible with your version of node/npm: mocha@9.0.1
npm ERR! notsup Not compatible with your version of node/npm: mocha@9.0.1
npm ERR! notsup Required: {"node":">= 12.0.0"}
npm ERR! notsup Actual:   {"npm":"7.17.0","node":"v10.24.1"}
```

The goal is to change this so that, on Node.js 10.x, version 8 is installed instead in both cases.

## Rationale and Alternatives

Current workarounds:
1. Maintain separate copies of `package.json` for different Node.js versions (such as a `package.json` and a `package.10.x.json`, with the latter referencing the older version of the package), and switch between them when on a different Node.js version
2. Manually replace the package version in `package.json` when on a different Node.js version.

Both these options are clunky, as they involve either manual work or additional scripting.

## Implementation

During `npm install`:
- Fetch package versions satisfying the semver range
- Get the current Node.js version (`process.version`). If there is an `engines.node` field in the root package, this overrides the value from `process.version`.
- Find the highest which supports the current Node.js version.
  - If there is none, fallback to the current behaviour (install the highest available, or fail if `--engine-strict` is set).
  - If there are valid versions for this Node.js version, install the highest of those.

This will apply all the way down the tree.

A package is defined as supporting a Node.js version if it does not define any `engines.node` constraint, or defines an `engines.node` constraint that is satisfied by that version.

During `npm ci`, the current behaviour should be retained (install exactly from lockfile). The engine-aware behaviour will only be activated when using `npm install`.

## Prior Art

- In the PHP world, Composer does this—it will look for package versions with a declared `php` constraint that match your local version, or with no `php` constraints at all. You can override your "local version" with the `config.platform.php` field, similar to `engins.node`.

## Unresolved Questions and Bikeshedding

- I think this behaviour should be the default, with or without `engine-strict`. As a user, running `npm install` and getting package versions that will crash on my machine is counter-intuitive.
- I'm not sure if this should also apply to the current npm version as well.

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
