# More Informed, Gated `npm publish` Command

## Summary

Would like to see the `npm publish` command end with a `[N/y]` prompt to confirm that the action should be taken. This prompt should be accompanied by information about the current package about to be published. Which will provide context on the action to be taken.


## Motivation

npm Inc. gets a lot of feedback through support, and is a sentiment that is echoed from exterprise and paied users, that suggests this process should be a little more _intent_ driven. Having a prompt to enter "yes" or "no" gives the user pause to verify something like publishing a package with **public** access, when it should be **private**. This should reduce the incoming support for unpublishing packages that were published accidentally.

## Detailed Explanation

Currently we display the details about the tarball: sizes, files included, shasum, integrity, etc. However, only **after** the package is publish, **or** when the `--dry-run` command is passed. An example of our **current** information is displayed below.

```
npm notice
npm notice 📦  @scoped-name/package-name@1.2.3
npm notice === Tarball Contents ===
npm notice 707B lib/do-something.js
npm notice 660B lib/dont-something.js
npm notice 79B  index.js
npm notice 553B package.json
npm notice === Tarball Details ===
npm notice name:          @scoped-name/package-name
npm notice version:       1.0.2
npm notice package size:  602 B
npm notice unpacked size: 2.0 kB
npm notice shasum:        89c91038b3702d66058ff4700d10cd05c87f528c
npm notice integrity:     sha512-3waXaHnmeIk/L[...]JirO+ZZYKERzg==
npm notice total files:   4
npm notice
+ @scoped-name/package-name@1.2.3
```

By displaying any amount of information to the end user **before** they publish, it gives them confidence in the process. It also means that _intent_ is needed to publish. Simply typing `npm publish` will no longer be enough. You'd need to strike another key after prompted or pass a `--yes` flag along with the command, again signifying intent.

## Rationale and Alternatives

{{Discuss 2-3 different alternative solutions that were considered. This is required, even if it seems like a stretch. Then explain why this is the best choice out of available ones.}}

- An implementation could simply by the gated publish. Adding a `[N/y]` prompt to the `npm publish` command would be a very low impact addtion to the cli which, in-an-of itself, could yield confidence to the end user that what they are typing into the terminal is correct.

  - Interestingly by doing this, we are simply giving the user another chance to shoot themselves in the foot. If we are goin gto go to the lengths of prompting the user with "Are you sure?", it would also be correct to display some information for them "to be sure about". At the moment the output from `npm pack` is the same output for `npm publish`, and this could be enough.

  > The addtional work of displaying "Package Details" _(as described below)_ could be descoped for the first iteration.

## Implementation

{{Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

An example output could be similar to the following:
```
npm notice
npm notice 📦  @scoped-name/package-name@1.2.3
npm notice 🌎  registry.private-company.com
npm notice === Package Details ===
npm notice owner: package-owner
npm notice publisher: your-username
npm notice access: private
npm notice === Tarball Contents ===
npm notice 79B  index.js
npm notice 553B package.json
npm notice === Tarball Details ===
npm notice name:          @scoped-name/package-name
npm notice version:       1.0.2
npm notice package size:  481 B
npm notice unpacked size: 632 B
npm notice shasum:        11b19419434eb295ed70a9cbef6259ac1d64acbe
npm notice integrity:     sha512-LCz1A5mbkAE6Y[...]8Mf7JpL1E+3tg==
npm notice total files:   2
npm notice
npm notice Are you sure you want to publish? [N/y]:
```


## Prior Art

{{This section is optional if there are no actual prior examples in other tools}}

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}

* Publish Please: [repository](https://github.com/inikulin/publish-please), [npm package](https://www.npmjs.com/package/publish-please)

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
