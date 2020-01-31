# Publish prompt

## Summary

Publishing a package should prompt a confirmation prompt, allowing users to validate their package info before uploading their package tarball.

## Motivation

Breaking the prompt into a two-step operation allows for a validation of contents prior to uploading the package but it also enable new possibilities such as printing warnings promotting 2FA adoption, etc.

## Detailed Explanation and Rationale

`npm publish` should ask for a confirmation prompt prior to uploading the package tarball.

Currently "publish" has a very nice behavior for users that have 2FA enabled, one in which it stops the publish process in order to ask for the OTP code, allowing for a review of the file contents prior to uploading the tarball file.

It would be very nice to expand that "review" 

## Alternatives

Not change it, just keep the current behavior?

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

TBD
