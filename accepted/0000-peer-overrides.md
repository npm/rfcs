## Notes for Open-RFC-Call 02 sep 20

[meeting notes](https://hackmd.io/U93DWSLBQQKMqYsZwHEiwQ?view#PR-210-RFC-peer-specific-overrides)

- [X] overrides
  - [X] how do overrides work
  - [x] inheritance:
- [ ] peerOverrides:
  - [ ] special spec `local` -> use whatever version definer of override uses
- [ ] `--legacy-peer-deps`
  - [ ] how is the tree affected?
  - [ ] if one of my deps was developed with `--legacy-peer-deps` because it could not satisfy a requested peer, will i even be able to use it without the `--legacy-peer-deps` flag, and how would that work?
- [ ] error message and warning
- [x] "optional-peers"
- [x] should semver-check on peers accept pre-releases?
  - [x] pre-release might cause unintended side-effects with unrelated deps,
    targeted override doesn't affect other packages which have that same
    peer-spec


### overrides

#### Question 'What if'

What if:
- ROOT has dep on A
- A has peer of B
- A has dep on C
- C has peer of B
- B is overridden with X by ROOT

Does C get requested peer B or override X?

**Answer:** C will get X. override is absolute


#### Inheritance

**Resolved:** none: overrides will only be respected if defined at the Root-level


### peerOverrides:

#### special spec `local`

***open***


### `--legacy-peer-deps`

#### how is the tree affected?

**Question:** if one of my deps was developed with `--legacy-peer-deps` because it could not satisfy a requested peer, will i even be able to use it without the `--legacy-peer-deps` flag, and how would that work?

***open***


### Error-Messages and Warnings

***open***


### About 'Optional Peers'

**Resolved:** it's a common options among the package managers


### Should Semver-Check on Peers accept Pre-Releases?

**Issue:** pre-release might cause unintended side-effects with unrelated deps, targeted override doesn't affect other packages which have that same peer-spec

**Resolved:** was a bad idea in retrospect

# Peer-Dependency Overrides

<!-- TOC -->

- [Peer-Dependency Overrides](#peer-dependency-overrides)
  - [Summary](#summary)
  - [In Regards to the existing `overrides` RFC](#in-regards-to-the-existing-overrides-rfc)
    - [Urgency of peer-overrides](#urgency-of-peer-overrides)
    - [Preliminary Work on (unofficial) Implementation](#preliminary-work-on-unofficial-implementation)
  - [Motivation](#motivation)
    - [The Issue](#the-issue)
    - [Going over them](#going-over-them)
    - [The Absurdity](#the-absurdity)
    - [Concluding](#concluding)
  - [Detailed Explanation](#detailed-explanation)
    - [Package Field](#package-field)
    - [Example Config](#example-config)
    - [Effect](#effect)
    - [Logic and Examples](#logic-and-examples)
      - [Base Resolution Logic](#base-resolution-logic)
      - [Inheritance Logic](#inheritance-logic)
      - [ResolutionExample Nought: No Override](#resolutionexample-nought-no-override)
      - [ResolutionExample A: Simple Override](#resolutionexample-a-simple-override)
      - [ResolutionExample B: Inherited Override](#resolutionexample-b-inherited-override)
      - [ResolutionExample C: Re-defined Override](#resolutionexample-c-re-defined-override)
      - [ResolutionExample D: Overruled *(disabled)* override](#resolutionexample-d-overruled-disabled-override)
      - [ResolutionExample E: Override **with** acceptable peer present](#resolutionexample-e-override-with-acceptable-peer-present)
      - [ResolutionExample F: Inherited Overruled *(disabled)* override](#resolutionexample-f-inherited-overruled-disabled-override)
  - [Implementation](#implementation)
    - [State of the Arborist Fork](#state-of-the-arborist-fork)
    - [removal/replacement of existing ```peerOptional``` hooks and type](#removalreplacement-of-existing-peeroptional-hooks-and-type)
      - [Pre-Existing Code affected by Removal of ```peerOptional```](#pre-existing-code-affected-by-removal-of-peeroptional)
    - [Class Extensions](#class-extensions)
      - [```class Edge```](#class-edge)
      - [```class Node```](#class-node)
    - [Inheritance logic and resolution of special spec *`local`* via the helper ```PeerDepsMeta```](#inheritance-logic-and-resolution-of-special-spec-local-via-the-helper-peerdepsmeta)
    - [Peer-Swap in ```_loadDeps``` method of ```class Node```](#peer-swap-in-_loaddeps-method-of-class-node)
  - [Prior Art and Alternatives](#prior-art-and-alternatives)
    - [```--legacy-peers``` command line flag](#--legacy-peers-command-line-flag)
    - [Alternative F mentioned in RFC-0025](#alternative-f-mentioned-in-rfc-0025)
    - [Using a different field-name](#using-a-different-field-name)
    - [Proposed RFC: overrides](#proposed-rfc-overrides)
    - [RFC-0023](#rfc-0023)
  - [Unresolved Questions and Bikeshedding](#unresolved-questions-and-bikeshedding)
    - [Potentially Emit Warning](#potentially-emit-warning)
    - [Implement a separate save-type for ```peerOverrides``` if needed](#implement-a-separate-save-type-for-peeroverrides-if-needed)
    - [Using a different field-name](#using-a-different-field-name-1)
  - [Foot-Notes](#foot-notes)
    - [Test Coverage of the fork](#test-coverage-of-the-fork)
    - [References](#references)

<!-- /TOC -->


## Summary

Addition of a package field where overrides of peer dependencies could be
specified to be accepted as valid peers and used by **Arborist**.


## In Regards to the existing `overrides` RFC

While there is some overlap with [RFC-overrides], this RFC was drafted to be
specific to peer dependencies *only*, which allows for much simpler and thus
faster implementation.


**This RFC is in no way meant to compete with the more general `overrides`.
This RFC is trying to only address a single issue and is very much able to
co-exist with them.**


[As mentioned in] the overrides **PR** *(written on 15 Jul 20)*

> No implementation work has been done on this (unless you count scribbles in a
> notebook), and it's not going to be included in npm 7.0.0, but will be added
> in the 7.x line as a semver-minor feature update.

*[--> back to top -->]*

[As mentioned in]:<https://github.com/npm/rfcs/pull/129#issuecomment-658906056>


### Urgency of peer-overrides

> [...], and it's not going to be included in npm 7.0.0, but will be added
> in the 7.x line as a semver-minor feature update.

Enabling peer-overrides is of much higher urgency than nested
overrides and inclusion of this feature in v7 **at launch** will make upgrading
more attractive, as without this feature, v7 **will be incompatible** with some
development environments. [Elaborated in **Motivation**](#motivation)

*[--> back to top -->]*


### Preliminary Work on (unofficial) Implementation

> No implementation work has been done on this (unless you count scribbles in a
> notebook), [...]

Accompanying this RFC is an [Arborist Fork] working on implementing
peer-overrides.

**NOTE:** This currently *(as of 22 Aug 20)* is a personal endeavour and as such
has not gone through any official green-lighting.

Further details of its state can be found under [Implementation](#implementation)

*[--> back to top -->]*


## Motivation

Originally described in [Issue regarding npm-v7 peer-dependency behavior as
described by RFC-0025-install-peer-deps and currently implemented in arborist
and npm-v7-beta][#204]

*[--> back to top -->]*


### The Issue

Running an npm-v6 install in the project i have currently opened (which is very
representative of my projects) will result in this message:

 > npm WARN tsutils@3.17.1 requires a peer of typescript@>=2.8.0 || >= 3.2.0-dev || >= 3.3.0-dev || >= 3.4.0-dev || >=3.5.0-dev || >= 3.6.0-dev || >= 3.6.0-beta || >= 3.7.0-dev || >= 3.7.0-beta but none is installed. You must installpeer dependencies yourself.
 > npm WARN ts-node@8.10.2 requires a peer of typescript@>=2.7 but none is installed. You must install peerdependencies yourself.
 > npm WARN @typescript-eslint/eslint-plugin@2.34.0 requires a peer of eslint@^5.0.0 || ^6.0.0 but none is installed.You must install peer dependencies yourself.
 > npm WARN @typescript-eslint/parser@2.34.0 requires a peer of eslint@^5.0.0 || ^6.0.0 but none is installed. Youmust install peer dependencies yourself.
 > npm WARN eslint-plugin-react@7.14.3 requires a peer of eslint@^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 but none isinstalled. You must install peer dependencies yourself.
 > npm WARN eslint-plugin-import@2.18.2 requires a peer of eslint@2.x- 6.x but none is installed. You must installpeer dependencies yourself.

*[--> back to top -->]*


### Going over them

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

*[--> back to top -->]*


### The Absurdity

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
     "typescript": "^4.1.0-dev.20200815"
   },
   "dependencies": {
     "@repeaterjs/repeater": "^3.0.3",
     "reflect-metadata": "^0.1.13"
   }
 }
 ```

*[--> back to top -->]*


### Concluding

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
incompatible with my development environment.

*[--> back to top -->]*


## Detailed Explanation

Inclusion of a package field in which overrides of a requested peer-dependency
can be specified by the dep-consumer to be accepted as a valid peer of the
requester.

Overrides can be specified as using a different version or with other install
specifiers like ```path``` or ```repo``` etc. Or with the special
identifier *`local`*, which will be resolved to the version specified in
(dev-)dependencies. Alternatively a substitute package (and version or path or
*`local`* etc.) can be defined.

There is no nesting of overrides. top-level overrides will trickle up the tree
and used, overruled by existing dep, or replaced by overrides specified in a
child when appropriate. *([see inheritance](#inheritance-logic))*

Responsibility of handling **any** effects caused by overrides is on the
consumer who specified them (eg. different module name in ```import```
statements). As far as Arborist is concerned, the override is the correct
package package **as is** and will be treated accordingly.

*[--> back to top -->]*


### Package Field

d.ts definition

```ts
// the usual install specifiers like version, path, repo etc.
// AND the special `local` spec
type InstallSpecifier = string

// accepting an `InstallSpecifier` for a version override or an object for a
// substitution
type PeerOverride = InstallSpecifier | { [substitute: string]: InstallSpecifier }

interface PackageJson {
  peerDependenciesMeta: {
    [dependency: string]: {
      [peer: string]: PeerOverride
    }
  }
}
```

*[--> back to top -->]*


### Example Config

With packages used in [Motivation](#motivation)

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
    // the special `local` spec telling arborist to use the spec present in
    // (dev-)dependencies
    "ts-node": { "typescript": "local" },
    // a hard version override
    "tsutils": { "typescript": "^4.0.0-beta" /* or any other type of spec */ },
    // offer a substitute package
    "@typescript-eslint/parser": {
      "eslint": { "standardx": "^5.0.0"  /* or any other type of spec */  }
    }
  }
}
```

*[--> back to top -->]*


### Effect

The specified override will be accepted arborist as a matching peer of the
requester and then treated exactly like any other peer. This way it requires
only minimal code alteration and allows for all the usual optimization and
resolution.

**It will basically work as if the substitute was specified as the peer from the
beginning.**

*[--> back to top -->]*


### Logic and Examples

Description of inheritance and resolution logic followed by a few examples.

*[--> back to top -->]*


#### Base Resolution Logic

NOTE: `in parent` refers to the processed overrides after inheriance, not just to what the parent defines

1. override for your peer in parent ? **use override**
2. matching peer in parent dep ? **use match**
3. override for your peer in parent & matching peer in parent ? **use override**

*[--> back to top -->]*


#### Inheritance Logic

- Resolved in ```class Node``` constructor
- **used by child, not self**
- similarly, you yourself use the parent instruction, uninfluenced by your own inheritance
  logic

1. you define override ? **always** pass on **your** override
2. you have dep satisfying a peer request that has originally been overridden ?
   **don't** pass on override
3. you inherit override and **don't** have a matching dep or override for it ?
   pass on **inherited** override

*[--> back to top -->]*


#### ResolutionExample Nought: No Override

```ts
ROOT = {
  v: '1',
  deps: { DEP: 'v1' },
}

DEP = {
  v: '1',
  peers: { PEER: 'v1' }
}

PEER = {
  v: '1'
}
```

- ROOT(v1)
  - DEP(v1)
    - PEER(v1)

Flattened:

- ROOT(v1)
- DEP(v1)
- PEER(v1)

*[--> back to top -->]*


#### ResolutionExample A: Simple Override

```ts
ROOT = {
  v: '1',
  deps: { DEP: 'v1' },
  peersMeta: { DEP: { PEER: 'v2' } }
}

DEP = {
  v: '1',
  peers: { PEER: 'v1' }
}

PEER = {
  v: '1'
}
PEER = {
  v: '2',
  deps: { PEER_DEP: 'v1' }
}

PEER_DEP = {
  v: '1'
}
```

- ROOT(v1)
  - DEP(v1) --> override tells arborist to use `PEER(v2)`
    - PEER(v2) --> tells arborist about its extra dep
      - PEER_DEP(v1)

Flattened:

- ROOT(v1)
- DEP(v1)
- PEER(v2)
- PEER_DEP(v1)

*[--> back to top -->]*


#### ResolutionExample B: Inherited Override

```ts
ROOT = {
  v: '1',
  deps: { DEP: 'v1' },
  peersMeta: { DEP: { PEER: 'v2' } }
}

DEP = {
  v: '1',
  deps: { SUB_DEP: 'v1' },
  peers: { PEER: 'v1' }
}

SUB_DEP = {
  v: '1'
  peers: { peer: 'v1' }
}

PEER = {
  v: '1'
}
PEER = {
  v: '2'
}
```

- ROOT(v1)
  - DEP(v1) --> override tells arborist to use `PEER(v2)`
    - PEER(v2)
    - SUB_DEP(v1) --> inherits override and uses `PEER(v2)`
      - PEER(v2) *(re-used)*

Flattened:

- ROOT(v1)
- DEP(v1)
- PEER(v2)
- SUB_DEP(v1)

*[--> back to top -->]*


#### ResolutionExample C: Re-defined Override

```ts
ROOT = {
  v: '1',
  deps: { DEP: 'v1' },
  peersMeta: { DEP: { PEER: 'v2' } }
}

DEP = {
  v: '1',
  deps: { SUB_DEP: 'v1' },
  peers: { PEER: 'v1' }
}

SUB_DEP = {
  v: '1'
  deps: { DEP: 'v1' },
  peersMeta: { DEP: { PEER: 'v1' } }
}

PEER = {
  v: '1'
}
PEER = {
  v: '2'
}
```

- ROOT(v1)
  - DEP(v1) --> override tells arborist to use `PEER(v2)`
    - PEER(v2)
    - SUB_DEP(v1)
      - DEP(v1) *(re-used)* --> own override tells arborist to use `PEER(v1)`
        - PEER(v1)

Flattened:

- ROOT(v1)
- DEP(v1)
- PEER(v2)
- SUB_DEP(v1)
- PEER(v1)

*[--> back to top -->]*


#### ResolutionExample D: Overruled *(disabled)* override

```ts
ROOT = {
  v: '1',
  deps: { DEP: 'v1' },
  peersMeta: { DEP: { PEER: 'v2' } }
}

DEP = {
  v: '1',
  deps: { SUB_DEP: 'v1' },
  peers: { PEER: 'v1' }
}

SUB_DEP = {
  v: '1'
  deps: {
    DEP: 'v1',
    PEER: 'v1' // has dep that satisfies peer requested by DEP
  }
}

PEER = {
  v: '1'
}
PEER = {
  v: '2'
}
```

- ROOT(v1)
  - DEP(v1) --> override tells arborist to use `PEER(v2)`
    - PEER(v2)
    - SUB_DEP(v1)
      - DEP(v1) *(re-used)* --> acceptable peer in parent for arborist to use
        - PEER(v1) *(re-used)*
      - PEER(v1)

Flattened:
*(resulting shape is the same as in Ex.C but this time PEER(v1) was inferred
instead of defined)*

- ROOT(v1)
- DEP(v1)
- PEER(v2)
- SUB_DEP(v1)
- PEER(v1)

*[--> back to top -->]*


#### ResolutionExample E: Override **with** acceptable peer present

```ts
ROOT = {
  v: '1',
  deps: {
    DEP: 'v1',
    PEER: 'v1'
  },
  peersMeta: { DEP: { PEER: 'v2' } }
}

DEP = {
  v: '1',
  peers: { PEER: 'v1' }
}

PEER = {
  v: '1'
}
PEER = {
  v: '2'
}
```

- ROOT(v1)
  - DEP(v1) --> override tells arborist to use `PEER(v2)`
  - PEER(v1) --> would satisfy peer of DEP(v1) but override has priority
    - PEER(v2)

Flattened:

- ROOT(v1)
- DEP(v1)
- PEER(v1)
- PEER(v2)

*[--> back to top -->]*


#### ResolutionExample F: Inherited Overruled *(disabled)* override

```ts
ROOT = {
  v: '1',
  deps: { DEP: 'v1' },
  peersMeta: { DEP: { PEER: 'v2' } }
}

DEP = {
  v: '1',
  deps: { SUB_DEP_L1: 'v1' },
  peers: { PEER: 'v1' }
}

SUB_DEP_L1 = {
  v: '1'
  deps: {
    SUB_DEP_L2: 'v1',
    PEER: 'v1'
  }
}

SUB_DEP_L2 = {
  v: '1'
  deps: {
    DEP: 'v1',
  }
}

PEER = {
  v: '1'
}
PEER = {
  v: '2'
}
```

- ROOT(v1)
  - DEP(v1) --> override tells arborist to use `PEER(v2)`
    - PEER(v2)
    - SUB_DEP_L1(v1)
      - PEER(v1) --> leverages override specified in Root
      - SUB_DEP_L2
        - DEP(v1) *(re-used)* --> inherits acceptable peer to use
          - PEER(v1) *(re-used)*


Flattened:
*(resulting shape is the same as in Ex.C but this time PEER(v1) was inferred
instead of defined)*

- ROOT(v1)
- DEP(v1)
- PEER(v2)
- SUB_DEP_L1(v1)
- PEER(v1)
- SUB_DEP_L2(v1)

*[--> back to top -->]*


## Implementation

**Awaiting *any* kind of Green-Lighting, this section is subject to change and
will evolve with discussion of this RFC and the ongoing, *unofficial*
implementation work. If and once a basic approval is given, it will become more
definite**

The following sections will include links to relevant source-code of the
[aforementioned] [Arborist Fork]. These links may occasionally fall out of sync
as work progresses. The code they reference is **subject to change**

*[--> back to top -->]*

[aforementioned]:<#preliminary-work-on-unofficial-implementation>


### State of the Arborist Fork

Current *(as of 22 Aug 20)* implementation work encompasses:
*(subject to change)*

- complete removal of [optional peers].
- implementation of the [basic fixtures necessary] for peer overrides.
- [inheritance of overrides] based on the logic [described above].
- [substitution mechanism] of peers
- implementation of the [new ```peerOverride``` type]
- some very [bare-bones test coverage]

***STATE:** The implementation [appears to be][bare-bones test coverage] fully functional*

[inheritance of overrides]:<#inheritance-and-resolution-of-special-spec-local>
[basic fixtures necessary]:<#class-extensions>
[optional peers]:<#removalreplacement-of-existing-peeroptional-hooks-and-type>
[substitution mechanism]:<#peer-swap-in-_loaddeps-method-of-class-node>
[new ```peerOverride``` type]:<#type-peeroverride-in-class-edge>
[bare-bones test coverage]:<#test-coverage>
[described above]:<#inheritance-logic>

*[--> back to top -->]*


### removal/replacement of existing ```peerOptional``` hooks and type

***subject to change***
[reasoning: see](#alternative-f-mentioned-in-rfc-0025)

Currently *(as of 22 Aug 20)* all hooks and fixtures relating to optional-peers
have been either removed, disabled or --where appropriate-- replaced with the
peer-override equivalent. A description of what that encompasses follows.

*[--> back to top -->]*


#### Pre-Existing Code affected by Removal of ```peerOptional```

- ```class Node```
  - removed hook in ```_loadDeps``` method
- ```class Edge```
  - adjusted getters appropriately
- ```class AuditReport```
  - adjusted ```toJSON``` method appropriately
- ```add-rm-pkg-deps.js```
  - removed hooks and special save type in the functions ```removeFromOthers```,
    ```addSingle``` and ```getSaveType```

*[--> back to top -->]*


### Class Extensions

Besides the aforementioned modifications, the following fixtures were added.

*[--> back to top -->]*


#### ```class Edge```

Added convenience getter `override` *(could be used by [RFC-overrides] as well)*
[code](https://github.com/KilianKilmister/arborist/blob/916ebb6a5a9a1a8c96aa5c1301bf891ac122e85e/lib/edge.js#L88-L88)

```ts
interface Edge {
  get override () { return this[_type] === 'peerOverride' /* || this[_type] === `override` */ }
}
```

*[--> back to top -->]*


#### ```class Node```

In line with the existing practices Added ```unique symbol``` and
getter ```peerDependenciesMeta``` holding the processed override-mapping.
[code](https://github.com/KilianKilmister/arborist/blob/916ebb6a5a9a1a8c96aa5c1301bf891ac122e85e/lib/node.js#L927-L927)

```ts

declare const _peerDependenciesMeta = Symbol('_peerDependenciesMeta')

interface Node {
  [typeof _peerDependenciesMeta]: PeerDepsMeta

  get peerDependenciesMeta () { return this[typeof _peerDependenciesMeta] }
}
```

*[--> back to top -->]*


### Inheritance logic and resolution of special spec *`local`* via the helper ```PeerDepsMeta```

[code](https://github.com/KilianKilmister/arborist/blob/916ebb6a5a9a1a8c96aa5c1301bf891ac122e85e/lib/peerOverride.js#L7-L107)


During construction of a node, the special install specifier *`local`* is
replaced with the specifier of the corresponding package in defined in
(dev-)dependencies.

The [Inheritance Logic](#inheritance-logic) is applied here.

**NOTE:** this will be *used by it's children*, the package itself will
**always** use the overrides specified by in the parent-node, as those are the
relevant overrides.

Typescript representation:

```ts
import npa  from 'npm-package-arg'
import fromPath  from './from-path.js'
import semver from 'semver'
import {relative}  from 'path'

import type Node from './node.js'

export default class PeerDepsMeta extends Map<string, Map<string, PeerOverride>> {
  constructor (node: Node) {

    const {
      package: {
        dependencies: deps = {},
        devDependencies: devDeps = {},
        peerDependenciesMeta: peerDepsMeta = {},
      },
      parent,
    } = node
    const parentPeerDepsMeta = Object(parent).peerDependenciesMeta || []

    super()

    // iterate over parent peerDepMeta
    for (const [dep, peers] of parentPeerDepsMeta) {
      // try to get the corresponding entry in your own package.peerDependenciesMeta
      const ownOverrides = peerDepsMeta[dep] || {}
      // create a store
      const overrideHash = new Map()
      // iterate over the peer overrides in the parent peerDepMeta
      for (const [peer, override] of peers) {
        switch (true) {
          // 1. if you have an override for that peer: use that
          case peer in ownOverrides:
            overrideHash.set(peer, formOverride(peer, ownOverrides[peer]))
            break
          // 2. if you have own deps that satisfies the original request: discard override
          case canOverrule(peer, override.origSpec, node):
            break
          // 3. if not 1. or 2.: inherit the override
          default:
            overrideHash.set(peer, override)
        }
      }

      // no need to save an empty hash
      if (overrideHash.size) this.set(dep, overrideHash)
    }

    //*______
    //* helpers
    function formOverride (origPackage: string, spec: string | { [dep: string]: string }) {
      const [overridePackage, overrideSpec] =
        typeof spec === 'string'
          ? [origPackage, spec]
          : Object.entries(spec)[0] // should only have one entry
      if (overrideSpec === 'local')
        overrideSpec = deps[overridePackage] || devDeps[overridePackage]
      return {
        overridePackage,
        overrideSpec
      }
    }

    /**
     * * NOTE: stripped down copy of `./deps-valid.js`
     */
    function canOverrule (name: string, spec?: string): boolean {
      if (!spec) return false
      try {
        const requested = npa.resolve(name, spec, fromPath(node))
        switch (requested.type) {
          case 'range':
            if (requested.fetchSpec === '*')
              return true
            // fallthrough
          case 'version':
            // if it's a version or a range other than '*', semver it
            return semver.satisfies(name.package.version, requested.fetchSpec, true)

          case 'directory':
            // directory must be a link to the specified folder
            return !!name.isLink &&
              relative(name.realpath, requested.fetchSpec) === ''

          case 'alias':
            // check that the alias target is valid
            return canOverrule(name, requested.subSpec)
          default:
            return false
        }
      } catch {
        return false
      }
    }
  }
}


//____________
//* helper types

// definition of an override
interface PeerOverride {
  origSpec: string // resolved in `Node[_loadDeps]`
  overrideSpec: string
  overridePackage: string
}
```

*[--> back to top -->]*


### Peer-Swap in ```_loadDeps``` method of ```class Node```

[code](https://github.com/KilianKilmister/arborist/blob/916ebb6a5a9a1a8c96aa5c1301bf891ac122e85e/lib/node.js#L428-L458)

The existing ```peerOptional``` hook is replaced with the peer-swapping
mechanism:

for each of your peers:

- if **you** are referenced in the ```peerDependenciesMeta``` of **your parent**
  - check if **your peer** is referenced in that entry.
    - if so: do a swap.
      - if a an install specifier is referenced, swap it in.
      - if a substitute package is referenced: exchange both peer-name and spec
        with the referenced package.
    - if not, continue normally
- if a peer was replaced, pass it to the ```_loadDepType``` method with
  ```type: 'peerOverride'```.
- otherwise pass it to ```_loadDepType``` method with ```type: 'peer'```
  as usual.

*[--> back to top -->]*


## Prior Art and Alternatives


### ```--legacy-peers``` command line flag

NPM v7-beta includes the command line flag ```--legacy-peers``` which will cause
it to fall back to the v6 behavior with peers. While this does solve these
issues, it is very much a patchwork solution, as v6 peer behavior is essentially
not doing anything at all. This forfeits all the improvements arborist is trying to make.

This flag is also applied on a global level, and such will be applied to
**every** package in the tree, regardless of its peer-compliance. This could
enable a package to float in a limbo of non-compliance, which might be difficult
to ever escape from.

This RFC aims at giving authors a way to alter peer resolution **on their level
only**, and not only letting packages higher up the tree take full advantage of
arborists improvements, but also have overrides fully integrated into the tree
and enjoying those same features.

In addition, the command line flag effectively acts as a catch-all, which could
encourage people to include it by default, potentially poisoning the ecosystem
to not benefit from some of the improvements made in npm v7

*[--> back to top -->]*


### Alternative F mentioned in RFC-0025

*this is implemented in the npm beta-v4*
*[link](https://github.com/npm/rfcs/tree/latest/accepted#f-use-peerdependenciesmeta-to-trigger-auto-install)*

I don't think that the author should specify which peer-deps get auto installed
and which don't. This could possibly lead to similar user-confusion and
resulting (re-)moval of peer-deps as we are seeing it now. I think the decision
to include a peer-dep should be declarative, and being able to make a peer-dep
defacto optional defeats the purpose, as it could just as well be filed as an
optional dep with a note in the projects README.

If anything, all optional dependencies should be handled like the
```peerOptional``` implementation, but this topic is out of scope of this
**RFC**

*[--> back to top -->]*


### Using a different field-name

Any field-name could of course be used, but since i take issue with [the current
usage] of ```peerDependenciesMeta```, i would prefer replacing that all
together.

[the current usage]:<#removalreplacement-of-existing-peeroptional-hooks-and-type>

*[--> back to top -->]*


### Proposed RFC: overrides

*[link][RFC-overrides]*

Similar in nature, but way more general, affecting all dependencies and with
nesting overrides

[Discussed in detail above](#in-regards-to-the-existing-overrides-rfc)

*[--> back to top -->]*


### RFC-0023

[link][RFC-0023]

Similar in nature, but again more general. The inheritance of peer-overrides
would potentially also allow for more deduplication but the degree would very
much depend on individual project structure as the proposed inheritance model
primarily aims to be save.

Focusing on [it's Alternatives section]:

> 1. resolutions field of yarn.
> 2. System-wide .npmresolutions to allow global upgrade / remapping to specific versions.
> 3. Proposed overrides field of npm (ref #39)
>
> All of these options can be more powerful than the idea of acceptDependencies.
> The with resolutions and .npmresolutions is that they would only work if users
> of a module determine that the dependency can and should be upgraded. This can
> result in footguns, takes control out of the maintainers hands. overrides
> shifts the authority from users to module authors but would require
> introducing condition expansion into package-lock.json.

Peer-overrides would also form a powerful tool, while --like `overrides`--
shifts responsibility to module authors.

Although both peer-overrides and acceptDependencies could be used to aid the
other ones cause to some extent, their individual motives are on the exact
opposite of the spectrum.

AcceptDependencies rations: ability to specify a broader range of accepted
versions may help in allowing far back compatibility, mentioning node v4.x and
v6.x (having reached EOL in 2015 and 2016 respectively).

peer-overrides rational: ability to override requested peers with alternative
version ranges or substitute modules can help in avoiding dependency-hell and is
necessary to stay ahead of the curb, as very few packages allow the use of
pre-releases for their requested peers, mentioning typescript v4.1 and
referring to ESnext/es2021 (TSv4.1 and node-v15 scheduled for november 2020).

And while --as mentioned-- peer-overrides could potentially aid in far-back
engine support, it is **not** a goal of this RFC


[it's Alternatives section]:<https://github.com/npm/rfcs/blob/latest/accepted/0023-acceptDependencies.md#alternatives>

*[--> back to top -->]*


## Unresolved Questions and Bikeshedding


### Potentially Emit Warning

Potentially have npm emit a ***short*** message about overrides specified in the
top-level package and how those could cause unpredictable behavior.

This could potentially lower the amount of false bug-report being filed that
originated from those overrides.
But they should not trickle down the tree, so they are only shown to the user
who defined the overrides.

I would very much prefer them to be as short as possible, so they don't fill up
the terminal like in v6. They don't have to display as much information either,
as the person who specified them is aware of them already/can easily check.

Something along the lines of:

```plain text
npm WARN Peer-Overrides have been specified. This could lead to unpredictable behavior in the affected modules.
```

*[--> back to top -->]*


### Implement a separate save-type for ```peerOverrides``` if needed

```peerOptional```implemented a different save-type so they would be
appropriately handled by npm. Currently i don't see any need for a save-type for
```peerOverrides```. currently they are handled exactly like any other peer,
effectively just as if the substitute-package was requested by the dependency
to begin with.

Hooks for checking wether a package is an override and for counting and
collecting overrides are already in place, so more effects could react to those
directly.

if there is a need for a separate save-type, it could be implemented easily
enough

*[--> back to top -->]*


### Using a different field-name

[discussed above]:<#removalreplacement-of-existing-peeroptional-hooks-and-type>

*[--> back to top -->]*


## Foot-Notes


### Test Coverage of the fork

***NOTE:** I've been using esm since node-v13 dropped and I've recently become a
TypeScripter so it **is possible** that i missed mistakes which would usually be
uncovered by their convenience.*

Currently *(as of 22 Aug 20)* the [Arborist Fork] passes **every** test that is
*not based on **pre-existing** snapshots*. I'm not very familiar with the
testing framework, so i have not been able to do all the necessary adjustments.

Some very basic tests have been added including a few fixtures in the
template-repo, but my understanding of the project isn't comprehensive enough to
include more extensive tests.

*[--> back to top -->]*


### References

[original RRFC][#204]
[RFC-overrides]
[RFC about installing peer-deps][RFC-0025]

[#204]:<https://github.com/npm/rfcs/issues/204>
[RFC-0025]:<https://github.com/npm/rfcs/blob/latest/accepted/0025-install-peer-deps.md>
[RFC-0023]:<https://github.com/npm/rfcs/blob/latest/accepted/0023-acceptDependencies.md>
[RFC-overrides]:<https://github.com/npm/rfcs/blob/isaacs/overrides/accepted/0000-overrides.md>
[Arborist Fork]:<https://github.com/KilianKilmister/arborist>
[--> back to top -->]:<#peer-dependency-overrides>
