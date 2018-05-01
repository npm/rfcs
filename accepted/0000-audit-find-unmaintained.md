# Drop In Replacements

## Summary

This proposal introduces to npm the concept of marking packages compatible as drop-in-replacements, in place of another package.

## Motivation

Many packages have been created, developed, and quite a few, even very popular packages have been abandoned. They or even their dependencies may become outdated or non-functioning as both npm and 
nodejs progress and updates their respective api's. While there is such a thing as feature-complete, the progression of the platforms can introduce bugs as features get marked for deprecation or 
even removed. Additionally, these unmaintained repositories may have unresolved bug or security issues.

Developers may find themselves using relatively up-to-date packages, but this does not mean their dependency tree is entirely maintained, either.

On top of this, it may be difficult to find repositories or npm packages that can function as drop-in replacements for developers to have minimal headaches when trying to upgrade from out of date 
code.

This proposal seeks to help npm users:

Find out how old their dependencies (and those dependency's dependencies) are.

Searching for packages which can function as drop-in replacements for another, outdated package, is outside the scope of this RFC.

While a package's number of commits, or most recent updates list may not necessarily be a positive indicator of a package's security, showing users and organizations packages which are no longer 
being maintained can help more package maintainers be actively engaged in maintaining the security of their package.json, and therefore, their website, or nodejs applications.

## Detailed Explanation

### Finding Unmaintained packages - the `npm audit unmaintained` subcommand.

Output: Display packages of concern in grid-like fashion, ordered firstly by potential security severity, then, by the time of the most recent git commits//updates to the npm site's package. 

Only packages that haven't been updated in > X months ago are shown, where X is some arbitrary number chosen based on a metric, such as node/npm lts cycles. 

Causes npm to poll the site/registry/github for all package the current package/repository depends on, and attempts to find compatible repositories of the current package. 

Formula to order packages is based on a combination of the potential security threat of relying on a particular unmaintained packages could be and npm package + git activity. Low package + git activity are shown first, where higher activity packages are shown last.

Example grid is under Implementation.

## Rationale and Alternatives

 No known _direct_ alternative exists which directly allows searching through a dependency tree for unmaintained packages.

1) Tangentially related, npms.io provides the closest functionality:
     1) The site  presents the user with several metrics when browsing functionality. see: https://npms.io/about
        1) Quality
        2) Maintenance
        3) Popularity
        4) Personalities (not currently implemented)
 See: https://github.com/npms-io/npms-analyzer/blob/master/lib/scoring/score.js#L70 for more specific implementation information of the scoring properties.
   
2) Perform an `npm update` to ensure all packages are at their latest, then manually search github and the npm registry for current 
versions of packages which did not get updated.
 
In response to #1, npms.io provides no analysis of a package's dependencies, regardless of depth. Using the site in combination with #2, is still an incredibly tedious process.

Option #2 is likely only reasonable for top-level packages, and the chance that some companies or developers already do this manually is quite high.

## Implementation

The `npm audit unmaintained` command could be implemented either as a flag, or as a subcommand. As a subcommand, this would likely be the most convenient to implement and maintained, as it could 
then follow its own code paths and implementation.

The largest issue with this report, is being able to balance the security threat, quality, and most maintenance level of a package. A formula which balances those three points effectively is 
desirable.

``` 
$ npm audit unmaintained
      === npm audit report of unmaintained dependencies ===
      
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

## Prior Art

As far as I know, no dependency managers/cli tools offer a report which specifically tags/targets unmaintained repositories.

## Unresolved Questions and Bikeshedding

 * I don't really know Javascript nor npm's codebase very well, so I'm relying on community help to refine this RFC.
    * Shoutout to iarna for letting me bounce this idea off them.

 * A long-outdated scrollbar package is likely lower priority than a similarly-outdated database provider. 
   * Extra commits to an encryption package may introduce security flaws.
 
 * User could be notified when installing an unmaintained package for the first time. 
   * ``This Package hasn't been updated in >1 year! Are you sure you wish to install? ``

 * Additional ideas: 
 
 ```# Run `npm audit <package-name> --find-forks` to find active forks of this package, ord:
    # `npm audit <package-name> --drop-ins` to find packages marked as drop-ins of this package.```
 
 * While security is listed as the main motivator, packages that haven't been updated in 3+ years are often still popular when there are updated forks of these packages which have integrated bug 
 fixes, pull requests, and other features, but the primary package is still what's shown at the top of npmjs's repository. 
   * In another RFC I intend to submit, I will suggest the ability to find forks and other packages, for use in place of packages flagged by audit unmaintained. 

 * My search for Prior art and alternatives was rather limited.
