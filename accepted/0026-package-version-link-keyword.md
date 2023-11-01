# Implement Special `link#[semver](comment)` Keyword for Package Version

## Summary

Allow package versions like `link#[semver](comment)` (comment is optional) to indicate that npm should `npm link` the given package AND that the version in `package.json` of the linked repo must fulfill the given semver. If the package is not found among existing npm links, or if the linked package doesn't match the given semver, npm should throw an exception and output the comment. For example:

```json
{
  "dependencies": {
    "my-dep": "link#^3.0.0",
    "nother-dep": "link#^5.15.0(clone github.com:cool-producer/nother-dep.git and check out branch great-improvements)"
  }
}
```

This syntax should be accepted in all places where versions are handled, including `package.json`, `package-lock.json`, `npm install [package-spec]`, and `npm link [package-spec]`.

## Motivation

It's quite frequent that we develop several individual code libraries in concert, often using libraries in development across several other independent projects. There are several ways to facilitate this, all with serious drawbacks. The methods we will NOT discuss here include a) using git refs; b) using lerna; and c) using local paths. None of these are adequate solutions for a variety of reasons (see subsequent sections).

The best way to handle the problem currently is by using `npm link`, but this has the following serious drawbacks:

* There's no way to communicate to other developers how to obtain the correct dependencies, since the target code has not yet been published. If a new developer were to clone your repo and run `npm install`, they would end up with broken code, since the system would obtain the dependency at an earlier, inadequate version (or not at all, if the dependency is new).
* They would furthermore have no way of knowing how to fix the problem.
* There's no way to enforce version conformance of linked repositories to ensure they fulfill the requirements. You can `npm link` any version of a package into your codebase and npm does no further checking on it.

## Detailed Explanation

This RFC proposes the addition of the special `link#[semver](comment)` syntax for specifying package versioning, where `[semver]` is optional and defaults to "latest" and `(comment)` is optional and defaults to null. On encountering such a version string, npm would do the following:

1. Check to see if the given package is already linked in the project.
    a. If package is linked, check its `package.json` to verify that the version that is linked fulfills the given version spec.
        i. If so, continue to step 3
        ii. If not, throw error with text, "The version of linked package [package-name] does not fulfill the required version [version]. Please fix. Comment: (comment, if given)".
    b. If package not linked, proceed to next step.
2. Check to see if the given package exists in the global npm directory.
    a. If package does exist, check its `package.json` file to verify that the version that is linked fulfills the given version spec.
        i. If so, link package into project and continue to step 3
        ii. If not, throw error with text, "The version of linked package [package-name] does not fulfill the required version [version]. Please fix. Comment: (comment, if given)"
    b. If not, attempt to download* package to global directory at given version (current functionality, with the addition of the new functionality for checking version).
        i. If found, download and re-enter loop at the top.
        ii. If not found, issue standard ENOENT or ENOTARGET error with the addition of the following text: "Package [package-name] is specified as 'linked'. You may need to clone it separately at version [semver] and run `npm link`. Comment: (comment, if given)"
3. If everything is good, output warning containing the specific version of the linked package along with the comment, if given, and move on. E.g., "Using linked dependency `[package name]` at version 5.15.1 for required version ^5.15.0. Comment: (comment, if given)".

\* Note: I strongly dislike the silent downloading of dependencies declared as links, but it is current functionality and I think it makes sense for this RFC to be as backward-compatible as possible.

### Example

Imagine we've just cloned a repo we're excited to contribute to. That repo has the following `package.json` file:

```json
{
  "dependencies": {
    "nother-dep": "link#^5.15.0(clone github.com:cool-producer/nother-dep.git and check out branch great-improvements)"
  }
}
```

Let's try to set it up:

```sh
# Clone it and try a basic npm install
cd ~/my-repos
git clone git@github.com:me/new-project.git
cd new-project
npm install
# npm tries to download `nother-dep` at ^5.15.0 but can't find it because this is a new branch of development
[ERROR] Package `nother-dep` is specified as 'linked'. You may need to clone it separately at
version ^5.15.0 and run `npm link`. Comment: "clone github.com:cool-producer/nother-dep.git and
check out branch great-improvements"

# Ok, we know exactly what to do.... but let's say we weren't paying that much attention
cd ~/my-repos
git clone https://github.com/cool-producer/nother-dep.git
cd nother-dep
npm link

# Now we've got the repo (but at the wrong branch). Let's try again
cd ../new-project
npm install
[ERROR] The version of linked package `nother-dep` does not fulfill the required version ^5.15.0.
Please fix. Comment: "clone github.com:cool-producer/nother-dep.git and check out branch
great-improvements"

# Oops! Go check out the right branch
cd ../nother-dep
jq .version package.json
"5.14.25"                             # << Not good enough
git checkout great-improvements       # << check out the branch they're telling us to
jq .version package.json
"5.15.1"                              # << Much better
npm link

# Try again
cd ../new-project
npm install
[WARNING] Using linked dependency `nother-dep` at version 5.15.1 for required version ^5.15.0

# Ok, it worked. Now let's install a new dependency
cd ~/my-repos/my-dep
npm link
jq .version package.json
"3.0.0"

cd ~/my-repos/new-project
npm install --save my-dep@link#^3.0.0
[WARNING] Using linked dependency my-dep at version 3.0.0 for required version ^3.0.0

# Good, we're all set
```

The resulting `package.json` file would be:

```json
{
  "dependencies": {
    "my-dep": "link#^3.0.0",
    "nother-dep": "link#^5.15.0(clone github.com:cool-producer/nother-dep.git and check out branch great-improvements)"
  }
}
```

Key takeaways here:

* Npm is telling you exactly what you need to do to complete the install successfully with compatible code.
* You, the developer, can specify where you want the dependencies-in-development to live.
* You know what the target version numbers are for the code in development (allowing multiple branches of development to happen simultaneously without confusion).
* All this information is kept together with the code itself, rather than in the brains of the devs developing the code.


## Rationale and Alternatives

### Using Lerna

[Lerna](https://github.com/lerna/lerna) is a popular tool for managing this problem. However:

* It's cumbersome to develop projects that depend on different version of a depdency together, since Lerna requires that all versions be compatible.
* You can't do simple things like `npm install --save [package]`, since npm breaks on the libraries in development.
* It's annoying to need an external tool for this when there's a simple native solution available that can work better.
* There's still no way to communicate in the project itself where to find the code that fulfills the version specifications.
* There's also no way to communicate what the target version of the new dependency is.

### Using Git Refs

Npm allows you to use a git reference as a package version, but:

* The code in development must be both committed to the repo and pushed to the central source. (Preliminary tests showed that repos are not checked out into the `node_modules` folder, but rather are copied as tarballs and unpacked, leaving few options to actively develop the code in place.)
* Projects using transpiled languages like typescript have to commit repetitive built code to their source code repos.
* There's no way to communicate what the target version of the new dependency is.

### Using Local File Paths

Npm allows you to use local file paths as package versions, but:

* Not everyone's directory structure is the same.
* There's no way to indicate what should actually exist at that path.
* There's no way to communicate what the target version of the new dependency is.

## Implementation

(To be drafted - see https://github.com/kael-shipman/cli/blob/rfc-pr-%23121/FEATURE-SPEC-RFC-PR-%23121.md for initial ideas)

## Prior Art

[Composer](https://getcomposer.org/) does a reasonably good job with a similar concept. They allow "version aliases", allowing you to communicate a) where to find the correct code, because you can specify a branch name; and b) what the target version of that as-yet unpublished code is, via the alias. Their implementation looks like this:

```json
{
  "require": {
    "my-pkg": "dev-my-branch as 2.5.3"
  }
}
```

This is ok, but it presents the minor issue of checking out the same repository multiple times across various projects, resulting in sometimes confusing varying states of development buried in `vendor/` directory hierarchies across projects. It is preferrable in development to leave the location of the repo up to the programmer (using `npm link`) and to then allow each project to target that location with specific version constraints (as this proposal recommends).

Additionally, while it works well for PHP projects, which are not compiled, it is not adequate for Typescript projects and other compiled javascript.

## Unresolved Questions and Bikeshedding

(To be drafted)

