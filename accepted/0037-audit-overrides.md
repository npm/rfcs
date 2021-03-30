# npm audit fix can apply overrides

## Summary

Allow npm audit fix to, in addition to updating versions in the dependency
tree, add overrides to a project's package.json to allow for non-semver
compatible security fixes.

## Motivation

Currently security updates are limited to patches provided by the original
authors. This means automatic fixes are impossible if the package is no
longer maintained or patches include other changes that are undesirable.

## Rationale and Alternatives

Being able to apply hotfix patches allows for security updates to be
deployed faster and sometimes, at all. Without this, advice when a package
is unmaintained and has a security vulnerability is to switch to a fork,
but that's time consuming and difficult, particularly when the package is a
transitive dependency. This means that even conscientious teams may take an
extended period of time to apply updates.

This sort of feature exists in some third party tools (eg Synk) but they
have to subvert npm's own integrity protections to make that possible.

For the purposes of transparency, to be clear the original motivation for
this RFC is to provide large enterprises (eg Microsoft) with a facility in
the tool to allow them to provide their employees with internally patched
or rebuilt versions of dependencies. (Current tooling, like Synk, subverts
npm's expectations in ways that are potentially fragile.)

## Scenario

### "Hot fixes"

A critical security flaw is found in a dependency of one of your
dependencies.  The author of the transitive dependency is unavailable to
provide updates. The package is widely used in your organization, usually
as a transitive dependency. The ecosystem will eventually switch to another
module. In the meantime you need some remediation.

You instruct your private registry to provide audit results for the
affected versions of the module that indicate that a custom patched version
is available, something like:

```
{
    "example": [
        {
            "id": 99999,
            "severity": "high",
            "title": "Remote Code Execution",
            "url": "https://npmjs.com/advisories/99999",
            "vulnerable_versions": "<=3.0.1",
            "overrides": {
                "3.0.0": "npm:@company/example-patched@3.0.0"
            }
        }
    ]
}
```

This instructs `npm audit fix` to add an overrides section to your
`package.json` like:

```
"overrides": {
    "example@3.0.0": "npm:@company/example-patched@3.0.0"
}
```

## Implementation

This obviously can't be a thing until overrides lands in npm itself.

Updating the npm audit report library may be required.

Updating the `npm audit fix` subcommand will be necessary.

Out of scope: Updating the npm audit end point to start giving this advice.
It may or may not be desirable for the team that provides security advice
for that end point, but that's ultimately up to them.

## Compatibility

If the server initially implements this solely in the batch advisory
endpoint, then it will be simply ignored by older clients that do not
support overrides.

New clients _must not_ crash or exhibit other undesirable behavior if the
`overrides` key is missing from an advisory result object.

If the server adds an `overrides` section to the legacy advisory endpoint,
then this will be ignored by clients that do not support audit overrides
already.
