# Obey user specific dist-tag

## Summary

When running `npm install pkg@latest-1`, npm should provide a way to save `latest-1` into `package.json`.

## Motivation

Since @ljharb has already proposed an RRFC of [obey user specifier](https://github.com/npm/rfcs/pull/547), which will be implemented at the next major version(v9) of npm.

In my case, when installing a new dependency using `npm install antd@conch`, I want `antd` to keep the exact `conch` dist-tag in my package.json, because this is exactly the version I need in my project. By saying version, I mean the version `conch` **always** points to, not the moment I run the install command.

Since dist-tag means more than a semantic versioning when a maintainer maintains multiple major versions of a project, like `conch`, `next` etc.

And in the [obey user specifier](https://github.com/npm/rfcs/pull/547) RRFC, @wesleytodd suggested a new flag to support this behavior, which is more reasonable.

## Detailed Explanation

Assuming the dist-tag `conch` of `antd` currently binding to the exact version `4.20.7`.

Currently npm supports those two ways of saving dependency into `package.json`:
1. [x] Running `npm install antd@conch` should save the semantic versioning into  package.json, hence `^4.20.7` shall be saved;
2. [x] Running `npm install antd@conch --save-exact` should save the exact version into package.json, hence `4.20.7` shall be saved.

We want a new flag to save dependency below:
1. [ ] Running `npm install antd@conch --force` should save the dist-tag into package.json, hence `conch` shall be saved;


## Rationale and Alternatives


## Implementation

Add a new flag `--force` to save user specific semantic version or dist-tag when installing a dependency.

## Prior Art

## Unresolved Questions and Bikeshedding

I think the flag `--save-exact` would be more comprehensive to support this RFC, but it would change to behavior of `--save-exact` in npm@8.

If `--save-exact` used in this case, bumping up a major version of npm is needed.


### References
<!-- Examples
* Related to issue [#5052](https://github.com/npm/cli/issues/5052)
* Related to RRFC #547
-->
* Related to issue [#5052](https://github.com/npm/cli/issues/5052)
* Related to RRFC #547
