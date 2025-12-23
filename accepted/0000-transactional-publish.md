# Transactional Publish

## Summary

When running `npm publish --workspace packages --transactional` in a monorepo, it should run in a transaction so that if publishing any (or multiple) package fails, it automatically rolls back the other published packages.

## Motivation

I have a monorepo workspace with several packages. I bump the version of all packages at the same time and publish them using the following command:

```
npm publish --workspace packages
```

This publishes the packages sequentially, and if the publishing of a package fails, it skips publishing the next packages. For instance, suppose I am trying to bump the version from `v1.0.0` to `v1.0.1`, and the publishing of `package3` fails. This failure causes `package{n>3}` to not get bumped, and it also does not roll back the version bumps of the previous packages.

```
package1 1.0.0 -> 1.0.1
package2 1.0.0 -> 1.0.1
package3 1.0.0 -> FAILED
package4 1.0.0 -> SKIPPED
package5 1.0.0 -> SKIPPED
```

I want all my packages to have the same version at all times. However, the current behavior leads to inconsistencies in package versions.

## Detailed Explanation

I propose adding a new flag `--transactional` to the `npm-publish` command, which would either publish all packages if no errors are encountered, or it will publish none.

## Rationale and Alternatives

- Use `npm publish --dry-run --workspace=packages` to fail on errors. Currently, if we attempt to publish (overwrite) an existing version of the packages, `npm publish --dry-run --workspace=packages` does not return a non-zero exit code. If it starts returning a non-zero exit code, we could use this to determine whether `npm publish --workspace=packages` would succeed as a whole or not.
- I am unsure if we could use `npm unpublish *:1.0.1 --workspace=packages` to unpublish the partially published workspace. Even if we could, since this is a new command in the script, it could also throw some error that would require handling. Additionally, we won't be able to publish the same version again due to [npm's unpublish policy](https://docs.npmjs.com/policies/unpublish).

## Implementation

Currently, I don't have any idea, but if this RFC looks good to the maintainers, I would love to delve into the codebase to figure out the required changes.

## Prior Art

None

## Unresolved Questions and Bikeshedding

- Should we use a different flag name instead of `--transactional`?
- Is there a suitable short name for the flag?
  - `-t`?
