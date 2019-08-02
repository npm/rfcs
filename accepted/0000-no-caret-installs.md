# No caret for default dependencies (Force lock version)

## Summary

This change will force `npm install` to lock the version to the current installed version by default. Developers, package publishers, and users would need to manually modify their `package.json` in order for `npm update` to be relevant.

## Motivation

There have been several repeat offenses abusing this issue. Examples include the [purescript package](https://github.com/purescript/npm-installer/issues/12), and the [event-stream package](https://github.com/dominictarr/event-stream/issues/115). Regardless of type of vulnerabilities, motives and accountable people, the real vulnerability here is that because developers and maybe less knowledgable people managing a Node project are unintentionally subscribing to all minor version changes, it is being abused as an attack vector.

Another side-effect of this change is better version control among developers. People will eventually start to intentionally choose which packages to *depend* on, automatically upgrading on either major or minor changes, and which ones not to.

## Detailed Explanation

By forcing the version to be locked to the current version, if a package is compromised in the future, a large portion of the damage will be prevented by not having it installed by default on an update. Since the code is open sourced, for a vulnerability to reach a large subset of users would require it to go unnoticed from the eyes of many maintainers. As the examples above have proved, a vulnerable package only lasts days before it is found. This is largely enough time for the package publisher (and dependents) to either deprecate or remove (or lose dependencies of) the compromised package from the npm registry.

## Rationale and Alternatives

One solution proposed were signing of packages with AES, GPG signatures or similar. This is a non-solution in my opinion because there is already no concept of accountability for npm packages. A perpetrator would willingly admit to sharing a compromised package with bad intentions to little or no repercussions. Usernames also provide some level of anonymity both on github and npm.

## Implementation

https://github.com/npm/cli/blob/ab0f0260e5b6333f98062fb2d9f4f9954d3ee6cd/lib/install/deps.js#L286 I presume the change would need to be done on `computeVersionSpec` to change the default output to a caret-less version.

## Unresolved Questions and Bikeshedding

Has this really never been thought of before?