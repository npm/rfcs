# Always perform full check for "engines" requirements on install phase

## Summary

Now if there is shrinkwrap file (or package-lock) NPM does not perform check if package dependencies are satisfied by provided environment (e.g. node/npm versions).   

## Motivation

1. CI/CD systems usually receives package with shrinkwrap file, so even if environment does not satisfy required versions for some dependencies, project could be executed.
For instance, we don't specify in main `package.json` any restrictions, but some dependency relies on fresh version of node.js (and have "engines" sections on it's own `package.json`).
In that case CI/CD can choose to use some version, that is more suitable for CI/CD server, rather than is required for our project to work properly.
So it's better to catch mis-configuration on `npm install` phase instead of waiting application to fail.

2. Another case when i remove `node_modules` (or use `npm ci`) but keep `package-lock.json`. Project dependencies again would not be checked against environment before installation. 

## Detailed Explanation

Just save extra information into shrinkwrap. And after that `idealTree` would have packages with filled `engines` section and `isInstallable` check would work out-of-the-box. 

## Rationale and Alternatives

I can see couple of alternatives:
1. Enrich `idealTree` with `engines` information on-the-fly from filesystem.
2. Have extra-section at shrinkwrap file with combined restrictions around environment (e.g. if module A wants `node > 8`, 
 module B wants `node > 10` and module C wants `node = 12.x` we unite it into single entry `node: "12.x"`)
 
Not sure that 1st alternative is acceptable, because it would require to read `package.json` of every installed dependency.

2nd variant sounds good, but it adds complexity.   

## Implementation

Easiest solution would be to include "engines" property to every dependency section at `treeToShrinkwrap` routine.

Generic structure of shrunkwrap file stays same, so no need to update `lockfileVersion` 

## Unresolved Questions and Bikeshedding

Should we include "engines" section into shrinkwrap files or it's better to enrich loaded `idealTree` with extra data?
Because deps in `package-lock` are baked, we can construct single "engines" requirements sections for all deps and main package itself. Is it worth to do?
