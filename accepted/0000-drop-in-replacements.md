# Drop In Replacements

## Summary

This proposal introduces the ability to mark packages compatible as drop-in-replacements, or packages which can be used in place of another package.

## Motivation

Replacing and updating outdated dependencies is difficult, ensuring nested dependencies are the latest and most-maintained version is basically impossible.

Users need a way to find old and outdated packages in their own package.json file, they also need to be able to replace packages that may have bugs or may not fit their needs, with another package, regardless of the dependency depth.

It may be difficult to find repositories or packages that can function as drop-in replacements, allowing minimal upgrade headache, nor is there a way to specify a drop-in for a dependency's dependency.

Outdated packages are often forked, updated, their security bugs fixed, new features/more documentation could be added, etc. If a user makes a project a fork of an existing one, or if they deliberately have the same api as another package, there is no way to communicate this compatibility to other developers.

#### This proposal explicitly seeks to help users find packages that are drop-in replacements for another package.

#### It does not seek to add aliasing regardless of depth, or help users find unmaintained packages.

## Detailed Explanation

### Marking Packages as Compatible

The key to this feature is the ability to mark packages as compatible.
 
This is expected to be a flag set by a package's author in their own package.json.

This flag, or package.json entry should be able to indicate:

 * Earliest version {{currentPackage}} is a suitable drop-in for. - Chosen by author
 * Latest version {{currentPackage}} is suitable drop-in for. - Chosen by author
 * Type of compatibility - whether or not the package is a direct fork. 
 * isFork (optional) - detected/verified by npm CLI / by npm site on publish or repository location change. 
  
#### package.json attributes: `compatibleWith`. `forkOf`, or `dropInFor`

No changes on the part of the package being replaced should required.

 `package.json` additions:

```
  "compatibleWith": {
    "package":    "blessed",
    "isFork":     true,
    "minVersion": "^0.0.1",
    "maxVersion": "^1.0.0",
    "forkedFrom": "https://github.com/chjj/blessed@0.1.0"
  }
  "preferGlobal": false,
  "repository": "git://github.com/dwood15/blessed.git",
```

### package-lock.json attribute

 *  Is a package-lock.json flag/attribute necessary?
 
 
## Rationale and Alternatives

 * Searching Github or another website for forks which are decently maintained is a less-than-pleasant experience.
 
Npm does not currently allow searching for packages based on compatibility.

First-class Aliasing support only works on a per-project, top-level basis, and so if my issue is multiple levels down the dependency tree, I have to go one above the defective dependency, do #3 where the fix is to alias the package, and then re-publsh the repository to npm's registry.

This solution encourages users to pick up and update old packages by making it easier or others to find their better-supported/more commonly updated modules. It also encourages users to be more proactive with respect to security and semantic versioning. 

## Implementation

The development phase of a project or package should be all that's really marked, as this feature is scaffolding for search as well as additions to an implementation feature.

## Prior Art

As far as I know, no dependency management tool offers this feature. 

The closest is git's "fork of", but navigating that feature in large and commonly-used repositories to find active and currently-maintained offshoots of a package is nigh-impossible.

## Unresolved Questions and Bikeshedding

### Short story//Disclaimer//Prior Art(?)

I used chjj's blessed repository for minor personal projects in linux. The repository is stable, does what it intended to do, and is relatively speedy.

On the other hand, the repository (as of May 2. 2018) hasn't been updated in 3 years, and has only been accumulating PR's and Issues.

After forking, I integrated a number of open pull requests from chjj/blessed's repo and fixed some dependency problems, giving blessed Windows support. 

My package, has had virtually no traffic despite resolving some bugs and incompatibilities with Windows, making more of blessed work out of the box with the OS.

Renaming the package and striking out on a different lane wasn't the goal - I had nothing unique to offer other than being willing to integrate a few PR's and fix some bugs. 

The repository owner has not responded to my email or any other comment. In the end, I made my own account and package on the registry. The ordeal felt pretty wasteful.


### The fridge - These items may need a little more time to bake.

#### Finding Drop-In Replacements

A few options for helping users find drop-in replacements. 
 
 1) Notice/tab on a package page that is relatively unmaintained indicating a package has been forked.
    1) Tab/notice should bring up a list of compatible pkgs/forks, ordered by some combination of  code quality/security/maintenance metrics.
 2)
 
#### The `forkOf` package.json attribute

  `'forkOf': '<outdated>@<version>'`
  
  Indicates the version of `<outdated>` which was forked, and, consequently, the last version of `<updated>` which is an exact copy of `<outdated>`'s version tag. Easily verified via sha1 checksum comparisons.
