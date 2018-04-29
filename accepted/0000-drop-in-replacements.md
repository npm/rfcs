# Drop In Replacements

## Summary

This proposal introduces to npm the concept of marking packages compatible as drop-in-replacements, in place of another package.

## Motivation

As npm has grown, many packages have been created, developed, and quite a few, even popular packages, have been abandoned completely. They, or even their dependencies become outdated as both npm and nodejs progresses and updates their respective api
's. These packages, or their dependencies which are similarly abandoned, may have security issues.

Often times, these outdated packages/dependencies have been forked, updated, their security bugs fixed, new features/more documentation.

On top of this, it may be difficult to find repositories or npm packages that function as drop-in replacements allowing minimal upgrade headache, nor is there a way to specify a drop-in for a dependency's dependency. 

This proposal seeks to help npm users:

Find out how old their dependencies (and those dependency's dependencies) are.
Find packages which can function drop-in replacements for another, outdated package
Explicitly use an alternative/fork of a package in place of another, regardless of how deep the modules tree they need to go.

While a package's number of, or most recent updates list is not a positive indicator of a package's security, showing users and organizations packages which are no longer being maintained, and helping them find drop-in replacements can help them be more proactive in tracking down bugs, security issues, and keeping up-to-date with the latest browser, node, npm features and optimisations.

## Detailed Explanation

### Finding Unmaintained packages - `npm audit` flags

#### `npm audit --unmaintained`

Output: Display packages of concern in gridlike fastion, ordered firstly by potential security severity, then, by the time of the most recent git commits//updates to the npm site's package. 

Only packages that haven't been updated in > X months ago are shown, where X is some arbitrary number chosen based on a metric, such as node/npm lts cycles. 

Causes npm to poll the site/registry/github for all package the current package/repository depends on, and attempts to find compatible repositories of the current package. 

Formula to order packages is based on a combination of the potential security threat of relying on a particular unmaintained packages could be and npm package + git activity. Low package + git activity are shown first, where higher activity packages are shown last.

Example:

``` 
$ npm audit --unmaintained
      === npm audit report of unmaintained dependencies === 
      
# Run `npm audit <package-name> --find-forks` to find active forks of this package, or, instead:
# `npm audit <package-name> --drop-ins` to find packages marked as drop-ins of this package.
# To see a module in this repository's tree, use: `npm ls <package-name>`
┌──────────────────┬─────────────┬───────────────┬─────────────────────┬───────────────────┐
│ Package Name     │ Last Update │ Sec. Severity │ Dependency of       │  Dependency-Depth │
├──────────────────┼─────────────┼───────────────┼─────────────────────┼───────────────────┤
│ http-proxy-agent │ Apr 4, 2017 │ High          │ npm-profile         │                 3 │
├──────────────────┼─────────────┼───────────────┼─────────────────────┼───────────────────┤
    (...)
├──────────────────┼─────────────┼───────────────┼─────────────────────────────────────────┤
│ blessed          │ Jan 4, 2016 │ Low           │ <Current Module>    │                 0 │
└──────────────────┴───────────────────────────────────────────────────────────────────────┘
```

### Finding Drop-In Replacements

### Additions & Changes to `npm install`

Unless indicated otherwise, npm's Standard Operating Protocol, or (SOP) for versioning and dependency resolution should remain the same.

The new `npm install` flags are as follows:  

`npm install <package@version> --replace=<outdated> --deep` 

#### `<package@version>` 

Essentially the same as a regular install, except `package` is either:

1) A direct fork of `<outdated>`, as indicated by git, with the `package.json` attribute `"forkOf":`, described below.

Or:
  
2) A package with a `package.json` containing a `"replaces":` attribute , described below.

#### `--replace=<outdated>` 

Tells npm to install this module as a replacement for top-level references (all manually-installed modules) whose versions requirements on <outdated> map with <package>. 
  
If `<package@version>`'s versioning does not match with `<outdated>`, npm should emit an error, such as:

```Installation Error! Replacement Package: <outdated> is not marked as a replacement for <outdated> ```
  
#### `--deep-replace` or `--deep` 

`--deep` tells npm to attempt to resolve all references to `<outdated>` to be resolved to `<package>`. regardless of depth.

Should a dependency specify their own `"replace":` package.json, `--deep` or `--deep-replace` will prefer the current user's package, regardless of the package's lockfile. If the dependency's versioning is not marked as compatible. In such cases, npm will use standard versioning and dependency protocol.

If `--deep`  or `--deep-replace` is specified and `--replace=<outdated>` is not, npm should emit an error such as: 

```--deep-replace does not make sense without --replace=<package-to-replace>```

### Changes to package.json and registry

Additional attributes for package.json files, package-lock.json, and npm's registry.

#### The `forkOf` package.json attribute

  `'forkOf': '<outdated>@<version>'`
  
  Indicates the version of `<outdated>` which was forked, and, consequently, the last version of `<updated>` which is an exact copy of `<outdated>`'s version tag. 
  
  Side note: Up to this point, all commit sha's will likely have the the exact same signatures. 

#### package.json, registry attributes: `forkOf`, `dropInFor`

No changes on the part of the package being replaced should required.

Forked (updated/maintained) `package.json`:
```
  "name": "dwood15/blessed",
{{ ... }}
  "replaces": {
    "package":"blessed",
    "isFork": "true",
    "minVersion": "^0.0.1",
    "maxVersion": "^0.0.1",
    "forkedFrom": "https://github.com/chjj/blessed@0.1.0"
  }
  "preferGlobal": false,
  "repository": "git://github.com/dwood15/blessed.git",
{{...}}
```

### package-lock.json attribute

... Is a package-lock.json flag/attribute actually necessary? 

During a regular install, while npm resolves dependencies, npm references the package-lock.json and checks 
For recording exact versioning and dependency replacement. 

## Rationale and Alternatives

1) Symlinking

Requires the most effort on the part of the user. 

2) Package Aliasing

Package aliasing may work as drop-in replacement, but doesn't solve majority of the issues with outdated npm packages/dependencies.

Scope is limited. Does not allow finding outdated dependencies regardless of depth, nor does it allow to search npm for potential replacements of an outdated package

3) Fork outdated repository, apply fixes, add to npm registry, then npm install updated repository.

This is the most common methodology of fixing bugs in outdated repositories, but requires more steps the further down the dependency tree a user has to go.

It's a lot of steps to fork an outdated repository, apply the fixes, add the new package by npm install <new-fork>. This creates a silly number of repositorys to have to wade through when searching the repository, and only exacerbates the issues of outdated repositories. We end up with a massive number of forked packages which fix that user's specific bug, and then the new package is never updated again.

---

First-class Aliasing support only works on a per-project, top-level basis, and so if my issue is multiple levels down the dependency tree, I have to go one above the defective dependency, do #3 where the fix is to alias the package, and then re-publsh the repository to npm's registry.

This solution, while the most complex, encourages users to pick up and update old packages by making it easier or others to find their better-supported/more commonly updated modules. It also encourages users to be more proactive with respect to security and semantic versioning. 

## Implementation

{{Give a high-level overview of implementaion requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

## Prior Art

{{This section is optional if there are no actual prior examples in other tools}}

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}

As far as I know, no dependency management tool offers features like this.

## Unresolved Questions and Bikeshedding

To what extent can a user solve these issues,

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
