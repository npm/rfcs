# Add `npm-app-id` variable to HTTP header

## Summary

HTTP header may contain `npm-app-id` variable which may be used in third-party applications.

## Motivation

Some third-party applications may use `npm-app-id` variable for their purposes.

## Detailed Explanation

Developers and users who are using npm tool, may want to get `npm-app-id` value from the project.
For developers who perform preprocessing while `npm audit` or `npm install` in third-part applications is no way to get application id.
Like `npm-session` is used by the npm registry to identify individual user sessions, we want to add `npm-app-id` to identify the project. 

## Rationale and Alternatives

* **Rationale:** 
  * This is easy to implement solution to provide such additional value in the HTTP request.
  * Building this functionality will allow developers easily set `app-id` to the [npm-registry](https://docs.npmjs.com/using-npm/registry.html) or use environment variable.
* **Alternatives:** 
  * Use `preshrinkwrap` or/and `postshrinkwrap` scripts to install a custom value to the project like the `app-id`

## Implementation

* Define the new element `npm-app-id` in the HTTP request in the [npm-registry-client](https://github.com/npm/npm-registry-client) repository
* Add `npm-app-id` to the npm ci in the [cli](https://github.com/npm/cli) repository
* `npm-app-id` should be set in [npm-registry](https://docs.npmjs.com/using-npm/registry.html) or in the environment variable like `NODE_ENV`

## Prior Art
