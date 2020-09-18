# Audit for a not yet installed package

## Summary

Allows the user to request and receive an audit result for a package that has not yet been installed. 

## Motivation

* In some environments (aka corporate) the npm registry might be behind a firewall like [Nexus Firewall](https://www.sonatype.com/nexus/firewall?smtNoRedir=1) (which automatically blocks vulnerable packages and responds to npm with status code 403. In those scenarios it is hard to say which package is causing trouble. 
* packages might have vulnerabilities, so security implications are useful to know before installation.



## Detailed Explanation

To query audit information on a specific package the `view` command is extended with an `--audit` parameter. The CLI would then query the `advisory endpoint` and get a full advisory for the specified package and version as well as its dependencies. The advisory is similar to `npm audit`, but references to `npm audit fix` can be omitted. 

## Rationale and Alternatives

* An alternative would be to provide this information on the package detail page in on npmjs.com, but this would probably be harder to implement (since data would need to be cached) and it might be taken as "blame" by package authors. 

## Implementation

{{Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

* This basically reuses almost the entire `npm audit` output. 

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}