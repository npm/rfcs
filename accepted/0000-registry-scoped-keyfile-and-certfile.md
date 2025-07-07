# Registry-scoped keyfile / certfile credential options

## Summary

NPM should support registry-scoped config options for specifying the paths to the client certificate and key used in registry fetches.

These options should also be acceptable as authentication credentials by `npm publish` and friends.

## Motivation

Currently you can set a `cert` and `key` config options at the top level, which means they can be used in connections against any registry. Ideally a client certificate would only be presented to the registry that actually needs it, and you should be able to use different ones depending on the registry.

Additionally, the `cert` and `key` options are the actual contents of the cert/key, rather than paths to them. This means you either need to put them in `.npmrc` — possibly keeping it in sync with the actual keys/certs — or you have to specify them as env vars. Both options potentially weaken security (e.g. `.npmrc` could be accidentally checked in or read by other users, `npm_config_key` could be extracted from `/proc/<pid>/environ`, etc.).

Lastly, custom registries may wish to authenticate solely via mutual TLS (i.e. no username/pass/token, just a client cert+key). [This check](https://github.com/npm/cli/blob/e992b4a21ecdd96aa33c59682c0ac0cc8a30d776/lib/commands/publish.js#L108) currently prevents that, so additional credentials are [always needed](https://github.com/npm/cli/issues/4765) to avoid `ENEEDAUTH`.

### Linked Issues

- [[FEATURE] registry-scoped certfile and keyfile options](https://github.com/npm/npm-registry-fetch)
- [[BUG] ENEEDAUTH when authenticating against a registry via mTLS](https://github.com/npm/cli/issues/4765)
- [[BUG] npm_config\_... variables don't work for specifying a scoped registry password/auth/authToken](https://github.com/npm/config/issues/64)

## Detailed Explanation

NPM should support two new registry-scoped config options: `certfile` and `keyfile`, e.g.

```
//my.registry.example/npm/:certfile=~/.secret/stuff.crt
//my.registry.example/npm/:keyfile=~/.secret/stuff.key
```

These options should also be acceptable as authentication credentials from the standpoint of `npm publish` so that you don't get `ENEEDAUTH` if other credentials are not set.

The contents of these files should then be used as the `key` and `cert` options in any fetches against that registry.

## Rationale and Alternatives

### Use existing `cert` and `key` options:

There are some workarounds, but they all have pain points and security concerns:

1. Specify `npm_config_cert` and `npm_config_key` env vars
   - 👎 key may be read by other local users (from `/proc/<pid>/environ`)
   - 👎 values may need to be kept in sync with source of truth for key/cert
   - 👎 need to set these dynamically if you need to push to multiple registries
2. Specify `key` and `cert` in project `.npmrc`
   - 👎 credentials may be inadvertently checked in
   - 👎 file may be read by other local users (depending on permissions)
   - 👎 file may need to be kept in sync with source of truth for key/cert
   - 👎 need to change this file if you need to push to multiple registries
3. Specify `key` and `cert` in `$HOME/.npmrc`
   - 👎 file may be read by other local users (depending on permissions)
   - 👎 file may need to be kept in sync with source of truth for key/cert
   - 👎 need to change this file if you need to push to multiple registries
4. Specify `key` and `cert` in a custom `.npmrc` specified via `npm_config_userconfig` / `--userconfig`
   - 👎 file may be read by other users (depending on permissions)
   - 👎 file may need to be kept in sync with source of truth for key/cert
   - 👎 need to set `userconfig` dynamically if you need to push to multiple registries

### Work around current `noAuth` / `ENEEDAUTH` checks:

If your registry authenticates solely via `mTLS`, you may be able to work around it, but it gets complicated:

- You can use something besides `npm publish` or invoke `libnpmpublish` yourself to get around the `ENEEDAUTH` check.
- You can set some explicit/bogus credentials, but you might need to do some custom work to make your registry accept/ignore them.
- If you are doing dual publishing, there are some gotchas:
  - You can put scoped credentials in an `.npmrc` file, but that has similar issues as `cert`/`key` workarounds above.
  - You can set top-level env vars like `npm_config_username` / `npm_config__password`, but that has similar issues as `npm_config_cert` / `npm_config_key` above.
  - You can't set a scoped registry password/auth/authToken via env vars due to [this bug](https://github.com/npm/config/issues/64).

## Implementation

1. Resolve scoped `certfile`/`keyfile` options and use them, i.e.
   1. **`npm-registry-fetch`**: Update [`getAuth` + `Auth`](https://github.com/npm/npm-registry-fetch/blob/main/lib/auth.js) to resolve any scoped `certfile` and `keyfile` options into corresponding `cert` and `key` properties, and update [`regFetch`](https://github.com/npm/npm-registry-fetch/blob/main/lib/index.js#L26) to use them in the `fetch` call.
2. Accept `certfile`/`keyfile` as valid creds, i.e.
   1. **`@npmcli/config`**: Update [`getCredentialsByURI`](https://github.com/npm/config/blob/1244177d8a68f68f2be46d5b9c21957da7dedfbb/lib/index.js#L759) to process scoped `certfile`/`keyfile` options and then set them in the returned credentials.
   2. **`npm`**: Update [this `noCreds` check](https://github.com/npm/cli/blob/e992b4a21ecdd96aa33c59682c0ac0cc8a30d776/lib/commands/publish.js#L108) to accept `certfile`/`keyfile` as creds.
   3. **`npm-registry-fetch`**: Future work to [implement the `ENEEDAUTH` check](https://github.com/npm/npm-registry-fetch/issues/38) here should also take this into account.

## Unresolved Questions and Bikeshedding

- Should the scoped `keyfile` config option instead be named `_keyfile`? Technically it's not sensitive, though it points at something sensitive. If we prefix it with an underscore it would be affected by [this bug](https://github.com/npm/config/issues/64).
- Should registry-scoped `certfile`/`keyfile` options override more general `cert`/`key` options in `npm-registry-fetch`? I think the answer should be yes, but perhaps there are scenarios where you wouldn't want that?
- Should we go ahead and [implement the npm-registry-fetch `ENEEDAUTH` check](https://github.com/npm/npm-registry-fetch/issues/38) as part of this change? That should let us skip steps 2.1. and 2.2 altogether, and we could drop the current `noCreds` check from `npm`.
