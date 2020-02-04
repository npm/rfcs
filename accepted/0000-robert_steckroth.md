# Optional dependencies need to be listed regarding the npmjs website.

## Summary

The [npm](https://npmjs.com) website package pages contains a tab for project dependencies which does not consider *optionalDependencies*. Instead, *optionalDependencies* are listed as regular *dependencies* while the projects *devDependencies* are infact listed correctly.

## Motivation

Optional dependencies do not trigger unit test (or installation) failures and therefor are seen as different/lesser than regular dependencies.

@restarian :octocat:
