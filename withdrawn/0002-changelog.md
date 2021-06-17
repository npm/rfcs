# Withdrawal Amendment

- Managing changelog is considered outside of the scope of the **npm cli**
- Recently **npm-packlist** no longer force-includes changelog files by default, ref: https://github.com/npm/npm-packlist/commit/2b29fc274bb5096b337d649f1871f7cfee4f9449
- Long inactive approved RFC
- Current **npm cli** team is unlikely to implement this

## Relevant Resources

Withdrawn consensus achieved during the [Wednesday, June 16, 2021 OpenRFC meeting](https://github.com/npm/rfcs/issues/399)
- Meeting Notes: https://github.com/npm/rfcs/blob/515b8f310eb4605022c8b25849dfc9941f321885/meetings/2021-06-16.md
- Video Recording: https://youtu.be/N6cEmHKPRfo

# Changelog

## Summary

This RFC introduces the `changelog` command to `npm`.

## Motivation

A changelog file helps keep users of a library up to date on recent changes to
that library. This allows them to better prepare for any bugs that might
surface in their application from these changes.

Since npm already supports including a changelog with the package by reserving
three possible document names: `CHANGES`, `CHANGELOG`, and `HISTORY`
(with any file extension), this means that we can utilize the included file to
better show what has happened with recent changes to a package.

This is good for security and general maintenance.

## Detailed Explanation

When a changelog is requested (via `npm changelog`), a user can be taken to the
npm package page for that specific package version - and to the changelog
section for said package.

## Rationale and Alternatives

- https://github.com/dantman/npm-rfcs/blob/changelog/accepted/0000-changelog.md
- Another option is rendering the changelog out at the CLI level, but this
seems much more complicated to nail cross-platform.

## Implementation

- From the registry side, we have pkg-index-lambda, which currently is used in
the same manner for README files. We can expand this to also seek out the files
involved here. We'll then need to go through every package and run this against
it. We'll want to have a discussion about storage costs as well, as this will
put everything into s3 and cache it at the CDN.

- On the web side, we'll need to add this to the package page - this will
involve design figuring out where it best fits + adding the route to the app.

## Prior Art

See: https://github.com/dantman/npm-rfcs/blob/changelog/accepted/0000-changelog.md for the original idea

As mentioned, this will work similarly to the README. We should even have a tab on the website.

## Unresolved Questions and Bikeshedding

Any file extension works with `CHANGES` / `CHANGELOG` / `HISTORY`, but npm's
rendering of package files to the website currently only supports markdown. Do
we open this up or convince people to convert to markdown as well?
