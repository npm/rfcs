# The `registry:` Dependency Specifier

## Summary

Add a dependency specifier which defines a registry base url, package name,
and optionally SemVer range or dist-tag.

## Motivation

Occasionally, users wish to use multiple npm registries.  For example, they
may have some packages hosted on the public npm registry, and others within
a private registry on their company's intranet, or provided by a company
like GitHub, Jfrog, Sonatype, or others.

Currently, it is possible to map a scope to a given registry, and all
packages starting with that scope will be published to and installed from
the defined registry:

```ini
; .npmrc file
@company:registry = https://npm-registry.my-company.com
```

However, this does not address the following use cases:

- Users publish a package to one registry as a "staging" area, and then
  later wish to "upgrade" it to the public npm registry for broader
  distribution.  Some code should fetch from the internal registry (for
  example, for testing and validation prior to promotion), but this is
  challenging unless the private registry also can serve _any_ public npm
  package.

- Users have a set of unscoped package dependencies, some of which come
  from the public registry, and others which have patches applied to them
  (either to the code, or to the packument to add warnings via the
  `deprecated` field for example).  Again, this is only feasible right now
  by making the internal registry capable of proxying the entire set of npm
  packages.

- Alias package specifiers cannot point to any registries other than the
  primary `--registry` configuration.  It would be useful in some scenarios
  to be able to alias a package to a copy found on a different registry, or
  to use aliases to multiple different registries at the same time.

- Migrating packages from one registry to another can be challenging,
  requiring downloading the tarball locally and then re-uploading it.  It
  would be much simpler to script such migrations by being able to do `npm
  publish registry:https://source#pkgname --registry=https://destination/`.

- Using multiple different registries in the best of cases always requires
  using a `.npmrc` file for configuration, which is a challenge in some
  environments, and always adds a layer of indirection.  It would be more
  straightforward at times to specify the registry right in the
  package.json file or command line.

## Detailed Explanation

A new dependency specifier is added:

```
registry:<registry url>#<package name>[@<specifier>]
```

Where:

- `<registry>` is a fully qualified URL to an npm registry, which may not
  contain a `hash` portion,
- `<package name>` is the (scoped or unscoped) name of the package to
  resolve on the registry, and
- `<specifier>` is an optional dist-tag, version, or range.

If `<specifier>` is omitted, then it defaults to the `tag` config (or
`defaultTag` internal optional), which defaults to `latest`.

### Saving

When a package is installed using a registry specifier, it *must* be saved
using a registry specifier.

### Alias Specifiers

Alias specifiers desugar into registry specifiers with the default
configured registry url.

For example, the alias dependency spec `npm:foo@latest` will be equivalent
to `registry:https://registry.npmjs.org#foo@latest`.

### Deduping

Two packages with the same name and version which come from different
registries *must not* be deduplicated against one another unless:

- If either has a defined `integrity` value, then their `integrity` values
  must match.
- If neither has a defined `integrity` value, they will be considered
  deduplicable if their `resolved` values match (for example, `registry-a`
  lists the tarball in `registry-b` as its `dist.tarball` url.)

### Specifying Package Name

The `<package name>` portion is always required, even when it would match
the `name` portion of a complete named specifier.

For example, `foo@registry:https://url.com#foo@1.x` is acceptable.
`foo@registry:https://url.com#1.x` is not valid, and will attempt to alias
`foo` to the `1.x` package.

This avoids the hazards of attempting to infer whether the `hash` portion
of the url is a SemVer, dist-tag, or package name.

### Meta-Dependency Resolution

When a package is installed from a `registry` specifier, its dependencies
should in turn also be fetched from the registry in the specifier, falling
back to the main configured registry if they are not found.

In most cases, a package will be published to a given registry with the
expectation that its dependencies will be found in the same registry, ie by
doing `npm install pkgname --registry=https://internal-registry.com`.

If a package's dependencies are instead fetched from the default configured
registry, then this expectation would be contradicted.

Thus, any package resolved via a `registry` specifier _must_ have its
dependencies in turn resolved against the same registry that it came from.
Note that they _may_ still be deduplicated against packages by the same
name from other registries, but only if the integrity values match
(indicating that they are identical content).

### Examples:

- on the command line:

    ```bash
    # the name may be specified
    npm install forked@registry:https://internal.local#forked
    # but is not required
    npm install registry:https://internal.local#name-optional@2.x
    ```

- in a `package.json` file

    ```json
    {
      "dependencies": {
        "aliased": "registry:https://internal.com#othername@1.x",
        "forked": "registry:https://other-internal.com#forked@2.3.x",
        "patched": "registry:https://security-provider.com#patched@^1.4 || 2"
      }
    }
    ```

## Rationale and Alternatives

Use cases described are challenging to address in any other way.

Initial proposal used a `:` character to delimit the url from the package
specifier, but this is a poor choice, since `:` appears in registry urls.

[RFC PR #217](https://github.com/npm/rfcs/pull/217) addressed some of the
use cases described by defining a registry per _package_ underneath a
scope.  However, analysis and discussion uncovered security concerns that
would make that approach unwise to implement.  Packages with `registry:`
specifiers in their dependencies will fail to install on older npm versions
that do not support the new spec type, so there is no chance of fetching
from the _wrong_ registry.

The main hazard imposed by this proposal is that, if the specified registry
is unreachable, it cannot be installed.  Packages may be published to the
public registry that reference a registry only accessible to certain people
or at certain times.  However, this is no worse than the current situation
of supporting tarball and git URLs, and at least adds the support for
version ranges and dist-tags in those cases, and avoids the hazard of
fetching meta-dependencies from the wrong place.

## Implementation

- Add support for `registry:` specifiers in `npm-package-arg` module.  **This
  is a breaking change**, but adding `registry:` specifier support to
  npm/cli is SemVer-minor.
- Upgrade all modules depending on `npm-package-arg` to ensure that they
  will behave properly with `registry:` specifiers.  (Note: this is most of
  npm.)
- Track the "specifier registry" in Arborist's `buildIdealTree`
  implementation, so that subsequent dependencies are fetched from the
  appropriate registry.

## Prior Art

Alias specifiers already present in npm.

URL and git specifiers.

## Future Work

A subsequent RFC may add support for mapping registry names to full URLs,
either in `package.json` or in npm configuration, using a shorter syntax
that desugars to `registry:` specifiers in much the same way as the `npm:`
alias specifier.  Registry short names are out of scope for this proposal.
