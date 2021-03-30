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
deployed faster and sometimes, at all. Without this, advice when a
package is unmaintained and has a security vulnerability is to switch to a
fork, but that's time consuming and difficult, particularly when the package
is a transitive dependency. This means that even conscientious teams may take
an extended period of time to apply updates.

This sort of feature exists in some third party tools (eg Synk) but they
have to subvert npm's own integrity protections to make that possible.

For the purposes of transparency, to be clear the original motivation for this RFC
is to provide large enterprises (eg Microsoft) with a facility in the tool
to allow them to provide their employees with internally patched or rebuilt
versions of dependencies. (Current tooling, like Synk, subverts npm's
expectations in ways that are potentially fragile.)


## Implementation

This obviously can't be a thing until overrides lands in npm itself.

Updating the npm audit report library may be required.

Updating the `npm audit fix` subcommand will be necessary.

Out of scope: Updating the npm audit end point to start giving this advice.
Obviously that's desirable but that's ultimately a decision for the team
supporting that end point.

## Unresolved Questions and Bikeshedding

Immediate plans: I (@iarna) intends to implement a proof-of-concept as a
stand alone tool using yarn and pnpm overrides.


1. Details of the changes to audit API endpoint result need to be nailed
down. There are some requirements and nice-to-haves:

  1. Older clients must not fail when receiving the new advice.

  2. Older clients should if possible report the new advice when they can't
  apply it.

  3. Long term compatibility should not be at issue as all three major npm
  clients use the same

2. Would it be desirable to apply ALL audit fix results as overrides?

