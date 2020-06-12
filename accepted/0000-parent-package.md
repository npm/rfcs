# Parent package.json for inheriting certain fields

## Summary

Allows a package.json to extend a parent package.json to share dependencies and more between multiple packages.

## Motivation

In modern monorepositories and or workspaces a lot of packages may share the same dependencies. It can become very tedious and difficult to keep dependencies up to date across multiple packages. Tools like `lerna` do provide hoisting as a possible solution. However, this may not work depending on ones's setup: 
* For example this approach is not usable when using a combination of Git submodules and continious integration: Each submodule may be checked out individually and represent one independent continous integration pipeline job. In this case it is desirable to only checkout the submodule. This helps for example to prevent unwanted reliance on code in other modules. 
* Also in other instances the amount of hoisted dependencies may be too large or undesired: the root package.json may be used as a configuration for workspaces or for development dependencies like `lerna` and therefore not really suitable for CI jobs.   

## Detailed Explanation

Extend package.json format with an `extends` field. In this field an object can specified which contains the following keys:
* name the name or url to the parent package.json. 
* version The semantic versioning version of the parent package to use. 

In general any npm package.json could be used as a parent package.json. No matter if published to a npm repository or on GitHub. A parent package.json must not be flagged as `private` though. 

The child package.json would inherit `dependencies` (Dev, peer etc.) and `scripts` sections of the parent package.json if present. If a dependency or script is present in both the parent package.json as well as the child package.json the definition in the child always overrides the parent's definition. During `install` and `list` npm will mark these overrides in the package tree printed to the console. 
It could also be explored to inherit the entire parent package.json maybe it is desirable to share licenses or authors across packages for example.

Possibly, the parent package.json should have a npm-shrinkwrap.json which could be used to make sure that child packages share the same lockfile segments to make sure dependency trees are equal.

## Rationale and Alternatives

* Hoist dependencies: as explained in the motivation part this does not work when wanting independent CI builds or can lead to bloated to root package.jsons. 

* `npm update <package name@version> --workspace` command: This command would search all packages in  the monorepository and update all instances of `<package name>` to `<version>`. However, this would not allow sharing `scripts`. Also, this would not allow for overrides if desired.  

## Implementation

{{Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

* Parent poms in Maven: http://maven.apache.org/guides/introduction/introduction-to-the-pom.html#Project_Inheritance
* Gradle `allprojects` or `subprojects`: https://docs.gradle.org/current/userguide/multi_project_builds.html

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
