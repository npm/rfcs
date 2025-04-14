# Token exclusion from publish 2FA

## Summary

{{A concise, one-paragraph description of the change.}}

Allow enabling 2FA for `auth-and-writes`, but with the ability to exclude
specific token(s) from the requirement to provide a One Time Password (OTP) when
publishing. This could enable enforcing full 2FA for a user account/package/organization,
while still allowing fully automatic publishing, which is more consistent and
arguably more secure (see potential additional proposals in [Unresolved Questions and Bikeshedding](#unresolved-questions-and-bikeshedding))
than publishing manually.

## Motivation

Enabling 2FA for `auth-and-writes` requires a OTP to be entered when publishing
packages, either interactively or [provided directly with the `npm publish`
command](https://docs.npmjs.com/getting-started/using-two-factor-authentication#how-to-add-an-otp-to-a-command).
Publishing automatically from a build on a Continuous Integration (CI) server, such
as with [`semantic-release`](https://github.com/semantic-release/semantic-release)
or publishing on CI triggered by tags added locally, removes the opportunity to
provide the OTP interactively, leaving only the option to provide it as part of
the `npm publish` command. Even following that option would [require the ability
to generate the OTP from within the CI environment](https://github.com/semantic-release/npm/issues/93#issue-345581894),
potentially putting the 2FA secret at risk by making it available there.

Alternatively, using `auth-only` can be used for the account to protect
authentication but allow publishing without requiring the OTP. However, this has
two major downsides:

* In order to disable 2FA for publishing from the CI environment, it has to be
  disabled for publishes from _anywhere_
* [Other writes](https://docs.npmjs.com/getting-started/using-two-factor-authentication#levels-of-authentication)
  are also not protected by 2FA

## Detailed Explanation

{{Describe the expected changes in detail, }}

## Rationale and Alternatives

{{Discuss 2-3 different alternative solutions that were considered. This is required, even if it seems like a stretch. Then explain why this is the best choice out of available ones.}}

* generate 2fa code on CI - requires the 2FA secret to be available in the CI environment, putting it at risk if the CI environment were compromised by an attacker
* push notification - would delay publishes until human interaction happens
* time limited tokens - would require rotating tokens just before each publish, making publishes essentially manual

## Implementation

{{Give a high-level overview of implementaion requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

{{This section is optional if there are no actual prior examples in other tools}}

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

* Should the number of excluded tokens be limited? Since tokens are not
  organization or package specific, is there even a reason to allow more than one
  exclusion?
* Should exclusions require additional protection, like CIDR restrictions? It
  seems like this should at least be provided as a warning, but it might not be
  realistic to make it a requirement. Some services, like [Circle CI](https://circleci.com/)
  might [not define public IPs for whitelisting](https://support.circleci.com/hc/en-us/articles/115014372807-IP-Address-ranges-for-whitelisting-)
* How do the risks of the options compare? From what I've considered, I would
  consider a CIDR restricted token to be at least as secure as a non-restricted
  token that requires a OTP. This seems especially true since reading the details
  of the CIDR restriction appear to require a OTP, which would be unavailable to
  an attacker that gained access to the token alone (While restricting to IPs of
  Travis CI, for example, would not prevent the attacker from using the token in
  their own account on Travis, it would be difficult for that attacker to know
  that Travis is in the allowed whitelist). This also seems lower risk than [using
  the 2FA secret in an environment](https://github.com/semantic-release/npm/issues/93#issue-345581894)
  where it could be compromised if accessed by an attacker. Are there holes I'm
  not considering?
* Since I always publish with `semantic-release`, I'd like to also be able to
  further restrict which tokens can publish. Should these be separate RFCs, or
  is there benefit to coordination with this one?
  * Ability to restrict users other than the bot to only generate read-only
    tokens
  * Ability to mark a specific token as the only one allowed to publish (prevent
    creation of additional new tokens wiht the ability to publish)
  * Ability to restrict email notifications of publishes to only those that do
    not follow the expected process (only email when publishes happen with other
    tokens or if the CIDR restricted token is used outside of the allowed IPs)

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
