# `npm query` Command & Dependency Selector Syntax

## Summary

Introduce a new `npm query` commmand which exposes a new dependency selector syntax (informed by & respecting many aspects of the [CSS Selectors 4 Spec](https://dev.w3.org/csswg/selectors4/#relational)).

## Motivation

- Standardize the shape of, & querying of, dependency graphs with a robust object model, metadata & selector syntax
- Leverage existing, known language syntax & operators from CSS to make disparate package information broadly accessible
- Unlock the ability to answer complex, multi-faceted questions about dependencies, their relationships & associative metadata
- Consolidate redundant logic of similar query commands in `npm` (ex. `npm fund`, `npm ls`, `npm outdated`, `npm audit` ...)

## Detailed Explanation

This RFC's spec & implementation should closely mimic the capabilities of existing CSS Selector specifications. Notably, we'll introduce limited net-new classes, states & syntax to ensure the widest adoption & understanding of paradigms. When deviating, we'll explicitely state why & how.

## Implementation

- `Arborist`'s `Node` Class will have a new `.querySelectorAll()` method
  - this method will return a filtered, flattened dependency Arborist `Node` list based on a valid query selector
- Introduce a new command, `npm query`, which will take a dependency selector & output a flattened dependency Node list (output is in `json` by default, but configurable)

### Dependency Selector Syntax

#### Overview:

- there is no "type" or "tag" selectors (ex. `div, h1, a`) as a dependency/target is the only type of `Node` that can be queried
- the term "dependencies" is in reference to any `Node` found in the `idealTree` returned by `Arborist`

#### Selectors
    
- `*` universal selector
- `#<name>` dependency selector (equivalent to `[name="..."]`)
- `#<name>@<version>` (equivalent to `[name=<name>]:semver(<version>)`)
- `,` selector list delimiter
- `.` class selector
- `:` pseudo class selector
- `>` direct decendent/child selector
- `~` sibling selector

#### Pseudo Selectors
- [`:not(<selector>)`](https://developer.mozilla.org/en-US/docs/Web/CSS/:not)
- [`:has(<selector>)`](https://developer.mozilla.org/en-US/docs/Web/CSS/:has)
- [`:where(<selector list>)`](https://developer.mozilla.org/en-US/docs/Web/CSS/:where)
- [`:is(<selector list>)`](https://developer.mozilla.org/en-US/docs/Web/CSS/:is)
- [`:root`](https://developer.mozilla.org/en-US/docs/Web/CSS/:root) matches the root node/dependency
- [`:scope`](https://developer.mozilla.org/en-US/docs/Web/CSS/:scope) matches node/dependency it was queried against
- [`:empty`](https://developer.mozilla.org/en-US/docs/Web/CSS/:empty) when a dependency has no dependencies
- [`:private`](https://docs.npmjs.com/cli/v8/configuring-npm/package-json#private) when a dependency is private
- `:link` when a dependency is linked
- `:deduped` when a dependency has been deduped
- `:override` when a dependency is an override
- `:extraneous` when a dependency exists but is not defined as a dependency of any node
- `:invalid` when a dependency version is out of its ancestors specified range
- `:missing` when a dependency is not found on disk
- `:outdated` when a dependency is not `latest`
- `:vulnerable` when a dependency has a `CVE` 
- `:semver(<spec>)` matching a valid [`node-semver`](https://github.com/npm/node-semver) spec
- `:path(<path>)` [glob](https://www.npmjs.com/package/glob) matching based on dependencies path relative to the project
- `:realpath(<path>)` [glob](https://www.npmjs.com/package/glob) matching based on dependencies realpath
- `:type(<type>)` [based on currently recognized types](https://github.com/npm/npm-package-arg#result-object)

#### [Attribute Selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors)

The attribute selector evaluates the key/value pairs in `package.json` if they are `String`s.

- `[]` attribute selector (ie. existence of attribute)
- `[attribute=value]` attribute value is equivalant...
- `[attribute~=value]` attribute value contains word...
- `[attribute*=value]` attribute value contains string...
- `[attribute|=value]` attribute value is equal to or starts with...
- `[attribute^=value]` attribute value begins with...
- `[attribute$=value]` attribute value ends with...

#### `Array` & `Object` Attribute Selectors

The generic `:attr()` pseudo selector standardizes a pattern which can be used for attribute selection of `Object`s, `Array`s or `Arrays` of `Object`s accessible via `Arborist`'s `Node.package` metadata. This allows for iterative attribute selection beyond top-level `String` evaluation.

`Array`s specifically use a special `item` keyword in place of a typical attribute name. `Arrays` also support exact `valu`e matching when a `String` is passed to the selector. See examples below:

#### Example of an `Object`: 
```css
/* return dependencies that have a `scripts.test` containing `"tap"` */
*:attr(:scripts([test~=tap]))
```

#### Example of an `Array` Attribute Selection:
```css
/* return dependencies that have a keyword that begins with "react" */
*:attr(:keywords([item^="react"]))
```

#### Example of an `Array` matching directly to a value:
```css
/* return dependencies that have the exact keyword "react" */
/* this is equivalent to `*:keywords([value="react"])` */
*:attr(:keywords("react"))
```

#### Example of an `Array` of `Object`s: 
```css
/* returns */
*:attr(:contributors([email="ruyadorno@github.com"]))
```

### Classes

Classes are defined by the package relationships to their ancestors (ie. the dependency types that are defined in `package.json`). This approach is user-centric as the ecosystem has been taught to think about dependencies in these classifications first-and-foremost. Dependencies are allowed to have multiple classifications (ex. a `workspace` may also be a `dev` dependency & may also be `bundled` - a selector for that type of dependency would look like: `*.workspace.dev.bundled`).

- `.prod`
- `.dev`
- `.optional`
- `.peer`
- `.bundled`
- `.workspace`

### Command

#### `npm query "<selector>"` (alias `q`)

#### Options:

- `query-output`
  - Default: `json`
  - Type: `json`, `list`, `explain`, `outdated`, `funding`, `audit`, `duplicates`, `file`

#### Example Response Output

- an array of dependency objects is returned which can contain multiple copies of the same package which may or may not have been linked or deduped

```json
[
  {
    "name": "",
    "version": "",
    "description": "",
    "homepage": "",
    "bugs": {},
    "author": {},
    "license": {},
    "funding": {},
    "files": [],
    "main": "",
    "browser": "",
    "bin": {},
    "man": [],
    "directories": {},
    "repository": {},
    "scripts": {},
    "config": {},
    "dependencies": {},
    "devDependencies": {},
    "optionalDependencies": {},
    "bundledDependencies": {},
    "peerDependencies": {},
    "peerDependenciesMeta": {},
    "engines": {},
    "os": [],
    "cpu": [],
    "workspaces": {},
    "keywords": [],
    "ancenstry": "",
    "path": "",
    "realpath": "",
    "parent": "",
    "vulnerabilities": [],
    "cwe": []
    ...
  },
  …
```

#### Usage

```bash
npm query ":root > .workspace > *"  # get all workspace direct deps
```

### Extended Example Queries & Use Cases

```stylus
// all deps
*

// all direct deps
:root > *

// direct production deps
:root > .prod

// direct development deps
:root > .dev 

// any peer dep of a direct deps
:root > * > .peer  
  
// any workspace dep
.workspace

// all workspaces that depend on another workspace
.workspace > .workspace
    
// all workspaces that have peer deps
.workspace:has(*.peer)

// any dep named "lodash"
// equivalent to [name="lodash"]
#lodash 
  
// any deps named "lodash" & within semver range ^"1.2.3"
#lodash@^1.2.3
// equivalent to...
[name="lodash"]:semver(^1.2.3)

// get the hoisted node for a given semver range
#lodash@^1.2.3:not(:deduped)

// querying deps with a specific version
#lodash@2.1.5
// equivalent to...
[name="lodash"][version="2.1.5"]
  
// all deps living alongside vulnerable deps
*:vulnerable ~ *:not(:vulnerable)

// has any deps
*:has(*)

// has any vulnerable deps
*:has(*:vulnerable)

// deps with no other deps (ie. "leaf" nodes)
*:empty

// all vulnerable deps that aren't dev deps & that aren't vulnerable to CWE-1333
*:vulnerable:not(.dev:cwe(1333))
  
// manually querying git dependencies
*[repository^="github:"],
*[repository^="git:"],
*[repository^="https://github.com"],
*[repository^="http://github.com"],
*[repository^="https://github.com"],
*[repository^="+git:..."]
  
// querying for all git dependencies
*:type(git)

// find all references to "install" scripts
*[scripts=install], 
*[scripts=postinstall],
*[scripts=preinstall]

// get production dependencies that aren't also dev deps
.prod:not(.dev)
    
// get dependencies with specific licenses
*[license="MIT"], *[license="ISC"]

// find all packages that have @ruyadorno as a contributor
*:attr(:contributors([email=ruyadorno@github.com]))
```

## Next Steps

### Command Mapping to `query-output`

Previous commands with similar behaivours will now be able to utilize `Aborist` `Node.querySelectorAll()` under-the-hood & will fast-follow the `npm query` implementation.

#### `npm list`

```bash
npm list # equivalent to...
npm query ":root > *"

npm list --all # equivalent to...
npm query "*" --query-output list

npm list <pkg> # equivalent to...
npm query "#<pkg>" --query-output list
```

#### `npm explain`

```bash
npm explain <pkg> # equivalent to...
npm query "#<pkg>" --query-output explain
```

#### `npm outdated`

```bash
npm outdated # equivalent to...
npm query ":root > *:outdated" --query-output outdated

npm outdated --all # equivalent to...
npm query "*:outdated" --query-output outdated
```

#### `npm fund`

```bash
npm fund # equivalent to...
npm query ":root > *[funding]" --query-output funding

npm fund --all # equivalent to...
npm query "*[funding]" --query-output funding

npm fund <pkg> # equivalent to...
npm query "#<pkg>" --query-output funding
```

#### `npm audit`

```bash
npm audit # equivalent to...
npm query ":root > *:vulnerable" --query-output audit

npm audit --all # equivalent to...
npm query "*:vulnerable" --query-output audit

npm audit <pkg> # equivalent to...
npm query "#<pkg>" --query-output audit
```

#### `npm find-dupes`

```bash
npm find-dupes # equivalent to...
npm query "*:deduped" --query-output duplicates
```

#### `npm view`

```bash
npm view # equivalent to...
npm query ":root" --query-output view

npm view <pkg> # equivalent to...
npm query "#<pkg>" --query-output view
```

## Commands _could_ read from `stdin`

In a future RFC, & major version bump, `npm` could begin reading from `stdin` to chain commands together with a common understand of a dependency object. All of the below commands would add the ability to execute as if they were passed package specs (our current defulat representation of packages/dependencies).

```
audit, bugs, ci, config, deprecate, diff, dist-tag, docs, edit, exec, 
explain, explore, find-dupes, fund, get, install, install-ci-test, 
install-test, link, list, outdated, pack, pkg, prune, publish, rebuild, 
repo, restart, run-script, set, set-script, shrinkwrap, star, stars,
start, stop, team, test, token, uninstall, unpublish, unstar, update,
version, view
```

### Example of piping from `npm query` to other commands

```bash
# list workspaces w/ peer deps
npm query ".workspace:has(.peer)" | npm ls

# list outdated direct dev deps
npm query ":root > .dev:outdated" | npm outdated

# install the same dev deps across all workspaces
npm query ":root > .dev" | npm install --workspaces

# show audit details for dependencies with a specific vulnerability/CWE
npm query "*:cwe(1333)" | npm audit

# show audit details for vulnerable deps that aren't ReDoS dev deps
npm query "*:vulnerable:not(.dev:cwe(1333))" | npm audit
```

## Prior Art

- [`HTML`](https://html.spec.whatwg.org/) & [DOM](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model) Specifications
- [`CSS`](https://www.w3.org/Style/CSS/specs.en.html), [Selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors) & [Pseudo Class](https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-classes) Specifications
- AST Selector Libraries/Parsers
  - [`estree`](https://github.com/estree/estree)
  - [`abstract-syntax-tree`](https://www.npmjs.com/package/abstract-syntax-tree)
  - [`postcss-selector-parser`](https://www.npmjs.com/package/postcss-selector-parser) / [API](https://github.com/postcss/postcss-selector-parser/blob/master/API.md) 
  - [`css-selector-parser`](https://www.npmjs.com/package/css-selector-parser)
- [pnpm's `--filter`](https://pnpm.io/filtering) Flag
- [Gzemnid](https://github.com/nodejs/Gzemnid) Package Querying

## F.A.Q.
- Q. Is there any such thing as a bare specifier?
  - A. No. Unlike CSS Selectors, there's no `"element"`, or `"dependency"` in this context, equivalent. The selector syntax presuposes all entities are packages.
- Q. Should this syntax cover **all** possible queries of a dependency graph?
  - A. No. This spec is meant to provide a sufficently mature mechanism/building block for answering the majority of questions end-users have about their depndencies (re. 80/20 rule applies here)

## Unresolved Questions & Bikeshedding
- N/A
