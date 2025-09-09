# Log of installed dependencies on the system

## Summary

Log all installed packages with timestamp in a central location.

## Motivation

[Malicious packages](https://github.com/advisories) have become norm and not an exception that npm users have to deal with. Because of that, for users it is important to know what versions of what packages were installed at any one time on the system. Without knowing this, it isn't clear whether or not a malicious package was ever installed on the system.

## Detailed Explanation

Npm should keep a computer-readable, structured log of installed dependencies at a configurable location. The log should contain the package, version and hash of the packages as well as the timestamp. Every execution of package installation should result in it's own log file within the `~/.npm/_logs/` folder. Example: `~/.npm/_logs/2025-09-09T09_18_45_340Z-install.json`.

The JSON content should look like:

```json
{
    "version": 1,
    "location": "path/relative/to/parent/of/.npm/folder",
    "installed": [
        { "name": "chalk", "version": "4.4.2", "integrity": "sha512-1Yjs2SvM8TflER/OD3cOjhWWOZb58A2t7wpE2S9XfBYTiIl+XFhQG2bjy4Pu1I+EAlCNUzRDYDdFwFYUKvXcIA==", "post_install": true, "from_cache": false }
    ]
    "removed": [
        { "name": "chalk", "version": "4.4.1", "integrity": "sha512-1Yjs2SvM8TflER/OD3cOjhWWOZb58A2t7wpE2S9XfBYTiIl+XFhQG2bjy4Pu1I+EAlCNUzRDYDdFwFxUKvXcIA==", "post_uninstall": false, "removed_from_system": true }
    ]
}
```

## Rationale and Alternatives

As unlikely as it is, it may be possible to advise all NPM users to not install NPM packages on machines that also contain secrets, including session-ids for session-hijacking.

Users could possibly setup npm, and the log settings, in a way that logs all the installations. This configuration however is opt-in and in all likeliness using different formats on each machine. Also, all setup/tooling would require a predicatable log to be parsed which would lock-in npm into the logging structure or require tooling to keep up with npm updates.

## Implementation

{{Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

_TODO_

{{This section is optional if there are no actual prior examples in other tools}}

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
