# Package release hashes stored on the blockchain

## Summary

A new technology now exists to store software release hashes on the immutable blockchain. Created by a nonprofit, the Immutable Ecosystem allows software creators to use their Ethereum wallet as their release signing key, managing their software releases through a free Dapp (https://ecosystem.immutablesoft.org). Supporting release hash lookup as well as reverse lookup, integration into NPM could take many forms and has the potential to simplify processes.

## Motivation

We believe this could provide additional security to the NPM ecosystem for discerning creators and end users.

## Detailed Explanation

Instead of using a centralized NPM database of release URI's and hashes that requires security monitoring and is subject to attacks, let us use the immutable blockchain. Specifically this RFC is to allow the OPTION to use the blockchain, throught the Immutable Ecosystem, as the authoritative source of package releases. Maybe this takes the form of an internal linkage between NPM and the Immutable Ecosystem (IE) for creators who indicate as such. A release step by package creators to push an IE release to NPM, or vice versa.

## Rationale and Alternatives

The alternative is the current centralized NPM database. Many other alternatives exists but to our knowledge these are all centralized systems prone to attack and abuse/neglect by their maintainers and/or corporate owners.

As Software Creators it is time to take back our destiny. For too long have we been classified as vendors (Independent Software Vendors). We are NOT vendors, we are Creators who deserve and desire the right of self determination.

## Implementation

Through the Immutable Ecosystem (IM) a release hash and URI can be queried from the blockchain from the product, version and [optional] architecture. Or the URI, product, version, etc. can be queried from the blockchain from the release hash itself, providing a reverse lookup so to speak.

There are various angles of implementation and I hope to complete this section after receiving feedback on which avenue is the best to pursue.

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

{{This section is optional if there are no actual prior examples in other tools}}

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
