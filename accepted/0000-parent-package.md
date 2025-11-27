# Parent package.json for inheriting certain fields

## Summary

Allows a package.json to extend a parent package.json to share dependencies and more between multiple packages.

## Motivation

In modern monorepositories and or workspaces a lot of packages may share the same dependencies. It can become very tedious and difficult to keep dependencies up to date across multiple packages. Tools like `lerna` do provide hoisting as a possible solution. However, this may not work depending on ones's setup: 
* For example this approach is not usable when using a combination of Git submodules and continious integration: Each submodule may be checked out individually and represent one independent continous integration pipeline job. In this case it is desirable to only checkout the submodule. This helps for example to prevent unwanted reliance on code in other modules. 
* Also in other instances the amount of hoisted dependencies may be too large or undesired: the root package.json may be used as a configuration for workspaces or for development dependencies like `lerna` and therefore not really suitable for CI jobs.   

## Detailed Explanation

Add a new file called `source-package.json`. This source file is used to generate a new `package.json` with inhereted `dependencies`, `scripts` and `overrides`.  

The source file contains an `extends` field, which specifies an object containing the following keys:
* name the name of the parent package.json.  
* version, local path or Git repository to use to resolve the parent package.

Example:
````json
{
"extends": {"parent-foo": "~1.2"}
} 
````
A source can only extend a single parent. The parent package can be resolved just like any dependency (refer to https://docs.npmjs.com/files/package.json#dependencies), so semver, local path or git repository are all valid. 

In general any npm package could be used as a parent `package.json`. A parent `package.json` must not be flagged as `private` though. Secondly, there must not be a circular dependency: The source package must not be anywhere in the dependency tree of the parent package. 

Additionally, the source file contains all sections that can be inherited.

During `install` and `pack` 

* all `dependencies`,  `scripts` and `overrides` inherited from the parent as well as the ones defined in the source will be combined into single `package.json`. If a dependency, script, or override is present in both the parent as well as the source `package.json` the definition in the source always overrides the parent's definition. 

* A combined lockfile will also be created.

This has a couple of advantages:

* Since the dependency tree is already resolved during `pack` it should be similar in performance during `install` as a normal, unextended package. This is crucial, since we would not want to punish users for installing packages that inherit a parent `package.json`.
* Similarly, this could be easier both for end users and developers, since they can have a quick look into `package.json` to see all `dependencies`, `scripts` and `overrides` at a glance.
* If a parent `package.json` is unavailable or unpublished this poses no problem for published inheriting packages, since they have the resolved files right in the published package. 
* Exisiting tooling that analyzes `package.json` or `package-lock.json` does not need to change because it can still read `package.json` as usual.

For local development the following adjustments could be made:

 
* `npm install <dependency>` will write the dependency to the source file. It will then regenerate `package.json`. 
* 
* `npm list` will output the combined dependency tree. It should additionally output the version of the resolved parent package. 

 * `npm outdated` command would also need to be updated to check for an outdated parent `package.json`. The package could end up in the outdated output twice, once as dependency of the source and once as parent of the source. Therefore, the parent package name should somehow be marked, either as seperate entry or with a suffix to the package name such as `(parent)`.  

 * `npm run` should additionally also list and run inherited scripts.  
 * `npm update` should also be able to update the parent `package.json`.

Additionally an argument `--parent` should be introduced to `npm list` and `npm update`:

* For `npm list` this would allow the user to see only inherited dependencies. This works similar to how `--dev` or `--prod` work today.
* For `npm update` this would allow to only update the parent. This would help in a scenario where package `foo` is both a parent and a dependency of `bar`. Today, users can run `npm update foo`. This would still only update the dependency of `bar`. However, if they want to update the parent of bar they can simply run `npm update --parent`. 

## Rationale and Alternatives

* Hoist dependencies: as explained in the motivation part this does not work when wanting independent CI builds or can lead to bloated root `package.json`s. 

* `npm update <package name@version> --workspace` command: This command would search all packages in  the monorepository and update all instances of `<package name>` to `<version>`. However, this would not allow sharing `scripts`. Also, this would not allow for overrides if desired.  

## Implementation

{{Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

* Parent poms in Maven: http://maven.apache.org/guides/introduction/introduction-to-the-pom.html#Project_Inheritance
* Gradle `allprojects` or `subprojects`: https://docs.gradle.org/current/userguide/multi_project_builds.html

## Unresolved Questions and Bikeshedding

### Should there be more limits as to what you can extend from? 
Maybe limit it to the same scope? Or allow people to say that they do not want their packages to be extendable?

### Edits to package.json are potentially lost
If a user edits package.json and adds a new `dependency`, `script` or `override`, the changes could potentially be lost on the next `install` or `pack`. Maybe we should warn the user about this and tell them to move the definitions to the source?


### Potentially, other areas for local development of the source package need to be touched on as well


{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
