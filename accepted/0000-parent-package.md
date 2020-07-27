# Parent package.json for inheriting certain fields

## Summary

Allows a package.json to extend a parent package.json to share dependencies and more between multiple packages.

## Motivation

In modern monorepositories and or workspaces a lot of packages may share the same dependencies. It can become very tedious and difficult to keep dependencies up to date across multiple packages. Tools like `lerna` do provide hoisting as a possible solution. However, this may not work depending on ones's setup: 
* For example this approach is not usable when using a combination of Git submodules and continious integration: Each submodule may be checked out individually and represent one independent continous integration pipeline job. In this case it is desirable to only checkout the submodule. This helps for example to prevent unwanted reliance on code in other modules. 
* Also in other instances the amount of hoisted dependencies may be too large or undesired: the root package.json may be used as a configuration for workspaces or for development dependencies like `lerna` and therefore not really suitable for CI jobs.   

## Detailed Explanation

Extend package.json format with an `extends` field. In this field an object can specified which contains the following keys:
* name the name of the parent package.json.  
* version, local path or Git repository to use to resolve the parent package.

Example:
````json
{
"extends": {"parent-foo": "~1.2"}
} 
````
A child can only extend a single parent `package.json`. The parent package can be resolved just like any dependency (refer to https://docs.npmjs.com/files/package.json#dependencies), so semver, local path or git repository are all valid. 

In general any npm package.json could be used as a parent `package.json`. A parent `package.json` must not be flagged as `private` though. 

The child `package.json` would inherit `dependencies` (Dev, peer etc.) and `scripts` sections of the parent `package.json` if present. If a dependency or script is present in both the parent package.json as well as the child `package.json` the definition in the child always overrides the parent's definition. 

It could also be explored to inherit the entire parent package.json maybe it is desirable to share licenses or authors across packages for example.

During `npm pack` the `package.json` will be resolved:

* all `dependencies` and  `scripts` inherited from the parent `package.json` as well as the ones defined in the child will be combined into single `package.json`.
* A combined lockfile will also be created.

These combined files will be written into the tarball. 

This has a couple of advantages:

* Since the dependency tree is already resolved during `pack` it should be similar in performance during `install` as a normal, unextended package. This is crucial, since we would not want to punish users for installing packages that inherit a parent `package.json`.
* Similarly, this could be easier both for end users and developers, since they can have a quick look into `package.json` to see all `dependencies` and `scripts` at a glance.
* If a parent `package.json` is unavailable or unpublished this poses no problem for published inheriting packages, since they have the resolved files right in the published package. 

For local development of the child package or a workspace the following adjustments could be made:

  * ` npm list` will mark packages coming from a parent `package.json`. Also,  overrides in the package tree should be identifyable. 

 * `npm outdated` command would also need to be updated to check for an outdated parent `package.json`.
 * Parent `package.json` needs to work with local files, links and workspaces too.  
 * `npm run` should mark and list `scripts` from the parent `package.json`. Also,  overrides should be identifyable. Of course you should also be able to run inherited scripts. ;) 
 * `npm update` should also be able to update the parent `package.json`.




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

### What exactly to inherit?
The proposal basically starts with inheriting `dependencies` and `scripts`. These might be the most common to start with, but later the list could be extended to include other fields like `license`, `config` or `authors`.  

### Should there be more limits as to what you can extend from? 
Maybe limit it to the same scope? Or allow people to say that they do not want their packages to be extendable?

### What if I extend a parent `package.json` and it is also a dependency of the child?
Consider a package extends the Typescript package and also uses Typescript as `devDependency`. This could be potentially problematic. For example during `npm update` how would one specify that you want to update the parent `package.json`? The easiest solution would probably just be to prohibit this scenario altogether. 

### Potentially, other areas for local development of the child package need to be touched on as well


{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
