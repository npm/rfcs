# Interactive audit resolver

## Summary

This proposal is for adding means for a human to resolve issues from `npm audit` and interactively make decisions about each issue. Available as `npm audit resolve` command.

Features:
- Remember the resolutions and allow them to affect `npm audit` behavior.
- Decision options include 'ignore', 'remind later', 'fix', 'remove'.
- Allow tracking who resolved an issue and when using git history.


## Motivation

At times, running `npm audit fix` won't fix all audit issues. Fixes might not be available or the user might not want to apply some of them, eg. major version updates or build/test dependencies.

It should be possible to make `npm audit` a step in a CI pipeline to go red every time a new vulnerability affects the project. Managing security of dependencies should be quick to update, effective, easy to audit over time and secure in itself.

For that, the user needs a new tool which makes addressing issues one by one convenient even across a whole ecosystem of projects.

## Detailed Explanation

`npm audit resolve` runs audit and iterates over all actions from the output with a prompt for a decision on each. 
If fix is available, it's offered as one of the options to proceed. Other options include: ignore, remind later and delete.

All decisions are stored in `audit-resolv.json` file as key-value, where key is `${dependency path}|${advisory id}` and value is a structure specific to the resolution.

`npm audit` reads `audit-resolv.json` and respects the resolution (ignores ignored issues, ignores issues postponed to a date in the future)

### resolutions
- **fix** runs the fix proposed in audit action and marks the issue as fixed in `audit-resolv.json`. On each subsequent run of `npm audit resolve` if the issue comes up again, the user is also warned that the problem was supposed to be fixed already.
- **ignore** marks the issue as ignored and `npm audit` will no longer fail because of it (but should display a single line warning about the issue being ignored). If a new vulnerability is found in the same dependency, it does not get ignored. If another dependency is installed with the same vulnerability advisory id it is not ignored. If the same package is installed as a dependency to another dependency (different path) it is not ignored.
- **postpone** marks the issue as postponed to a timestamp 24h in the future. Instead of ignoring an issue permanently just to make a build pass, one can postpone it when in rush, but make it show up as a CI faiure on the next working day. 
- **remove** runs `npm rm` on the top level dependency containing the issue. It's a convenience option for the user to remove an old package which they no longer intend to use. 

(this RFC can't define the full scope of investigate)
- **investigate** when fix is not available, investigate option shows instead. It goes up through the dependencies chain and finds the one that needs their package.json updated with new version specification to enable a fix. 
The result can be a call to action to create a PR (patch could be automatically generated)
Patch could also be applied locally or a specific change to package-lock.json could be proposed. 

**skip** and **abort** options should also be provided.

## Rationale and Alternatives

**Ignoring is necessary but must be under control at all times**
- `nsp check` used to support ignoring a particular issue in all dependencies, but that's not enough to be in control and remain secure. It wasn't uncommon for projects to ignore an advisory id because it was coming up as an issue in code that didn't run in production, thus risking it getting into the production code when updating another dependency to a version with the same issue.
- ignoring just dev dependencies is not enough. Sometimes the developer knows a vulnerability can be ignored because a package with a DOS is used in tooling for the project (not a dev dependency but eg. a migration script), not production code. To be really secure, ignoring must be explicit. 
- Editing a file to specify what to ignore will not suffice any more at that level of detail, so automation is necessary.

**Why audit-resolv.json?**
Resolutions must be recorded in a file and committed to git(or alternative) for edit history and full audit on who decided what.
Resolution format must be readable for a JavaScript developer.

- `package-lock.json` is not a good option for storing resolutions because even if we overlook the fact that it'd be adding another purpose to a single-purpose file, the community at large is still used to removing and regenerating it often. 
- `package.json` is not a good option, because it is already overloaded for so many functionalities. The output of resolutions could be lengthy and clutter the file. User will need the resolution information much less often than they look in the package.json file. ALso, resolution file is not meant to be edited by hand.
- `.npmrc` is not a good option because it doesn't live in the repository and being a dotfile is easy to miss, so a developer could overlook it affecting the audit. Also using it for the purpose of storing resolutions to project specific issues seems counter-intuitive.

A separate file referred to as `audit-resolv.json` has the benefit of being single purpose, easy to track and audit, easy to version and migrate between versions of `npm` and comfortable for the users to review in git history and pull requests.

**postpone, remove, investigate**
Other options are helpers for more elaborate actions a developer would take when confronted with an issue they can't or don't want to fix. 

Why is postpone useful at all? It's designed to build a secure development culture where one didn't yet form. Without it, a developer under time pressure would mark an issue as ignored with intention to un-mark it later. 
While shipping with a known vulnerability is a bad practice, NPM's mission with the community should be to empower people to build more secure products and trust their skill and understanding of their project's particular needs. We should also aspire to help teams introduce more secure workflows effortlessly, so letting a build pass without risking compromising security long-term is a win. 

Remove is only useful as a convenience. Imagine a developer introducing `npm audit` and having to go through tens of issues. If they notice one of the first issues is caused by a dependency they no longer use, instead of remembering to clean it up later, they can choose this option.

Investigate option has a lot of potential for the future where NPM could do things ranging from linking to resources on mitigation to generating local fixes or providing a marketplace of companies offering services fixing the issue for customers (business potential for NPM).

### Alternatives

Currently the only alternative is to manage the issues manually and keep track of the resolutions using conventions created by a team individually. Ignoring dev dependencies and certain level of severity will be provided for `npm audit` so it lowers the barrier of entry to using it in a CI system. 

Paid alternatives for managing security of a node.js project are available, including Snyk, with focus on providing patches to their customers.

## Implementation

reference implementation https://github.com/npm/cli/pull/10

prototype of a working tool (in production use) https://www.npmjs.com/package/npm-audit-resolver

The implementation is, and should remain, runnable standalone as a separate package with minor wrapping code - useful for testing new features without bundling unfinished work with npm cli versions and therefore node.js


## Prior Art

I recall a tool wrapping `nsp check` that gave me the idea to store exact paths of dependencies set to ignore (or any resolution)
Not aware of other prior art. Didn't find much in the npm packages ecosystem when researching it at the time of release of npm audit.

## Unresolved Questions and Bikeshedding


