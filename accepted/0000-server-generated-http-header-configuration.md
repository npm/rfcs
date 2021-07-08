# Server generate HTTP header configuration

## Summary

Allow the `npm cli` to write server generated header configuration to the project based `.npmrc` file.

## Motivation

This change will provide a means for a server to supply server generated configuration. This could help solve situations where third party tooling requires additional information passing around, such as tokens for authorization.

## Detailed Explanation

An existing rfc (https://github.com/npm/rfcs/pull/138), details a way to provide additional configuration through the use of `header` configuration supplied by the `.npmrc` file. The header configuration items are sent in the HTTP headers with every request.

Some systems could be automated further with server generated configuration values.


As an example, a user initiates an `npm audit` on a fresh project, these audits are processed by a third party application that provide additional context. The context supplied may well be dependent on many factors such as geographical location.
This rfc will allow the server to generate missing(1) headers and to send them back to the cli as HTTP headers. The cli writes new header supplied configuration to the projects `.npmrc` file for future use.

## Rationale and Alternatives

{{Discuss 2-3 different alternative solutions that were considered. This is required, even if it seems like a stretch. Then explain why this is the best choice out of available ones.}}

## Implementation

The existing rfc to allow header configuration supports the following mechanism:
```
; project-level .npmrc
headers[]="npm-app-id: a config value"
headers[]="Authorization: some auth value"
``` 

To support the idea of allowing a server to generate values, the configuration should support a predefined token `#npm-generate`

An example:
```
; project-level .npmrc
headers[]="npm-app-id: #npm-generate"
headers[]="Authorisation: #npm-generate"
```

The server supplies context based values for the `#npm-generate` tokens in the header response. On receipt of supplied values the cli writes the values into the `.npmrc` file. From that point forward all HTTP header traffic use the server supplied values.
  
## Prior Art


## Unresolved Questions and Bikeshedding

For security, this rfc is only allowing a server to generate values for header configuration that is supplied with a `npm-genererate` token. This is open for discussion to whether this is necessary.

A current presumption is that global supplied `#npm-generate` tokens are allowed, but the server responses are written to a project level `.npmrc` and subsequently takes precedence.