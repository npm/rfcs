# Option to use lockfileVersion 3 in top-level package-lock.json

## Summary

Add an option to use the lockfile version of 3
in the top-level `package-lock.json` file.

## Motivation

This would allow halve the size of `package-lock.json`
when no backwards compatibility with npm v6 is needed.

## Detailed Explanation

The [docs say]:

> `3`: The lockfile version used by npm v7,
> _without_ backwards compatibility affordances.
> This is used for the hidden lockfile at `node_modules/.package-lock.json`,
> and will likely be used in a future version of npm,
> once support for npm v6 is no longer relevant.

Once implemented,
the proposed option would allow to opting in that behavior
right now, without need to wait for a new major npm release.

The lockfileVersion of 3 doesn’t write the top-level `dependencies` object
which doubled the size of the lockfile.

## Rationale and Alternatives

1) Just wait for a future release that’s using lockfile v3 at the top level.
   * It probably takes years (?) until that version is released.
	  The new option would allow opt-in much sooner.

2) Write a custom script removing the `dependencies` object
   from `package-lock.json`.
	* This will halve the file size but feels a bit hacky.

## Implementation

...

<!--
{{Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}
-->

## Prior Art

...

<!--
{{This section is optional if there are no actual prior examples in other tools}}

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}
-->

## Unresolved Questions and Bikeshedding

...

<!--
{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
-->

[docs say]: https://github.com/npm/cli/blob/latest/docs/content/configuring-npm/package-lock-json.md#lockfileversion
