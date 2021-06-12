# Send additional HTTP header information as defined in a list of `header` items in .npmrc

## Summary

HTTP header may contain additional `header` information which may be used in third-party applications.

## Motivation

Third-party applications may enhance decisions made based on the extra information to provided, such as individualised audits

## Detailed Explanation

Developers and users who are integrated with third-party tooling will have the opportunity surface additional and project focused information when using commands such as `npm audit`.

Currently, for developers who perform `npm audit` or `npm install` integrated with third-party applications there is no way to provide additional information.
Like `npm-session` is used by the npm registry to identify individual user sessions, it would be useful to provide a generic way for a maintainer to add additional metadata to their project which is sent during an `npm audit` or `npm install` (but not limited to).

## Rationale and Alternatives

* **Rationale:** 
  * This is easy to implement solution to provide such additional value in the HTTP request.
  * Building this functionality will allow developers to easily set additional information that can be passed along in a header for third-party applications to use
  
* **Alternatives:** 
  * Use `preshrinkwrap` or/and `postshrinkwrap` scripts to install a custom value to the project.

## Implementation

* Define a new `header` configuration item that can be added to either the global or project .npmrc file.
* The list of `header` values will be converted to a single JSON object and picked up by the [npm cli](https://github.com/npm/cli) and sent as a `header` attribute in the HTTP header requests

An illustrative `.npmrc` example:

```
; project-level .npmrc
headers[]="npm-app-id: a config value"
headers[]="Authorization: some customized authorization information"
```

### Additional configuration
It should also be possible to define additional headers to be appended or overwritten from the command line.

An illustrative example:
`npm audit --headers="npm-app-id: value"`

In this example, the HTTP header would override the `.npmrc` provided value for `npm-app-id` with the value provided from the command line.
  
## Prior Art
