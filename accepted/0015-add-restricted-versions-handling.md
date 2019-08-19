# Throw forbidden error when package is blocked by security policy

## Summary

Provide a means for a registry to indicate that some or all versions of a
package are restricted by a security policy.

Introduce a new 403 error in the case that a forbidden package was
requested and blocked by the security proxy.

If no manifest was found under the versions object of the packument, then
verify if the package is forbidden under the new restrictedVersions object.
If it is, a new error code E403 is thrown along with the admin custom
message. If no policy restrictions are found on the packument then the
behavior will continue as is right now and throw a ETARGET error.

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
   package was requested and blocked by the security proxy on the CLI
2. Add this check on `npm-pick-manifest` where we currently check if a
   version package exists or not. This extra check verifies that a version
   isn't under the `restrictedVersions` object and if it is, it will throw
   the new error code. If no policy restrictions are found on the packument
   then the behavior will continue as is right now and throw a ETARGET
   error.

## Rationale and Alternatives

An alternative is to continue using `npm-header` to display messages in the
CLI. This is not ideal because the messages get displayed on the top of the
CLI logs and get easily lost. Moreover, displaying messages using
`npm-header`  doesn't allow us to properly display a meaningful error
code/message that can guide the user.

## Implementation

Add a new top-level key called `policyRestrictions` that will be an object
with `restrictedVersions` and `message` as keys. This will allow the CLI to
differentiate between a non-existent package and a forbidden one:

```js
versions: {
  // allowed versions
  '1.2.4': { manifest },
  '2.4.6': { manifest }
},
policyRestrictions: {
  restrictedVersions: {
    // versions blocked by policy
    versions: {
      '1.2.3': { manifest },
      '2.3.4': { manifest },
      '...'
    }
  },
  message: "Please email policy@acme.co if you really need to use this package"
}
```

### On packument fetch (registry):

- Check every available version of a package against a policy.
- Populate `restrictedVersions` object with key-value pairs representing
  the version number and the manifest of each version that violates policy.
- Add a custom string set by an admin on the packument under the
  `policyRestrictions` object.

### On packument request (cli):

- If no manifest was found under the versions object, then verify if the
  package is forbidden under the `restrictedVersions` object.
- If  there are no policy restrictions found, then return `ETARGET` (no
  satisfying install target found) error.
- If all versions that would be acceptable install targets are in the
  `restrictedVersions` object, return a  `E403` (forbidden) error.
  - The message set by the admin (ie the `"message"` field in the
    `restrictedVersions` object) will be attached to the E403 error, and
    displayed.

### On tarball request (registry):

If the package and version associated with the tarball have been blocked by
an administrative policy, then the server `SHOULD` respond with a 403
header and an `npm-notice` header that would be in the `restrictedVersions`
object.
