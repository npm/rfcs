# Peer-Dependency specific overrides


## Summary

Addition of a package field where overrides of peer dependencies could be
defined to be accepted and used by arborist.


## Motivation

Originally described in [Issue regarding npm-v7 peer-dependency behavior as
described by RFC-0025-install-peer-deps and currently implemented in arborist
and npm-v7-beta][#204]


### The Issue

Running an npm-v6 install in the project i have currently opened (which is very
representative of my projects) will result in this message:

 > npm WARN tsutils@3.17.1 requires a peer of typescript@>=2.8.0 || >= 3.2.0-dev || >= 3.3.0-dev || >= 3.4.0-dev || >=3.5.0-dev || >= 3.6.0-dev || >= 3.6.0-beta || >= 3.7.0-dev || >= 3.7.0-beta but none is installed. You must installpeer dependencies yourself.
 > npm WARN ts-node@8.10.2 requires a peer of typescript@>=2.7 but none is installed. You must install peerdependencies yourself.
 > npm WARN @typescript-eslint/eslint-plugin@2.34.0 requires a peer of eslint@^5.0.0 || ^6.0.0 but none is installed.You must install peer dependencies yourself.
 > npm WARN @typescript-eslint/parser@2.34.0 requires a peer of eslint@^5.0.0 || ^6.0.0 but none is installed. Youmust install peer dependencies yourself.
 > npm WARN eslint-plugin-react@7.14.3 requires a peer of eslint@^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 but none isinstalled. You must install peer dependencies yourself.
 > npm WARN eslint-plugin-import@2.18.2 requires a peer of eslint@2.x- 6.x but none is installed. You must installpeer dependencies yourself.


#### Going over them

- **tsutils**: helper type library. has seen Zero activity in the past few months
- **ts-node**: typescript-code-runner. no upper version limit, but is still a
  mismatch because i use **typescript@next** (currently: "^4.1.0-dev.20200815")
- **@typescript-eslint/eslint-plugin** and  **@typescript-eslint/parser**:
  **eslint-v6.8** is actually in my dependency-tree as a dep of
  **standard/standardx** and it's that module that actually uses these two plugins.
- **eslint-plugin-react** and  **eslint-plugin-import**: two unfulfilled peer-deps
  (these itself being 3-nodes deep)also used by **standard/standardx**.
  *(plus: i have never even used react)*

But what all of them have in common: I *never* had an issue with not meeting
their peer deps, and have been using them extensively and for various edge-cases.


#### The absurdity

Now it might sound like this is a project with many dependency. But on the
contrary. Below are all the deps listed in my package.json. It's a whooping 13,
only two of which are used at runtime. i essentially have about **50%** (6 of 13)of
installed modules complain about peer-deps, with non of them actually having a
valid reason for it and none of them even used at runtime, so it's only local,
and doesn't affect any users of the package. It's straight-up insanity.

 ```js
 {
   "devDependencies": {
     "@types/node": "^14.0.27",
     "@typescript-eslint/eslint-plugin": "^2.34.0",
     "@typescript-eslint/parser": "^2.34.0",
     "babel-eslint": "^10.1.0",
     "eslint": "^7.7.0",
     "standardx": "^5.0.0",
     "ts-node": "^8.10.2",
     "ts-typing-util": "file:../GitHub/ts-typing-util",
     "tsutils": "^3.17.1",
     "type-fest": "^0.16.0",
     "typescript": "^4.0.0-beta"
   },
   "dependencies": {
     "@repeaterjs/repeater": "^3.0.3",
     "reflect-metadata": "^0.1.13"
   }
 }
 ```


#### concluding

Thus far it's only been a (quite frankly not so) minor nuisance. But with
unresolved peers now causing issues with project-management, this has become a
major problem for me. Now the **eslint** thing isn't that much of a problem,
although i would very much like to use the latest versions of it when i'm using it
programmatically instead of being forced to use a version that's 6 months and a
semver-Major behind.
The real issue is with **typescript**. My code-bases always use `dev`-versions,
and because all my work is in next-gen and frontier stuff, i really depend on it
to stay on top and ahead of things.

The behavior described in [RFC-0025] and implemented in ```npm-beta-v4``` is
incompatible with my development environment and without a way of overriding
that, the only way for me to resolve this problem would be to stop using npm.


## Detailed Explanation

Inclusion of a package field where overrides of a requested peer-dependency can
be specified by the dep-consumer.

```ts
// the usual install specifiers like version, path, repo
type InstallSpecifier = string

interface PackageJson {
  peerDependenciesMeta: {
    [dependency: string]: {
      [peer: string]: PeerOverride
    }
  }
}
```

example with packages used in [Motivation](#motivation)

```JSON5
{
  "devDependencies": {
    "ts-node": "^8.10.1", // has a peer of depB
    // doesn't pass the semver-check because is a prerelease
    "typescript": "typescript": "^4.1.0-dev.20200815",
    "@typescript-eslint/eslint-plugin": "^2.34.0",
    "standardx": "^5.0.0"
  },
  "peerDependenciesMeta": {
    // tell arborist to settle for the locally install version
    "ts-node": { "typescript": "local" },
    // a hard version override
    "tsutils": { "typescript": "^4.0.0-beta" /* or path to local package */ },
    // offer a substitute package
    "@typescript-eslint/parser": {
      "eslint": { "standardx": "^5.0.0"  /* or "local" or path to local package */  }
    }
  }
}
```

The specified override will be accepted arborist as a matching peer and then
treated exactly like any other (dep-)dependency. This way it requires only
minimal code alteration


## Implementation

TODO: link Arborist fork once it's ready


## Prior Art and Alternatives


### Alternative F mentioned in RFC-0025

*[link](https://github.com/npm/rfcs/tree/latest/accepted#f-use-peerdependenciesmeta-to-trigger-auto-install)*

*this is implemented in the npm beta-v4*

I don't think that the author should specify which peer-deps get auto installed
and which don't. This could possibly lead to similar user-confusion and
resulting (re-)moval of peer-deps as we are seeing it now. I think the decision
to include a peer-dep should be declarative, and being able to make a peer-dep
defacto optional defeats the purpose, as it could just as well be filed as an
optional dep with a not in the projects readme.


### Using a different field-name

Any field-name could be used, but since i take issue with the current
```peerDependenciesMeta``` implementation i would prefer replacing that all
together


### Proposed RFC: overrides

*[link][PR:RFC-overrides]*

Similar in nature, but way more general affecting all dependencies and with nesting
and affecting much of the tree

This RFC is supposed to be much simpler and only targets peer-dependencies.
The purpose is for it to be much simpler, more descriptive, and have the ability
to substitute in an entirely different package like a fork


### ```acceptDependencies``` package field

Described in this [this (closed) PR] and [implemented in arborist]
It is somewhat related

[this (closed) PR]:<https://github.com/npm/rfcs/pull/72>
[implemented in arborist]:<https://github.com/npm/arborist/commit/705578db834a48be171bb974e5a0128aa7133398>

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}

[#204]:<https://github.com/npm/rfcs/issues/204>
[RFC-0025]:<https://github.com/npm/rfcs/blob/latest/accepted/0025-install-peer-deps.md>
[PR:RFC-overrides]:<https://github.com/npm/rfcs/blob/isaacs/overrides/accepted/0000-overrides.md>
