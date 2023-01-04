# RFC for linking packages to their source and build without using Sigstore Fulcio

## Summary

As it is showed in a recent paper that Sigstore Fulcio is an unnecessary trusted third party for linking npm packages to their source and build, we suggest the npm team consider the new approach presented in that paper which can be found at:

https://eprint.iacr.org/2023/003

The new approach not only eliminates the unnecessary dependency on an external black-box CA but also accelerates the signing process.

## Motivation

Last year an RFC for linking npm packages to their source and build using Sigstore Fulcio was proposed and accepted:

https://github.com/npm/rfcs/pull/626

However, the paper mentioned above shows the same result can be achieved without using Sigstore Fulcio at all. Since relying on an unnecessary black-box CA poses a serious threat to the npm community, we draft this RFC.

## Detailed Explanation

The key observation made by the paper mentioned above is the following:

- Instead of setting the Audience claim of a requested OIDC token to be `sigstore` (as proposed by the previous RFC), a CI/CD workflow can in fact set the Audience claim to be something like `sigstore?pk=PubKey`, where `PubKey` is (the Base64 encoding of) the public key used by the CI/CD workflow for signing the software artifact.

In other words, such an OIDC token can be understood as a witness signed by the CI/CD service, with the Audience claim encoding the workflow's intention to use the public key to represent it. Thus, instead of exchanging an OIDC token (and a public key) for a Fulcio certificate, we can directly use the OIDC token in place of the certificate (which is, after all, transcribed from the OIDC token).

As for verification, instead of hardcoding the root certificate of Fulcio, we can just hardcode the public key of the corresponding CI/CD service (aka OIDC provider), which is part of the root of trust of Sigstore Fulcio (so that no new trust is introduced).

## Rationale and Alternatives

- The previous RFC is an alternative that depends on an external black-box CA
- This RFC requires no external black-box CA
- The paper mentioned above suggests Sigstore Rekor, also proposed in the previous RFC, can be directly replaced by standard RFC 3161 Time Stamping Authority (TSA) servers hosted by established CAs such as DigiCert and Sectigo for business grade SLAs

## Implementation

### Signing

The signing procedure (within a CI/CD workflow) proposed by the previous RFC is roughly the following:

1) Generate a disposable key pair
2) Obtain a customizable OIDC token with Audience claim set to be "sigstore"
3) Request a public-key certificate from Fulcio using the key pair and the token
4) Digitally sign (the hash of) the software artifact using the private key
5) Timestamp the signature using Rekor
6) Output the certificate, the digital signature from step 4, and the timestamp data from step 5

Below we adapt the above procedure by using strikethrough lines to denote deletions and using underlines to denote additions:

1) Generate a disposable key pair 
2) Obtain a customizable OIDC token Audience claim set to be "sigstore<ins>?pk=PubKey</ins>"
3) ~~Request a public-key certificate from Fulcio using the key pair and the token~~
4) Digitally sign (the hash of) the software artifact using the private key 
5) Timestamp the signature using Rekor 
6) Output the ~~certificate~~ <ins>OIDC token</ins>, the digital signature from step 4, and the timestamp data from step 5

### Verification

On the other hand, the offline verification proofs required by the previous RFC are the following:

- The output from step 6
- The root certificate of Fulcio
- The public key that Rekor used to sign the timestamp data

And we just need to adapt the second item:

- The output from step 6 
- ~~The root certificate of Fulcio~~ The public key that the OIDC identity provider used to sign the OIDC token
- The public key that Rekor used to sign the timestamp data
