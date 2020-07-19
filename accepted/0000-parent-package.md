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

During `npm pack` the `package.json` will be resolved:

* all `dependencies` and  `scripts` inherited from the parent `package.json` as well as the ones defined in the `package.json` will be combined into a file named `package-resolved.json`.
* A combined `package-resolved-lock.json` will be created containing a dependency tree for `package-resolved.json`.

These files can be used by npm when the package is installed by the end user.

This could have a couple of advantages:

* Since the dependency tree is already resolved during `pack` it should be similar in performance during `install` as a normal, unextended package. This is crucial, since we would not want to punish users for installing packages that inheriting a parent `package.json`.
* Similarly, this could be easier both for end users and developers, since they can have a quick look into `package-resolved.json` to see all `dependencies` and `scripts` at a glance.
* If a parent `package.json` is unavailable or unpublished this poses no problem for published inheriting packages, since they have the resolved files right in the published package. 

However, since `scripts` and `dependencies` are resolved during `pack` the semantic version range provided in the `package.json` is only respected during `pack`. 

There are at least two possible solutions to this problem:
* npm could print out the exact version the `package.json` was resolved against during `install`. If a newer parent `package.json` is available npm could warn the user a newer version is available, but might not be necessary. Secondly, if users deem this necessary they can run `npm install <package-name> --force` to have the resolving step be run again for the package. This would update both `package-resolved.json` and `package-resolved-lock.json` before the `install`. If during this time the parent `package.json` is no longer available, because it is unpublished, npm should just receive a `404` from the registry and react accordingly.
* Do not allow version ranges when specifying parent `package.json`. This also would not allow `tags` to be used as version.  


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

### What exactly to inherit?
The proposal basically starts with inheriting `dependencies` and `scripts`. These might be the most common to start with, but later the list could be extended to include other fields like `license`.  

### Should there be more limits as to what you can extend from? 
Maybe limit it to the same scope? Or allow people to say that they do not want their packages to be extendable?
### I feel the versioning aspect introduces a lot of complexity. 
However, I think npm so far is pretty consistent with its version ranges and I think we should try to keep being consistent here. 
### Other possible use cases? 
The initial idea was to simplify projects in the same organization, team or scope. In these environments it is possibly not so bad that the version range of the parent `package.json` is only respected during `pack`, because the organization has all packages under its control (and they maybe even are all in the same CI pipeline). However, thinking further parent `package.json` may also be adopted by those providing starter projects on `GitHub` or library authors who want provide an ever evolving starting point for developers. In these scenarios authors of the parent `package.json` would not be in control of inherting packages and therefore once they update their parent package they do not have much control. Plus, other use cases and implications not yet thought about.

### Should a parent package.json author be allowed to configure when it is resolved?
The proposal calls for the `package.json` to be resolved during `pack`. However, as author I might already know that my package is updated often and I want inherting packages to resolve it during `install`. This could be specified through a `resolve` property in the parent, which is set to `eager`. The default would be `lazy` which would only resolve it during `pack` as intended in the proposal.  

### Should the depth of inheritance be restricted?
There's not really a hard restriction in the proposal right now. Do we need one? 

### Should this possibly be divided into multiple RFCs?
This is getting very huge and very complex. It is definitely to think through the entire process in detail, but maybe a minimum viable feature (product) could be determined and the rest could be tackled at a later date once the MVP is implemented. 


{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
