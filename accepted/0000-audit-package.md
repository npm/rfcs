# Audit for a not yet installed package

## Summary

Allows the user to request and receive an audit result for a package that has not yet been installed. 

## Motivation

* In some environments (aka corporate) the npm registry might be behind a firewall like [Nexus Firewall](https://www.sonatype.com/nexus/firewall?smtNoRedir=1) (which automatically blocks vulnerable packages and responds to npm with status code 403. In those scenarios it is hard to say which package is causing trouble. 
* packages might have vulnerabilities, so security implications are useful to know before installation.



## Detailed Explanation

To query audit information on a specific package the `audit` command is extended with an optional package parameter. `npm audit typescript` would fetch audit information for the typescript package. 
 
The CLI would query the `advisory endpoint` and get a full advisory for the specified package and version as well as its dependencies. The advisory is similar to `npm audit`, but references to `npm audit fix` should be changed to only give users indication if the vulnerabilities can be fixed. It should also output the version of the package that was queried. 

## Rationale and Alternatives

* An alternative would be to provide this information on the package detail page in on npmjs.com, but this would probably be harder to implement (since data would need to be cached) and it might be taken as "blame" by package authors. However, this could be explored in a different RFC. Developers should be able to query this information with the CLI too. 

## Implementation

* Extend npm audit endpoint to allow querying for a specific package and version. 
* Possibly extend aborist to allow to query a single package.
* Extend `npm-audit-report` with a readonly mode, which would change the output of available fixes to something that would signal to the user that a vulnerability can be fixed. 
* Modify `lib/audit.js` of the CLI to introduce the new command. 



## Prior Art

* This basically reuses almost the entire `npm audit` output. 

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

Do we need to distinguish between locally installed packages and not yet installed packages?