# Restricting `root`/`sudo` Behavior

## Summary

npm 9 [removed the owner-preserving behavior for npm-created
files, and the permission-dropping behavior for npm
scripts](../implemented/0012-running-as-root.md).

This is almost certainly for the best, given the complexities and
edge cases such behavior introduced.  However, it (re-)introduces
a few unfortunate issues that could be addressed elegantly.

## Motivation

Installing packages with `root`, in a non-`root`-owned project,
leads to the creation of `root`-owned files in `node_modules`
which is mildly annoying, but easy to fix, as users typically
have a fairly good understanding of their local project
dependencies, and can be expected to feel comfortable modifying
permissions there as needed.

However, it also:

1. creates `root`-owned files and folders in the npm cache, which
   have obscure names based on the content hash.
2. runs package scripts as root.

Installing globally _requires_ `sudo` usage on many systems by
default, and the expected behavior in such cases is that the
installed files are owned by `root`.  (This was one of the issues
fixed by the npm v9 behavior change!)  However, it still pollutes
the user cache, which can be annoying.

Lastly, running package scripts as `root` significantly increases
the hazards involved.

## Detailed Explanation

1. Introduce a check at install time requiring `--force` (or
   similar) to perform a local install as root in a project
   folder not owned by root.  When this check fails, provide a
   message encouraging the user to perform the local install as
   their "normal" user.
2. When running as root, use a separate cache folder from the
   user's main cache.
3. When a cache write fails with `EACCES`, provide the user with
   the appropriate `chown` command to run in their terminal to
   correct the cache.  Alternatively, this could done by `sudo
   npm doctor fix`, or similar.

This would sufficiently avoid at least the filesystem related
issues arising from running npm as root, without impacting
systems where the main user _is_ root, such as Docker containers
and some single-user servers.

It does not address the hazards introduced by running package
scripts as root, except by encouraging users to avoid using
`sudo` for local installs.  If those are worth addressing, it
should be done in a subsequent RFC.

## Rationale and Alternatives

The main alternative to avoiding/detecting the problems that
arise from mixed `root` and user usage is to try to avoid the
problems altogether by carefully managing file ownership.
However, as we've seen from the last 10 years of npm usage, this
approach causes more problems than it solves, in performance as
well as user experience.

The other alternative is to simply do nothing, and address any
resulting problems with documentation and messaging.  However,
this is unlikely to be as effective.

The runtime cost of this implementation would be a single `stat`
call, which is far more efficient than the previous approach.
The other downside is that fetches made as the `root` user will
not benefit from a shared cache with the normal user, but this is
a minor consideration (and arguably a benefit).

## Implementation

{{Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

{{This section is optional if there are no actual prior examples in other tools}}

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
