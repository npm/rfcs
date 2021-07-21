# Add license reporting to npm

## Summary

It should be possible to get a full report of the licenses from all dependencies. This report should include the license as defined in `package.json` in addition to including a path to any relevant `LICENSE`-ish files within the project. Additionally, end-users should be able to have an allowlist and blocklist of "acceptable" licenses, a way to allow modules with licenses outside of that list that have been triaged, and have a way to install such a list.

## Motivation

{{Why are we doing this? What pain points does this resolve? What use cases does it support? What is the expected outcome? Use real, concrete examples to make your case!}}

License reporting is something that there seems to be a non-trivial amount of ecosystem tooling around - largely built by folks at large corps or by companies that focus on dependencies as a core part of their business in some way - without having any kind of official recognition beyond the "license" property being displayed on the package view of npmjs.com.

Given that this is something that a non-trivial number of users care about _and_ that the state of the ecosystem is relatively fragmented, there's an opportunity to include license tooling as a first-class tool within the ecosystem and both help incrementally improve the ecosystem's awareness/practices around this in addtion to providing blessed built-in tooling that can help resolve a problem the ecosystem is pretty consistently having to build their own tooling for.

## Detailed Explanation

### Dependency implementation:  

- Add a dependency on [licensee](https://www.npmjs.com/package/licensee)
- Follow the licensee API, with some modifications
  - CLI configuration and commands are aliased to `npm audit license <flags/arguments>` rather than the `licensee` command
  - JSON configuration can either exist in `package.json` under the `audit` property (as an object) in a `licenses` property (as an object), with the same API **or** under the `licenses` (as an object) property in a file named `audit.json`
    - one of the two should take precident over the other if duplication occurs. My preference would be package.json but I can understand why others would disagree and do not hold this opinion strongly.

### Additional commands and flags:

Since this proposal moves `npm audit` into a wholistic auditing suite rather than just focusing on security, there would need to be additional commands and flags to limit specific features of audit in addition to expanding the scope of the existing flags:

  - `npm audit security` should be added for consistency. This would replicate the current `npm audit` behavior, auditing dependencies for known security vulnerabilities.
  - `npm audit` would now run both `npm audit security` and `npm audit license`
  - `--no-audit` now blocks `npm audit` which encompasses all audits
  - `--no-audit-security` should block **only security auditing**
  - `--no-audit-license` should block **only license auditing**

On action if a module doesn't have a compatible license:

- the `npm audit fix` command *should* search for and implement a replacement if at all possible given the list of allowed/blocked licenses and semver ranges
- the `npm audit fix --force` command *should* search for and force a replacement if at all possible given the list of allowed/blocked licenses and semver ranges
- the `npm audit` command *should* report license failures and which versions would "fix" licenses that are blocked but have already been resolved.
- the audit report on `npm install` should report how many modules do not comply with license requirements


<!-- Old "Detailed Explanation" - saved for context while drafting.
- It should be possible to get a full report of the licenses from all dependencies.
  - This should be runnable from a single command: `npm audit licenses`
    - Offline (default)
      - This report should collect all licenses via the `license` properties from `package.json` files in `node_modules`.
    - Online (`--online`)
      - This report should have an `--online` mode that will resolve the dependency tree and fetch the entire dependency tree's licenses without needing the modules on disk.
    - Output
      - This report should default to a pretty printed human-readable version.
      - This report should be able to be output as JSON with a `--json` flag.
- It should be possible to define a set of allowed, blocked, and ignored licenses
  - Location
    - This should be able to be defined both in `package.json` or something like `audit.json`.
  - Contents
    - These lists should an be in a `licenses` object with three properties - `allow` (array), `block` (array), and `ignore` (object).
      - If in `package.json`, `licenses` should be a subproperty of `audit`.
      - If in `audit.json`, `licenses` should be a top level property.
      - In `licenses`, `allow` should be an array of values that would _ideally_ be SPDX License Identifiers or SPDX License Expressions but in reality will not end up always being that.
      - In `licenses`, `block` should be an array of values that would _ideally_ be SPDX License Identifiers or SPDX License Expressions but in reality will not end up always being that.
      - In `licenses`, `ignore` should be an object with two properties - `licenses` and `modules`.
        - `licenses` is a list of license values (parsed from `license` in dependencies' `package.json`) to _ignore_ from any kind of checking.
        - `modules` is a list of modules (parsed from `name` in dependencies' `package.json`) to _ignore_ from any kind of checking.
  - Behavior on `npm install`
    - If a `block` property exists, npm should not install any modules on-disk that have a value in `license` that matches any of the values in `block`.
    - All blocked modules and the path they were introduced through should be reported as an `error` or `warn`.
- It should be possible to triage licenses that are on disk (in `node_modules`) or would be resolved in the dependency tree
  - This should be accomplished through `npm audit licenses triage`
    - Offline (default)
      - This report should collect all licenses via the `license` properties from `package.json` files in `node_modules`, filtering out any licenses that are in `allow` and  `block` in addition to any licenses or modules in `ignore`, and provide the user the option to `allow`, `block`, or `ignore` the license, one by one.
    - Online (`--online`)
      - This report should collect all licenses via the `license` properties from `package.json` files from a resolved dependency tree without needing the modules on disk, filtering out any licenses that are in `allow` and  `block` in addition to any licenses or modules in `ignore`, and provide the user the option to `allow`, `block`, or `ignore` the license, one by one.
-->

## Rationale and Alternatives

There are a wide array of tools in the ecosystem that have been built to paper over the lack of license tooling in npm and the JavaScript ecosystem. There's clearly a desire/need for license tooling, and including it directly in npm would help drive both improved experiences for developers and overall best practices.

Alternatives considered:

- Distinct command within the CLI, outside of audit (`npm license` or `npm compliance`).
  - Discarded this as it would potentially create further fragmentation of the npm CLI's user-facing components where it's potentially unnecessary. Further, since this feature only _adds_ to `npm audit`, it should not detract from the experience of those already relying on `npm audit` for security functionality until they opt-in to using licensing functionality.
- Leave it to the ecosystem.
  - This has been the state of the world for about a decade, and there's still been no excessively positive tooling that's come up and solved all the problems that exist in this space while achieving widespread adoption.

## Implementation

{{Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

Paid tooling:

- https://fossa.com/ - OSS license checking as service. Gives the service for free to impactful OSS projects.
- https://help.sonatype.com/repomanager3/formats/npm-registry#npmRegistry-npmaudit - Private registry product extension. Enterprise use case, relatively widely used by megacorps.
- https://jfrog.com/xray/ - Private registry product extension. Enterprise use case, relatively widely used by megacorps.
- https://docs.nodesource.com/ncmv2/docs#compliance - Extension of the public registry as an Electron app/web service. Was killed pre-acquisition. Company publicly stated they had relatively large enterprise customers.

Open-source tooling:

- https://www.npmjs.com/package/license-checker - relatively widely used and similar-ish to what's proposed. Also a requirable module.
- https://www.npmjs.com/package/license-report - similar-ish to what's proposed.
- https://www.npmjs.com/package/nlf - similar-ish to what's proposed. Also a requirable module.
- https://www.npmjs.com/package/npm-license - similar-ish to what's proposed.
- https://www.npmjs.com/package/delice - similar-ish to what's proposed.

## Unresolved Questions and Bikeshedding

- property naming
- package.json/audit.json/both

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
