# npm RFC Process

This document describes the RFC process for the [npm
CLI](https://github.com/npm/cli), and provides a way for the [Community & Open Source Team]() and the
wider community to have discussions about the features and direction of the
package manager! It is based on [the WeAllJS RFC process](https://wealljs.org/rfc-process) and the [Rust RFC process](https://github.com/rust-lang/rfcs), and, by extension, the [Yarn RFC process](https://github.com/yarnpkg/rfcs)

## What's an RFC?

The name itself is a reference to the IETF's Request For Comments process, and
basically involves a document or series of documents which are drafted,
reviewed, and eventually ratified (approved) by the npm team through discussion
among those interested, both within and outside of the npm team.

An RFC can propose any change to the npm CLI itself, and may include npm
registry changes meant to support that CLI change.

This RFC process replaces feature requests in the main npm repository, and
feature requests made there will be redirected to the RFCs repository.

## How do I create an RFC?

* Fork https://github.com/npm/rfcs
* Copy `accepted/0000-template.md` into `accepted/0000-your-rfc-name.md`
* Fill in and edit the template with your proposal
* Submit a PR to the `npm/rfcs` repo

## How does review work?

The official place for discussion for a proposed RFC is its pull request.
Anyone, both npm collaborators and non-collaborators, may participate in the
discussion and ask questions and provide (constructive) feedback. Keep in mind
that only npm collaborators are able to ratify the RFC itself, even if other
users can comment.

All discussions surrounding an RFC are covered by the [npm Code of
Conduct](https://www.npmjs.com/policies/conduct). Please keep conversations
constructive, civil, and low-temperature. If tensions flare during discussion,
the npm team may, at its own discretion, moderate, remove, or
edit posts, as well as locking the discussion on that PR or the entire RFCs
repository.

## How do RFCs get ratified?

An RFC is ratified when there is consensus among npm collaborators that it
should be accepted. Once all collaborators have become aware of the RFC and had
a chance to comment on it, the PR, along with the RFC, will be merged and the
RFC will be considered ratified.

Until an RFC is ratified, it's expected that its original author continue
discussing it and integrating feedback into the document until it's ready.

RFCs have a **minimum 24 hour waiting period** before being accepted or rejected.
Once an RFC has been reviewed on GitHub, with all interested collaborators
having an opportunity to review it, and at least one npm collaborator has signed
off on the changes, the PR will be accepted and all its connected changes
merged. There are two exceptions to the collaborator rule:

* [@isaacs](https://github.com/isaacs) is considered an npm collaborator even if not an active code contributor, and thus has the ability to veto any proposal.
* The npm registry team has complete control over what registry changes happen and are not subject to the consensus process: they get to decide whether the registry side of a feature gets implemented, where, and how, but they otherwise are not considered collaborators.

If it's specifically requested, or if the npm team determines that the topic of
the RFC demands extra attention and care because of its potential impact, an
RFC's "ratification period" may be extended for as long as the participants and
admins feel is a reasonable length of time for consideration.

The RFC may be rejected altogether at the discretion of npm collaborators. They
may also be rejected if consensus has not been reached and discussion and
progress on the RFC itself remain inactive for too long.

## What happens after ratification?

Once an RFC is ratified, the npm team agrees to merge a corresponding PR
implementing the described changes, provided it passes a standard code review by
the maintainers. It is **not** a guarantee of implementation, nor does it
obligate the npm team itself to implement the requested changes. Actual
integration into the CLI may also be deferred to a later date, or a later
semver-major CLI release, at the npm collaborators' discretion. All the RFC does
is communicate the team's consensus to accept a change.

When the changes described in an RFC have been implemented and merged into the
relevant repository (and thus, due to be released), the corresponding RFC will
be moved from `accepted/` to `implemented/`. If you'd like to implement an
accepted RFC, please make a PR in the appropriate repo and mention the RFC in
the PR. Feel free to do this even for work-in-progress code!

## How do I change an RFC after ratification?

RFCs themselves cannot be modified after ratification, but new RFCs can be
proposed and ratified to amend or remove a change previously ratified through
the RFC process. These amendments will involve the exact same process as a
regular RFC.
