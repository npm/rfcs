# Transactional Publish

## Summary

When running `npm publish --workspace packages --transactional` in a monorepo, it should run in a transaction so that if publishing of any (or multiple) package fails, it automatically rollback the other published packages.

## Motivation

I have a monorepo workspace with several packages. I bump the version of all packages at the same time and publish them using the following command:

```
npm publish --workspace packages
```

This publishes the packages in a serial manner and if publishing of a package fails, it skips publishing the next packages. For instance, consider I am trying to bump the version from `v1.0.0` to `v1.0.1` and publishing of `package3` fails. It causes `package{n>3}` to not get bumped and also it doesn't rollback the bumps of previous packages.

```
package1 1.0.0 -> 1.0.1
package2 1.0.0 -> 1.0.1
package3 1.0.0 -> FAILED
package4 1.0.0 -> SKIPPED
package5 1.0.0 -> SKIPPED
```

I want all my packages to be on same version at all times but because of the above behaviour, it causes inconsistencies in package versions.

## Detailed Explanation

Proposing to add a new flag `--transactional` to the `npm-publish` command which would either publish all packages if no errors were encountered or it will publish none.

## Rationale and Alternatives

- `npm publish --dry-run --workspace=packages` to fail on errors. In the current, if we try to publish (overwrite) an existing version of the packages, `npm publish --dry-run --workspace=packages` doesn't return a non-zero exit code. If it starts returning a non-zero exit code, we could use this to determine whether `npm publish --workspace=packages` would succeed as a whole or not.
- I am not sure if we could use `npm unpublish *:1.0.1 --workspace=packages` to unpublish the partially published workspace, but even if we could, since this is a new command in the script, it could also throw some error which would need some handling.

## Implementation

Currently, I don't have any idea, but if this RFC looks good to the maintainers, I would love to dig into the codebase to figure out the required changes.

## Prior Art

None

## Unresolved Questions and Bikeshedding

- Some other flag name instead of `--transactional`?
- Short name for the flag?
  - `-t`?
