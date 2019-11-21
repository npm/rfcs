# RFC: Staged Packages

## Summary

Staging workflow which allows CI to publish new package versions, while allowing
humans to be the final arbiters of general availability.

## Motivation

Anything published by CI is instantly available for general use, which isn't
ideal when a human is required to be in the loop. And even when fully automated
CI/CD is allowed, the inability to use 2FA with auth tokens is a security risk.

## Detailed Explanation

We need a minimum of four things to solve these problems:

1. Staging area on the registry invisible to most `npm` commands
2. Auth tokens that can be scoped to the staging area
3. CLI flag which lets `npm` commands act on the staging area
4. CLI command that lets users promote a staged package

## Rationale and Alternatives

One alternative is to defer to third-party repository managers for staging
functionality. However, this requires that users set up and manage yet another
tool, which most won't bother to do. In addition, even if users do acquire those
tools, because staging commands aren't built into the npm CLI, they have to
learn a new interface to perform staging operations, which adds unnecessary
friction to the developer experience and again encourages the wrong sorts of
publishing behaviors.

Another alternative is to build this using our existing `dist-tag`
functionality. The appeal is that it uses a mechanism we've already built. The
downside is that we would have to actively ignore these tagged packages in the
CLI and would be eating up versions as well, not ideal.

Yet another alternative is to build a fancy release manager application,
separate from the CLI. However, this is a larger project, and we can almost
certainly implement a useful staging workflow based on tooling that already
exists. Also, even if we start by adding this to the CLI, it doesn't mean we
can't build a more complex application on top of the CLI later on.

After considering these alternatives, we belive a staging workflow built into
the npm CLI provides the shortest path to useful staging functionality that we
can iterate upon. It will allow us to test these new concepts in a tool with
which we and our community are both familiar.

## Implementation

* Add a `stagedVersions` object to the packument which lists all packages that
  have been staged and not promoted.
* A new `--stage` flag for the `npm publish` command that allows a package to be
  published to staging.
* A new `--stage` flag for the `npm install` command that allows a package to be
  installed from staging.
* A new `--stage` flag for the `npm view` command that allows us to retrive data
  for staged packages.
* A new `npm promote` command that allows a user to promote a staged package.
* The ability to set a `staging` scope on auth tokens so we can grant read or
  publish access to staging.
* A new user permission that allows us to grant a user the ability to read or
  promote packages in staging.
  * These are separate from the existing read and publish permissions, since we
    may want a user to have access to staging, but not production, and
    vice-versa.

## Prior Art

* Pull Requests on GitHub allow humans to serve as the gatekeeper before new
  code is merged into master. The "two +1s" rule helps reduce the risk of bad
  code getting merged in, and having a CI system configured to build from master
  means that approving a PR is conceptually similar to the gatekeeping
  capabilities in the staging workflow we've defined above.
* Staging in third-party repository managers, like Nexus Repository Manager,
  also meets any gatekeeping requirements.
  * In Nexus 2, this was implemented via dedicated staging repositories, where
    packages could be published and then promoted to a production repository,
    all via a nice staging UI.
  * In Nexus 3, they shifted to an API-first approach, where new packages had
    staging metadata set on them, and the API could enable CI and other tooling
    to stage or promote packages by updating this metadata.

## Unresolved Questions and Bikeshedding

* Currently out of scope (but up for debate):
  * Webhook support
  * Metadata related to fitness of staged packages
  * Multiple staged packages (current spec has a limit of one, successive stages
    clobber the previous staged version).
