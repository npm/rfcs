# Add `metadata` object to package.json to be sent in HTTP header

## Summary

HTTP header may contain `metadata` object which may be used in third-party applications.

## Motivation

Some third-party applications may enhance the audit reports provide and may need extra information to provide this capability

## Detailed Explanation

Developers and users who are using the npm audit tool, may want to get additional or finely tuned report information about their project.
For developers who perform `npm audit` or `npm install` with third-party applications there is no way to provide additional metadata.
Like `npm-session` is used by the npm registry to identify individual user sessions, it would be useful to provide a generic way for a maintainer to add additional metadata to their project  which is sent during an `npm audit` or `npm install`.

## Rationale and Alternatives

* **Rationale:** 
  * This is easy to implement solution to provide such additional value in the HTTP request.
  * Building this functionality will allow developers to easily set additional information that can be passed along in a heaer for third-party application use
  
* **Alternatives:** 
  * Use `preshrinkwrap` or/and `postshrinkwrap` scripts to install a custom value to the project like the `app-id`

## Implementation

* Define a new `metadata` object that can be added to the package.json file `metadata`.
* The `metadata` JSON object is picked up by the [npm cli](https://github.com/npm/cli) and sent as a `metadata` attribute in the HTTP header requests

An illustrative `package.json` example:

```
{
  "name": "npm_project",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "qs": "^2.4.2"
  },
  "metadata": {
    "npm-app-id": "my_application_id"
  }
}
```
## Prior Art
