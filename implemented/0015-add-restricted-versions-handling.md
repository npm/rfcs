# Throw forbidden error when package is blocked by security policy

## Summary

Provide a means for a registry to indicate that some or all versions of a
package are restricted by a security policy.

Introduce a new 403 error in the case that a forbidden package was
requested and blocked by a server-side policy.

If no manifest was found under the versions object of the packument, then
verify if the package is forbidden under the new `policyRestrictions`
object.  If it is, a new error code E403 is thrown along with the admin
custom message. If no policy restrictions are found on the packument then
the behavior will continue as is right now and throw a ETARGET error.

## Motivation

An npm registry which is configured to block packages based on an
administrative policy has limited options for communicating the nature of
the block to the CLI requesting a package.

If tarballs are blocked, but their associated version manifests are not
removed from the packument, then the CLI is led to believe that certain
versions will be acceptable, when in fact they will lead to an error.

If blocked version manifests are removed from the packument, as well as
blocking their tarball downloads, then the options to remediate a blocked
package are limited.  In that case, there is no way for a user to know
whether a package version was unpublished, removed due to malicious or
illegal content, or blocked by their organization's administrative policy.

This sort of filtering feature needs the CLI to provide a better messaging
system when a package has failed to install due to policy restrictions.
However, this isn't currently the case and the CLI should be improved to
provide a better DX and give more informative messages to its users.

## Detailed Explanation

1. Introduce a new E403 (forbidden) error code in the case that a forbidden
   package was requested and blocked by a policy on the server.
2. Add this check on `npm-pick-manifest` where we currently check if a
   version package exists or not. This extra check verifies that a version
   isn't under the `policyRestrictions.versions` object and if it is, it
   will throw the new error code. If no policy restrictions are found on
   the packument then the behavior will continue as is right now and throw
   a ETARGET error.

## Rationale and Alternatives

An alternative is to continue using `npm-header` to display messages in the
CLI. This is not ideal because the messages get displayed on the top of the
CLI logs and get easily lost. Moreover, displaying messages using
`npm-header`  doesn't allow us to properly display a meaningful error
code/message that can guide the user.

## Implementation

Add a new top-level key called `policyRestrictions` that will be an object
with `versions` and `message` as keys. This will allow the CLI to
differentiate between a non-existent package and a forbidden one:

```js
versions: {
  // allowed versions
  '1.2.4': { manifest },
  '2.4.6': { manifest }
},
policyRestrictions: {
  // versions blocked by policy
  versions: {
    '1.2.3': { ...manifest },
    '2.3.4': {
      ...manifest,
      "message": "version 2.3.4 is really bad, don't use it ever",
      "advisories": [ ...advisoriesForThisVersion ]
    },
    '...'
  },
  message: "Please email policy@acme.co if you really need to use this",
  advisories: [
    // OPTIONAL
    // urls to advisories relevant to this package
    // For example, security reports, corporate OSS
    // usage policies, or other guidelines.
    "https://policy.internal.acme.co/security-advisories/123"
  ]
}
```

The `policyRestrictions` section `MAY` include urls to security advisories,
policy documentation, or other information to help guide the user
encountering the restriction.

Manifests in the `policyRestrictions.versions` section `MAY` include
version-specific messages.

### On packument fetch (registry):

- Check every available version of a package against a policy.
- Populate `policyRestrictions.versions` object with key-value pairs
  representing the version number and the manifest of each version that
  violates policy.
    - Manifests in the `policyRestrictions.versions` set `MAY` include
      custom messages or advisory URLs specific to that version.
- Add a custom string set by an admin on the packument under the
  `policyRestrictions` object.
- `policyRestrictions` object `MAY` include an `advisories` array of URL
  strings, which provide information for the package being restricted.

### On packument request (cli):

- If no manifest was found under the versions object, then verify if the
  package is forbidden under the `policyRestrictions.versions` object.
- If  there are no policy restrictions found, then return `ETARGET` (no
  satisfying install target found) error.
- If all versions that would be acceptable install targets are in the
  `policyRestrictions.versions` object, return a  `E403` (forbidden) error.
  - The message set by the admin (ie the `"message"` field in the either
    the manifest found in the `policyRestrictions.versions[version]`
    manifest, or the top-level message in the `policyRestrictions` object)
    will be attached to the E403 error, and displayed.

### On tarball request (registry):

If the package and version associated with the tarball have been blocked by
an administrative policy, then the server `SHOULD` respond with a 403
header and an `npm-notice` header matching the `message` in either the
`policyRestrictions.versions[version]` manifest, or in the top-level
`policyRestrictions` object.
