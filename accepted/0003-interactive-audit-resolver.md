# Audit resolutions

## Summary

Historically this proposal was titled "Interactive audit resolver". That idea was too wide to introduce in one go and parts of it are better served in userland packages. This is now the core subset of the original proposal containing support for resolutions file.

This proposal is for adding means for a human to resolve issues from `npm audit` by making and documenting decisions to ignore particular false positives. 
The implementation should introduce support for reading and applying decisions from `audit-resolve.json` file

Features:
- Let users save tecisions about vulnerabilities and change `npm audit` behavior to accomodate that.
- Decision options include 'ignore', 'remind later', 'fix', 'none'.
- Allow tracking who resolved an issue and when using git history.
- Define a format to be used by userland packages when helping users make and store decisions.

## Motivation

At times, running `npm audit fix` won't fix all audit issues. Fixes might not be available or the user might not want to apply some of them, eg. major version updates or build/test dependencies.

It should be possible to make `npm audit` a step in a CI pipeline to go red every time a new vulnerability affects the project. In cases when `npm audit` reports a vulnerability that is not affecting the project, user should be able to ignore it. 

examples: 
- yargs-parser as a transitive dependency of an API gateway is not something that should break a CI run if vulnerable
- ReDoS vulnerability in a dependency of a commandline tool

Managing security of dependencies should be quick to update, effective, easy to audit over time and secure in itself.


## Detailed Explanation

`npm audit` consumes decisions about what to ignore or warn about when an issue comes back that was already fixed.

All decisions are stored in `audit-resolve.json` file as key-value, where key is `${advisory id}|${dependency path}` and value is:

```js
{
  decision: "fix|ignore|postpone|none",
  madeAt: <timestamp of when the decision was made>
  expiresAt: <timestamp of when the decision was made>
}
```

`npm audit` reads `audit-resolve.json` to get decisions

`audit-resolve.json` file could be created manually, but the expected UX of that file would be via a userland package that reads audit output, helps the user decide what to do and saves the decision. This tool will be referenced as *audit resolver* below.



### resolutions
- **fix** - a fix was applied and *audit resolver* marked issue as fixed in `audit-resolve.json`. On each subsequent run of `npm audit` if the issue comes up again, the user is also warned that the problem was supposed to be fixed already.
- **ignore** - *audit resolver* marks the issue as ignored and `npm audit` will no longer fail because of it (but should display a single line warning about the issue being ignored). If a new vulnerability is found in the same dependency, it does not get ignored. If another dependency is installed with the same vulnerability advisory id it is not ignored. If the same package is installed as a dependency to another dependency (different path) it is not ignored.
- **postpone** *audit resolver* marks the issue as postponed to a timestamp 24h in the future. Instead of ignoring an issue permanently just to make a build pass, one can postpone it when in rush, but make it show up as a CI faiure on the next working day. The option is separate to ignore for better visibility of the intention of a person in a rush. This is to build better security culture in a team.
- **none** an entry in decisions list was generated but the decision was not made or was explicitly cancelled in the future


Proposed npm functionality is implemented in userland here: https://www.npmjs.com/package/npm-audit-resolver  
The `check-audit` command from the above package is providing the exact functionality proposed here.

## Rationale and Alternatives

**Ignoring is necessary but must be under control at all times**
- `nsp check` used to support ignoring a particular issue in all dependencies, but that's not enough to be in control and remain secure. It wasn't uncommon for projects to ignore an advisory id because it was coming up as an issue in code that didn't run in production, thus risking it getting into the production code when updating another dependency to a version with the same issue.
- ignoring just dev dependencies is not enough. Sometimes the developer knows a vulnerability can be ignored because a package with a DOS is used in tooling for the project (not a dev dependency but eg. a migration script), not production code. To be really secure, ignoring must be explicit. 
- Editing a file to specify what to ignore will not suffice any more at that level of detail, so automation is necessary.

**Why audit-resolve.json?**
Resolutions must be recorded in a file and committed to git(or alternative) for edit history and full audit on who decided what.
Resolution format must be readable for a JavaScript developer.

- `package-lock.json` is not a good option for storing resolutions because even if we overlook the fact that it'd be adding another purpose to a single-purpose file, the community at large is still used to removing and regenerating it often. 
- `package.json` is not a good option, because it is already overloaded for so many functionalities. The output of resolutions could be lengthy and clutter the file. User will need the resolution information much less often than they look in the package.json file. ALso, resolution file is not meant to be edited by hand.
- `.npmrc` is not a good option because it doesn't live in the repository and being a dotfile is easy to miss, so a developer could overlook it affecting the audit. Also using it for the purpose of storing resolutions to project specific issues seems counter-intuitive.

A separate file referred to as `audit-resolve.json` has the benefit of being single purpose, easy to track and audit, easy to version and migrate between versions of `npm` and comfortable for the users to review in git history and pull requests.

**postpone, remove**
Other options are helpers for more elaborate actions a developer would take when confronted with an issue they can't or don't want to fix. 

Why is postpone useful at all? It's designed to build a secure development culture where one didn't yet form. Without it, a developer under time pressure would mark an issue as ignored with intention to un-mark it later. 
While shipping with a known vulnerability is a bad practice, NPM's mission with the community should be to empower people to build more secure products and trust their skill and understanding of their project's particular needs. We should also aspire to help teams introduce more secure workflows effortlessly, so letting a build pass without risking compromising security long-term is a win. 

*audit-resolver* could perform more actions, like let the user remove a package entirely or help find a patch in the future.

### Alternatives

Currently the only alternative is to manage the issues manually and keep track of the resolutions using conventions created by a team individually. Ignoring dev dependencies and certain level of severity will be provided for `npm audit` so it lowers the barrier of entry to using it in a CI system. 

Paid alternatives for managing security of a node.js project are available, including Snyk, with focus on providing patches to their customers.

## Implementation

prototype of a working *audit-resolver* (in production use) https://www.npmjs.com/package/npm-audit-resolver

Core capability covering reading, parsing, validating and representing the `audit-resolve.json` file was extracted from npm-audit-resolver into https://www.npmjs.com/package/audit-resolve-core - API of that package to be discussed. Functionality is there.

The implementation is, and should remain, runnable standalone as a separate package with minor wrapping code - useful for testing new features without bundling unfinished work with npm cli versions and therefore node.js


### audit-resolve.json

Audit resolution file format:
map key-value where key is the advisory number concatenated with package path

```js
{
  "version": 1,
  "decisions": {
    "ADVISORY_NUMBER|DEPENDENCY_PATH":{
      "decision": "RESOLUTION_TYPE",
      "reason": "Reason provided by the person making the decision (optional)",
      "madeAt": timestamp
      "expiresAt": timestamp
    }
  }
}
```

`madeAt` should be generated by all tools using the file but is not mandatory for the sake of manually adding ignore decisions.

example

```js
{
  "version": 1,
  "decisions": {
    "717|spawn-shell>merge-options": {
      "decision":"remind",
      "madeAt": 1542440172844
    },
  ...
  }
}
```

JSON schema

https://github.com/naugtur/audit-resolve-core/blob/master/auditFile/versions/v1.js

Schema defines `version` and `decisions` fields.  
The `rules` field is meant for the *audit-resolver* as instructions how to behave.

*initially npm-audit-resolver used a different format, audit-resolve-core supports detecting old format and converting it*

## Prior Art

I recall a tool wrapping `nsp check` that gave me the idea to store exact paths of dependencies set to ignore (or any resolution)
Not aware of other prior art. Didn't find much in the npm packages ecosystem when researching it at the time of release of npm audit.

## Unresolved Questions and Bikeshedding

- adding means to fill in the content of `audit-resolve.json` file to npm itself should be a matter of another RFC


