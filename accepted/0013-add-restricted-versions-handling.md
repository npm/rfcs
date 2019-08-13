# Throw forbidden error when package is blocked by security policy

## Summary
Introduce a new 403 error in the case that a forbidden package was requested and blocked by the security proxy. If no manifest was found under the versions object of the packument, then verify if the package is forbidden under the new restrictedVersions object. If it is, a new error code E403 is thrown along with the npme admin custom message. If no policy restrictions are found on the packument then the behavior will continue as is right now and throw a ETARGET error.

## Motivation
The new package filtering feature in npme needs the CLI to provide a better messaging system when a package has failed to install due to policy restrictions. However, this isn't currently the case and the CLI should be improved to provide a better DX and give more informative messages to its users.

## Detailed Explanation
1. Introduce a new E403 error code in the case that a forbidden package was requested and blocked by the security proxy on the CLI
2. Add this check on `npm-pick-manifest` where we currently check if a version package exists or not. This extra check verifies that a version isn't under the `restrictedVersions` object and if it is, it will throw the new error code. If no policy restrictions are found on the packument then the behavior will continue as is right now and throw a ETARGET error.

## Rationale and Alternatives
An alternative is to continue using `npm-header` to display messages in the CLI. This is not ideal since the messages get displayed on the top of the CLI logs and get easily lost. Moreover, displaying messages using `npm-header`  doesn't allow us to properly display a meaningful error code/message that can guide the user.

## Implementation
Add a new top-level key called `policyRestrictions` that will be an object with `restrictedVersions` and `message` as keys. This will allow the CLI to differentiate between a non-existent package and a forbidden one:

```json
policyRestrictions: {
  restrictedVersions: {
     versions: {
      ‘version1’: { manifest },
      ‘version2’: { manifest }
     }
  },
  message: ""
}
```

On packument fetch: 
Check every available version of a package in policy-proxy. Populate `restrictedVersions` object with key value pairs representing the version number and the manifest of each version that violates policy. Add a custom string set by an npme admin on the packument under the policyRestrictions object.

On packument request:
If no manifest was found under the versions object, then verify if the package is forbidden under the `restrictedVersions` object. If  there are no policy restrictions found, then the CLI will return a `ETARGET` (not found) error.
If all versions that match the target request are in the `restrictedVersions` object, the CLI will return a  `E403` (forbidden) error.
The CLI will also display the default or custom message set by the npme admin for all available versions that have been blocked by the security policy. 

In the case of tarballs the functionality remains unchanged (display the custom message in a notice header when a version of the package restricted by the policy is requested).
