# Improve npm signature verification

## Summary

Add a new top-level CLI command to verify registry signatures and update
existing signatures from PGP to ESCDA.

## Motivation

Signatures are only useful if people verify them. Signature verification is
currently a [manual and complex process](https://docs.npmjs.com/verifying-the-pgp-signature-for-a-package-from-the-npm-public-registry),
involving the Keybase CLI to fetch the npm public key.

Our long-term goal for supply chain security is that all software is signed and
verified in a transparent and user-friendly way.

Signing and verifying published packages protects users against a malicious
mirror or proxy intercepting and tamptering with the tarball (MITM
attack).

## Detailed Explanation

npm [already signs each published version](https://blog.npmjs.org/post/172999548390/new-pgp-machinery.html) using a private PGP key, with the [public key hosted on Keybase](https://keybase.io/npmregistry).

This RFC proposes improving existing registry signatures:
- 1. Update the signing key to produce ECDSA signatures which are smaller and
     can be verified with node's `crypto` library
- 2. Make signature verification easy using a new CLI command, dropping the
     requirement for 3rd party tools (Keybase CLI)

To make signature verification easy, we'll introduce a new CLI command
`audit signatures` that verifies the npm signature in a packages packument,
using npm's public key, fetched from registry.npmjs.org. It works on the current
install (`node_modules`), and checks all direct and transitive dependencies.

The aim is for this command to plug into users build workflows after `npm ci/npm
install` and block builds with invalid registry signatures.

The proposed command is standalone but the behaviour could be folded into `npm
install` or `audit` in the future, once we're confident validation is performant
and provides a good user experience.

### Threat model
The threat model assumes the following:

- Attackers cannot compromise npm's signing key stored online
- Attackers can respond to client requests (MITM or proxy/mirror compromise)

An attacker is considered successful if it can cause a client to install
a package tarball that is not the file that was uploaded to the npm registry.

This threat model has a very narrow scope and we're planning follow up work to
secure more parts of the download/uploade process.

### Attack vector

An attacker gains access to a npm proxy or mirror that's serving packages
published to the official npm registry, either by MITM'ing the connection or
compromising the server.

We can mitigate against tarballs that been tampered with by verifying the
signatures against npm's public key.

This won't protect you against the public registry being MITM'd as we'd loose
guarantees that we're getting the right public keys when we fetch them from
`https://registry.npmjs.org/-/npm/v1/keys`.

There's also a case where the mirror or proxy serving signed packages modifies
the packgument that's being serverd to the npm CLI and omits signatures. The
best we can do for now in this case is warn users that some packages don't have
signatres. This might cause a lot of noise that's ignored.

We're planning follow up work to address the issue of a packument being
modified, possibly looking at [signing the packument](https://github.com/npm/rfcs/pull/76).

### Detailed CLI examples

For the next few examples, assume an install such as:

```sh
$ npm ls
project@1.0.0 $HOME/work/project
├── foo@0.4.0
├─┬ lorem@0.4.0
│ └── ipsum@2.0.0 invalid registry signatures
├─┬ abbrev@3.0.9
│ └── bar@2.88.0 invalid registry signatures
└── once@1.4.0 invalid registry signatures
```

#### Verifies all dependencies in the current install, e.g:

```
$ npm audit signatures
project@1.0.0 $HOME/work/project

1 package has a missing registry signature (direct):
├── MISSING REGISTRY SIGNATURE foo@0.4.0

NOTE: Signatures are missing for all packages hosted outside registry.npmjs.org

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!!          WARNING: SOME PACKAGES HAVE INVALID REGISTRY SIGNATURES           !!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

3 packages have invalid registry signatures (1 direct, 2 transitive):
├── INVALID REGISTRY SIGNATURE once@1.4.0
├─┬ lorem@0.4.0
│ ├── INVALID REGISTRY SIGNATURE ipsum@2.0.0
├─┬ abbrev@3.0.9
│ ├── INVALID REGISTRY SIGNATURE bar@2.88.0

Someone might have tampered with the package since it was published
on npmjs.org (monster-in-the-middle attack)!

Please report this issue: https://github.com/npm/cli/issues/new/choose
```

#### Verify a given package from the current install when using package name only, e.g:

```
$ npm audit signatures once

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!!          WARNING: SOME PACKAGES HAVE INVALID REGISTRY SIGNATURES           !!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

1 package has a invalid signature (direct):
├── INVALID REGISTRY SIGNATURE once@1.4.0

Someone might have tampered with the package since it was published
on npmjs.org (monster-in-the-middle attack)!

Please report this issue: https://github.com/npm/cli/issues/new/choose
```

#### Support multiple positional arguments:

```
$ npm audit signatures once ipsum
project@1.0.0 $HOME/work/project

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!!          WARNING: SOME PACKAGES HAVE INVALID REGISTRY SIGNATURES           !!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

2 packages have invalid registry signatures (1 direct, 1 transitive):
├── INVALID REGISTRY SIGNATURE once@1.4.0
├─┬ lorem@0.4.0
│ ├── INVALID REGISTRY SIGNATURE ipsum@2.0.0

Someone might have tampered with the package since it was published
on npmjs.org (monster-in-the-middle attack)!

Please report this issue: https://github.com/npm/cli/issues/new/choose
```

#### Support qualified spec as positional argument for the current install e.g:

```
$ npm audit signatures once@1.4.0
project@1.0.0 $HOME/work/project

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!!          WARNING: SOME PACKAGES HAVE INVALID REGISTRY SIGNATURES           !!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

1 package has an invalid signature:
├── INVALID REGISTRY SIGNATURE once@1.4.0

Someone might have tampered with the package since it was published
on npmjs.org (monster-in-the-middle attack)!

Please report this issue: https://github.com/npm/cli/issues/new/choose
```

#### Support other common arborist options, e.g:

```
$ npm audit signatures --only=prod
project@1.0.0 $HOME/work/project

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!!          WARNING: SOME PACKAGES HAVE INVALID REGISTRY SIGNATURES           !!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

1 package has an invalid signature (direct):
├── INVALID REGISTRY SIGNATURE once@1.4.0

Someone might have tampered with the package since it was published
on npmjs.org (man-in-the-middle attack)!

Please report this issue: https://github.com/npm/cli/issues/new/choose
```

### Moving signatures from PGP to ECDSA

We plan to rotate the signing key as part of this effort. The CLI command will
support a new (ECDSA) signature key, existing PGP signatures and verification
workflows will contine work during a 6 month deprecation period.

The new ECDSA signatures are smaller in size (64 bytes), compared to the
existing PGP signature (893 bytes). We can stop writing `npm-signature`s on new
package releases once we the Keybase key has expired.

**Rollout plan:**

- 1. **Publish new public key on npmjs.com**: The npm cli will use this endpoint
  to fetch the public key and cache this locally.
- 2. **Add a new `signatures` field to the version packument**: We introduce a
  new `signatures` array in the version packument. Each signature references a
  `keyid` (sha256 hash of the public key).
- 3. **Double sign during the deprecation period using both keys**: We will
  double-sign creating both a PGP signature and an ECDSA signature over the
  `package@version:integrity` string. The PGP signature will go in the existing
  `npm-signature` field and the ECDSA signature will go in the new `signatures`
  array in the version packument.
- 4. **Generate signatures on existing package releases using the new key**: We
  will backfill signatures for all existing releases/versions, generating a
  signature using the new key and adding this to the version packuments
  `signatures` array.
- 5.  **Introduce new npm cli command: `audit signatures`**:  The command
  will will only support new (ECDSA) signature and fetch public keys from registry.npmjs.org.
- 6. **Update the [Keybase PGP key](https://keybase.io/npmregistry) expiry**: We will update the expiry to be 6 months from the launch of this CLI command and publish of announcement blog post. We want to give folks with their own tooling as much notice as possible while deprecating the use of the existing PGP key.
- 7. **Stop generating PGP signatures once the key expires**: We will no longer
  populate the packument field `dist.npm-signature` in new releases.

#### Breaking changes

Existing workflows validating PGP signatures will stop working once the public Keybase PGP expires and we stop writing this signature to packages `npm-signature` field.

### Adding ECDSA signatures to packuments

We will introduce a new `signatures` field in the version packument, e.g.
[registry.npmjs.org/light-cycle/1.4.3](https://registry.npmjs.org/light-cycle/1.4.3):

```
{
  "name":"light-cycle",
  "description":"a consistent hash ring for your blue-glowing shards of PURE ENERGY",
  "version":"1.4.3",
  ...
  "dist":{
    "integrity":"sha512-sFcuivsDZ99fY0TbvuRC6CDXB8r/ylafjJAMnbSF0y4EMM1/1DtQo40G2WKz1rBbyiz4SLAc3Wa6yZyC4XSGOQ==",
    "shasum":"c305f0113d81d880f846d84f80c7f3237f197bab",
    "tarball":"https://registry.npmjs.org/light-cycle/-/light-cycle-1.4.3.tgz",
    "fileCount":11,
    "unpackedSize":25612,
    "signatures": [{
      "keyid": "SHA256:{{BASE64_SHA256_PUBLIC_KEY}}",
      "sig": "a312b9c3cb4a1b693e8ebac5ee1ca9cc01f2661c14391917dcb111517f72370809..."
    }],
    "npm-signature":"-----BEGIN PGP SIGNATURE-----\r\nVersion: OpenPGP.js v3.0.4\r\nComment: https://openpgpjs.org\r\n\r\nwsFcBAEBCAAQBQJa0SiFCRA9TVsSAnZWagAAf40QAI6m9uc8N8iQ4xmVJI+y\naPICZ2wwSGY/LvjpSfMHcjiT9h92lijXQcF0bAdtUA6UPjI4e9GuzoBME52Q\nkfPPRQ06icX0Om8XJxNIeLgJ1PK9Odv5fmb4sOZZxk/4t1hhf15KdfJ7vQYr\nMbb6gI/QkcOgi8NHHJSAQDBxws679zj8f7j2qYr6RzaJ8v3kGlEDnjD4LxwU\nXkK9TALJmwrgocqQ05XO+k/C6sVAuM7dg3fuRJUQab6liyyxtfnIbNaam+2V\neDaf6IurFnkcwjfmtin9tq9pLE/Ml+MI38wqAmyNpWHCGPzJKZpd7nSPQQSR\n1M2n/yLPcTh7YBKgiDaGTdtjPgtq+gYiWzqXbQFw3ICLCDhwcemHMizuuhAu\nig8dsCleFnQW21eYCbP2s6H/Kp77NnYV2vFOLS2PobUapP9jVDYVOkfdGUKS\nYbhU3lhg7Dgx6WtHmvfmDyWClSljJir99rnlp8bxYzipVCEai+2SR371PwK5\nkkWNdd2dh2oIBnpZu6m/ksK+5Oz9Mq0cdpq8R2BSlUNAiRHjjDECCrHAxRs+\n276vyovxQlGhnuTKmbu4ivUD3i7TUp0RVmZHIjxt2+xFB99u1861MN20UFp6\nr6WmvstyORBFMHHlccT3a5y6mwQtMMId7ysc2hbn+FHURBClGmVv+frb72sk\n+GGk\r\n=AAks\r\n-----END PGP SIGNATURE-----\r\n"
   }
```

The `keyid` will map to a public key hosted on `https://registry.npmjs.org/-/npm/v1/keys`.

## Rationale and Alternatives

This proposal lays out an incremental improvement to the existing registry
signatures and verification to improve the user experience.

### Alternatives

- Keep the current manual validation flow, instructing users to fetch the public
  key and package signature(s), with instructions on fetching the updated
  signature key
  - Pros
    - Little to no effort other than documentating when we rotate signing keys
  - Cons
    - Adoption and awareness remains low as it's not straight forward to do
      verification, especially if you want to verify everything installed in
      `node_modules`
    - Rotating signing keys becomes cumbersome and error prone: Requiring users
    to try several signing keys
- Offload verificaion to a third-party package
  - Pros
    - This might make it easier to bundle fully featured validation tools, e.g.
    cosign that uses Go's `x/crypto` library, which arguably is a lot more
    secure than openssl
  - Cons
    - Rotating signing keys becomes cumbersome and slow. Users might have
      updated the npm CLI but not the validation package, providing outdated
      results.
- Support user geneerated or build signatures
  - Pros
    - A more complete fix, allowing users to sign their own releases and verify
      it's not been tampered with
  - Cons
    - This is a significant piece of work. It's [currently being proposed for
      rubygems](https://github.com/rubygems/rfcs/pull/37)
  - We think this piece is orthogonal and we're active pursuing a plan to
    support build signatures.
- Adopt The Update Framework ([TUF](https://theupdateframework.io/)) to secure
  registry metadata and downloads
  - Pros
    - This framework can help secure against and recover from registry
      compromises and has been [adapted by
      PyPI](https://www.python.org/dev/peps/pep-480/)
  - Cons
    - This is a significant piece of work. PyPI have spent years(?) implementing
      it with help from core TUF maintainers. Although I gatheer this includes a
      lot of investment work to support large package repositories.
  - We think this piece is orthogonal and we're investigating using
    [TUF](https://theupdateframework.io/) in the future.

## Implementation

### Signature verification

We can verify new ECDSA signatures using node's `crypto` library:

```js
const package = 'light-cycle'
const version = '1.4.3'
const publicKey = await fetch(`https://npmjs.org/registry-signature-keys.asc`).then(res => res.text())
const packument = await fetch(`https://registry.npmjs.org/${package}/${version}`).then(res => res.json())
const signature = packument.dist['npm-signature']
const integrity = packument.dist.integrity
const message = `${package}@${version}:${integrity}`

const verifier = crypto.createVerify("SHA256");
verifier.write(message);
verifier.end();
const result = verifier.verify(publicKey, packument.dist['npm-signature'], "base64");
```

**Handle expired/rotated keys**:

If the public key has an `expires` set, check this against the version created
at time, ensuring expired keys are only valid for packages released before this
time.

**Protect against missing registry signatures**:

A potential attack scenario would be a malicious mirror/third-party registry
omitting `signatures` from the packument and tricking validation into thinking
no signature verification is needed.

Verify the signature is present for packages fetched from registry.npmjs.org.
This could be enforced for mirrors if the tarball is hosted on
registry.npmjs.org.

The npm CLI could warn users if they are validating packages that don't have
signatures in the packument, and the registry/mirror doesn't have keys available at:
`https://registry.host/-/npm/v1/keys`.

#### Fetching the public key

Add a new json endpoint to registry.npmjs.org that returns public signature
keys:

```
GET https://registry.npmjs.org/-/npm/v1/keys
```

```json
{
  "keys": [{
    "expires": "2023-12-17T23:57:40-05:00",
    "keyid": "SHA256:{{SHA256_PUBLIC_KEY}}",
    "keytype": "ecdsa-sha2-nistp256",
    "scheme": "ecdsa-sha2-nistp256",
    "key": "{{B64_PUBLIC_KEY}}"
  }]
}
```

**Response**:

- `expires`: null or complete ISO 8601 datetime
- `keydid`: sha256 of public key
- `keytype`: only `ecdsa-sha2-nistp256` is currently supported
- `scheme`: only `ecdsa-sha2-nistp256` is currently supported
- `key`: base64 encoded public key

Adding this endpoint to the registry host allows the CLI to discover these keys
for third-party registries.

The API endpoint should return a HTTP `Cache-Control` header and instruct
clients to cache the response for up to 1 week before attempting to refetch:

```
Cache-Control: max-age=604800
```

Pairing the `scheme` with the public key helps prevent [[algorithm
attacks](https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/).

### Key rotation

The signing key can be rotated in the future by following these steps:

- Start double sigining all new packages with both keys during the deprecation
window, meaning all versions created within the window have two signatures in
the `signatures` array
- Update the expiry on the old public key in
  `registry.npmjs.org/-/npm/v1/keys` to 1-3 months from now
- Stop signing new releases using the old key but keep the pubic key in the CLI
 and at the `registry.npmjs.org/-/npm/v1/keys` URL

The `audit signatures` should check that the version created time is
within the `expires` time set on the public key.

### Supporting third-party npm registries signing packages

Our long-term goal for all software to be signed and verified in a transparent
way.

Third-party npm registries (e.g. GitHub Packages, Artifactory, Verdaccio etc)
should be able to start signing published packages and allow the CLI to verify
these signatures with minimal user intervention.

#### Setting up package signing on a third-party npm registry:

- Set up a secure signing key, preferrably using HSM-backed key in a cloud KMS
(e.g. AWS KMS, Azure Vault, GCP KMS etc)
- Add a new API endpoint to the registry host:
  `https://registry.host/-/npm/v1/keys`
- Configure the endpoint to return the public key and key metadata (see payload
  example under "Fetching the public key")
- Start signing package versions on publish, adding the signature (`sig`) and
  `keyid` to the version packument, nested in the `dist.signatures` array (see
  example under "Packument example with new `signatures` field")

#### Verifying third-party registry signatures using the npm CLI

There's currently no reliable (or is there?) way to differentiate a mirror/proxy
from a originating third-party npm registry that hosts packages not on
npmjs.org.

Users will be asked to manually approve unknown keys when verifying signatures
that reference untrusted `keyid`s. This is similar to how ssh works when
accessing a new server. Trusting new keys will add the keys to the `.npmrc`
file, which should be committed to source.

**Attack scenario: malicious npm mirror resigns packages and tries to trick users
into trusting it's keys**:

If a user has configured to use a proxy/mirror for npm packages, and set the
global registry, for example:

`.npmrc`
```
registry=https://fast-npm-mirror.tld
```

This registry could be re-signing packages it serves and serve it's own public
signing keys at: https://fast-npm-mirror.tld/-/npm/v1/keys

Before trusting the new signing keys make sure the response hasn't been tampered with (MITM attack).

The CLI will prompt a user to manually trust new signing keys when verifying a
package that has a signature and untrusted `keyid`.

```
$ npm audit signatures
project@1.0.0 $HOME/work/project

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!!                  WARNING: FOUND UNTRUSTED SIGNATURE KEYS                   !!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

Found untrusted signature keys at https://fast-npm-mirror.tld/-/npm/v1/keys

Are you sure you trust this host? (yes/no)
> no
```

Trusted keys are added to the `.npmrc`:

```
[trusted-signature-keys.sha256:{{SHA256_PUBLIC_KEY}}]
expires=2023-12-17T23:57:40-05:00
keytype=ecdsa-sha2-nistp256
scheme=ecdsa-sha2-nistp256
key=123

[trusted-signature-keys.sha256:{{SHA256_PUBLIC_KEY}}]
expires=2023-12-17T23:57:40-05:00
keytype=ecdsa-sha2-nistp256
scheme=ecdsa-sha2-nistp256
key=789
```

## Out of scope

- Verify all packages on install (e.g. `npm install`)
  - Signature verification could eventually be folded into the `install`
    command, and enabled by default, once we're confident it's performant and
    reliable.
- Bundling a more secure crypto library with the npm CLI, e.g. [Sigstore
  `cosign`](https://github.com/sigstore/cosign/) or cross compiling go's
  `x/crypto` lib to wasm
  - Node's `crypto` implementation is a wrapper around OpenSSL which has a long
    history of CVEs
  - The node team are working on `crypto.webcrypto` as a replacement for
`crypto`, we could support both, preferring webcrypto (is this still usign
OpenSSL under the hood?)

## Prior Art

- Original spec for adding signatures
  - [Package signing: a concrete plan](https://gist.github.com/ceejbot/2c5ef47ffe182f3fdd79cc1a1a5332d6)
  - [new pgp machinery](https://blog.npmjs.org/post/172999548390/new-pgp-machinery.html)
- RFC suggesting a CLI validation command and user managed signatures
  - [rfc: Signed Packuments](https://github.com/npm/rfcs/pull/76)
- PyPI adopting The Update Framework (TUF)
  - [PEP 458 -- Secure PyPI downloads with signed repository metadata](https://www.python.org/dev/peps/pep-0458/)
  - [PEP 480 -- Surviving a Compromise of PyPI: End-to-end signing of packages](https://www.python.org/dev/peps/pep-0480/)

## Unresolved Questions and Bikeshedding

- There's [prior art adding a signature verification
  command](https://github.com/npm/rfcs/pull/76) to the npm CLI. Some [open
  questions remain](https://github.com/npm/rfcs/pull/76#issuecomment-594942606):
  - Q: `@isaacs`: What do we do when there is no `dist.npm-signature` present?
    - A: I assume we need to ignore it, as this would also be the case for packages coming from third party registries
  - Q: `@isaacs`: How many packages today lack a signature, and how often are those versions downloaded?
