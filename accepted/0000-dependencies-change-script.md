# Dependencies Change Script

## Summary

Provide the ability to automatically run a script anytime the the dependencies in a repo
change.

## Motivation

It would be valuable to run validation scripts after dependencies have changed,
and would enable automatically running compliance tooling in projects when
dependencies are installed.

For example, I work at company Rad Developers (not really 😉) and we have an
internal auditing script `MakeSureWeDontGetSued.sh` we need to run on any
dependencies we use in our applications. I want to be able to setup a
package.json script that will be called automatically anytime the dependencies
change so that compliance is an automated part of every team members' workflow.

## Detailed Explanation

I think one way this could be backwards compatible is by adding a `postChange`
script to the set of package.json scripts that npm will call during the
installation lifecycle.

After any of these actions, the npm CLI would call any defined `postChange`
script:

- `npm install`
- `npm install some-dep`
- `npm uninstall some-dep`

## Rationale and Alternatives

I currently don't know of any alternative way to do this. I looked around and
found a few different questions trying to do this, but no workarounds or
solutions.

## Implementation

_(I'm not very familiar with the npm codebase, if there is interest in this RFC
I'd love to dive in to find out these details)_


## Prior Art

I don't know of any prior art for addressing this workflow.

## Unresolved Questions and Bikeshedding

There may be a more self-explanatory name than `postChange`
