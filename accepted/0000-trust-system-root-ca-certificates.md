# Trust system root CA certificates

## Summary

Most operating systems have a trust store to store root CA certificates (e.g. managed by OpenSSL in Linux).
npm should automatically trust the root CA certificates from system trust store.

## Motivation

Lots of organizations use the system trust store to install custom root CA certificates, for trusting internal repositories.
With npm you need to use the  `cafile` option to be able to use them.

This is not very convenient:
* you need to add this configuration to be able to use npm properly
* you add a strong dependency to the name of your certificate file
* you need to duplicate the entire trust store if you need to trust anything else than your internal sources

This can be blocker for some organizations.

See former discussions on the subject:
* https://github.com/npm/feedback/discussions/497
* https://npm.community/t/trust-the-system-root-ca-certificates/6429

## Detailed Explanation

Example on Fedora:

Our system administrators install an internal CA certificate in `/usr/share/pki/ca-trust-source/anchors/ca-my-company-2019.pem`.
We need it to access internal services, such as our private Artifactory instance.

If we want npm to use the internal Artifactory registries (proxy of npmjs + internal registry) defined in npm configuration:
```
registry=https://artifactory.my-company.net/api/npm/npm-remote-repos/
@my-company:registry=https://artifactory.my-company.net/api/npm/npm-release-local/
```
then we need to add the `cafile` configuration:
```
cafile=/usr/share/pki/ca-trust-source/anchors/ca-my-company-2019.pem
```

It is not very convenient to require this configuration, and in addition:
* if the certificate is renewed and the name changes, the npm configuration has to be changed
* with the `cafile` option the default trust store is overriden - only the intenal sources will be trusted unless you duplicate the entire trust store

A root CA certificates in the standard path `/usr/share/pki/ca-trust-source/anchors/` is taken into account automatically by the system (see https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/8/html/security_hardening/using-shared-system-certificates_security-hardening).

I would expect npm to trust this root CA certificates automatically as well, without additional configuration.

## Rationale and Alternatives

An improvement would be to _add_ the `cafile` to the npm trust store instead of overriding the trust store completely.
This would avoid the need to duplicate the entire turst store if you need to trust both internal sources and external sources.

But this would be completely satisfying as you would still have to configure the additional `cafile` with a strong dependency to the path on the system.

## Implementation

Don't know the technical details at submission time and how npm manages trust store.
It should rely on shared system certificates storage.

## Prior Art

With Maven or Sbt no additional configuration is required to be able to access internal repositories, as Java uses the shared system certificates storage (at least on RedHat-based systems).

## Unresolved Questions and Bikeshedding

Evaluate how this works / should work on other systems, e.g. MacOS, Windows, ...?
