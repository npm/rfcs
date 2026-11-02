# RFC: npm publish, unpublish, and deprecate functionality and data/repository management and log management policy (security policy) changes

## Summary

When I publish a package v1.0.0 and unpublish it, it is unpublished correctly. However, I am not able to re-publish any other codebase B/ C/ D into v1.0.0. I will not be able to re-publish the same version v1.0.0 with a new or same codebase.

This RFC is a proposal where I recommend allowing republishing the same npm package version v1.0.0 with a different codebase B after unpublishing a version v1.0.0 with codebase A; with a possibility to view the publish, unpublish, republish logs/ codebase, etc. This recommended change improves the npm package publish-unpublish process, (historical) publish-unpublish data management policy, and (historical) publish-unpublish log management policy (and security management policy).


## Motivation

Allowing republishing the same npm package version v1.0.0 with a different codebase B after unpublishing a version v1.0.0 with codebase A; with a possibility to view the publish, unpublish, republish logs/ codebase, etc. This recommended change improves the npm package publish-unpublish process, (historical) publish-unpublish data management policy, and (historical) publish-unpublish log management policy (and security management policy).

This is a `npm publish, unpublish, and deprecate functionality and data/repository management plus log management policy (security policy) changes request`.


## Detailed Explanation

npm publish, unpublish, and deprecate functionality needs/ requirement:

- When I publish a package v1.0.0 and deprecate it, it is deprecated correctly. I will not be able to publish any other version into v1.0.0.
- When I publish a package v1.0.0 and unpublish it, it is unpublished correctly. However, I am not able to re-publish any other codebase into V1.0.0. I will not be able to re-pulish the same version v1.0.0.

I recommend allowing republishing the same npm package version v1.0.0 with a different codebase B after unpublishing a version v1.0.0 with codebase A; with a possibility to view the publish, unpublish, republish logs/ codebase, etc.

While being unable to republish a unpublished version v1.0.0 is the current behaviour, I believe being able to re-publish a different codebase with the same version v1.0.0 after unpublish should be possible. If you are archiving publish and unpublish logs plus codebase internally in your servers for security reasons and/ or other policy reasons, I suggest you could probably archive into the servers the published-unpublished version v1.0.0, the unpublished v1.0.0 codebase A, new v1.0.0 published codebase B, and future unpublish logs, so on, for the version v1.0.0, etc.


### Environment (when raising the change proposal)

- npm:  v8.15.0 (applies to all versions)
- Node.js: v18.10.0 (applies to all versions supported or historical)
- OS Name: Microsoft Windows NT 10.0.22621.0 x64, Linux, Mac  (applies to all versions supported)
- System Model Name: Dell Microsoft Windows 11  (applies to all versions supported)
- npm config: defaults
```ini
; "builtin" config from C:\Users\GB\Documents\binaries\node\node_modules\npm\npmrc

prefix = "C:\\Users\\GB\\AppData\\Roaming\\npm"

; "user" config from C:\Users\GB\.npmrc

//registry.npmjs.org/:_authToken = (protected)
msvs_version = "2019"
python = "python3.8"

; node bin location = C:\Users\GB\Documents\binaries\node\node.exe
; node version = v18.10.0
; npm local prefix = C:\Users\GB
; npm version = 8.15.0
; cwd = C:\Users\GB
; HOME = C:\Users\GB
; Run `npm config ls -l` to show all defaults.
```


## Rationale and Alternatives

None


## Implementation

While being unable to republish a unpublished version v1.0.0 is the current behaviour, I believe being able to re-publish a different codebase with the same version v1.0.0 after unpublish should be possible.

The implementation will include:

- Allow re-publishing a different codebase B with the same version v1.0.0 after unpublishing should be possible.
- If you are archiving publish and unpublish logs internally in your servers for security reasons and/ or other policy reasons, I suggest you could probably archive into the servers the published-unpublished version v1.0.0, future unpublish logs, so on, for the version v1.0.0, etc.
- If you are archiving publish and unpublish repositories/ codebase internally in your servers for security reasons and/ or other policy reasons, I suggest you could probably archive into the servers the published-unpublished version v1.0.0, the unpublished v1.0.0 codebase A, new v1.0.0 published codebase B, and future unpublish codebases B, so on, for the version v1.0.0, etc.
- Let users see appropriate publish-unpublish-republish logs for their application (dependent package) security and implementation reasons.
- Optionally, allow users to (preferably) download (as compressed package) the unpublished package in case of specific needs of usage/ local installations.
- Optionally, allow users to (!complexity, take care) install the unpublished package probably using a hash (packagename@v1.0.0:jk45k45b54dsdfvc5vsjk45kj=) in case of specific needs of usage/ local installations.

[https://docs.npmjs.com/policies/unpublish](https://docs.npmjs.com/policies/unpublish)


## Prior Art

NA


## Unresolved Questions and Bikeshedding

- Is there a policy issue that is effected or affected for the repository data management or security logs?
    - This recommended change improves the npm package publish-unpublish process, (historical) publish-unpublish data management policy, and (historical) publish-unpublish log management policy (and security management policy).
- Is there a recommended repository data management or security logs management process recommendation?
    - If you are archiving publish and unpublish logs plus codebase internally in your servers for security reasons and/ or other policy reasons, I suggest you could probably archive into the servers the published-unpublished version v1.0.0, the unpublished v1.0.0 codebase A, new v1.0.0 published codebase B, and future unpublish logs, so on, for the version v1.0.0, etc. [https://docs.npmjs.com/policies/unpublish](https://docs.npmjs.com/policies/unpublish)

