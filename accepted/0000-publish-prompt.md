# Publish prompt

## Summary

Publishing a package should prompt a confirmation prompt, allowing users to validate their package info before uploading their package tarball.

## Motivation

Breaking the prompt into a two-step operation allows for a validation of contents prior to uploading the package.

## Detailed Explanation and Rationale

`npm publish` should ask for a confirmation prompt prior to uploading the package tarball.

Currently "publish" has a very nice **unintended UX** for users with 2FA enabled, in which it stops the publish process in order to ask for the OTP code, allowing for a review of the file contents (and even cancelling the process altogether) prior to uploading the tarball file.

A broader population of package authors can benefit from this UX if we formalize it. Allowing for review of contents and cancelation of package publishing.

## Alternatives

1. Not change it, just keep the current behavior?
2. Implement it behind an _opt-in_ config option

## Implementation

This is a breaking change from the current `npm publish` behavior, it would prompt the user for confirmation:

```sh
$ npm publish

npm notice
npm notice 📦  disparity@3.0.0
npm notice === Tarball Contents ===
npm notice 183B  bin/disparity
npm notice 2.1kB disparity-cli.js
npm notice 4.3kB disparity.js
npm notice 999B  package.json
npm notice 875B  CHANGELOG.md
npm notice 1.1kB LICENSE.md
npm notice 3.7kB README.md
npm notice === Tarball Details ===
npm notice name:          disparity
npm notice version:       3.0.0
npm notice filename:      disparity-3.0.0.tgz
npm notice package size:  5.2 kB
npm notice unpacked size: 13.3 kB
npm notice shasum:        4344ee202484ab134227913a3af6f4a0ae5f0a59
npm notice integrity:     sha512-NAItmPQyt6dya[...]m5N3kfPPJYj0w==
npm notice total files:   7
npm notice

This operation will publish your package to the npm registry.
Do you wish to proceed? [y/N]
```

The user can also provide a `--yes` option that can skip the prompt and keep current behavior:

```
$ npm publish --yes
```

## Prior Art

Currently `npm publish` will automatically publish the tarball to the registry in case the user does not have OTP enabled.

## Unresolved Questions and Bikeshedding

- Could be tricky to handle publishing of multiple packages in the context of a **workspace** environment.
