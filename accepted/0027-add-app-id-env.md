# Add `APP_ID` environment variable to the metadata in `package-lock.json`

## Summary

`package-lock.json` may contain `APP_ID` environment variable in the metadata block.

## Motivation

Use the custom environment variable from the generated `package-lock.json` in a third-party application.

## Detailed Explanation

Third-party developers who are using npm tool cannot inject custom environment variable into the `package-lock.json`.
For developers who perform preprocessing while `npm audit` in third-part applications is no way to get custom value from the `package-lock.json`.
Like `NODE_ENV` environment variable is used to determine production mode, we want to add `APP_ID` in the metadata for a third-party application.

## Rationale and Alternatives

* **Rationale:** 
  * This is easy to implement solution to provide some custom value for third-party applications which are using generated `package-lock.json`.
  * Building this functionality will allow developers easily inject environment variable and use it in `npm audit` preprocessing.
* **Alternatives:** 
  * Use `preshrinkwrap` or/and `postshrinkwrap` scripts to inject a custom value to the generated `package-lock.json`.

## Implementation

Define the new element `app_id` in the metadata object:
```js
meta.app_id = process.env.APP_ID
```

## Prior Art
