# RFC Process

This document describes the RFC process for the [npm
CLI](https://github.com/npm/cli), and provides a way for the [npm CLI
team](https://github.com/orgs/npm/teams/cli-team) and the wider community
to have discussions about the features and direction of the package
manager.

## What's an RFC?

The name is a reference to the **IETF's Request For Comments** process, and
involves a document or series of documents which are drafted, reviewed, and
eventually ratified (approved) by the npm team through discussion
among those interested, both within and outside of the npm team.

An RFC can propose any change to the npm CLI itself, and may include npm
registry changes meant to support that CLI change.

## Rough Consensus

The development of new features within the npm CLI follows a [Rough
Consensus](https://tools.ietf.org/html/rfc7282) model, similar to the IETF.

The following points are intended to help you understand and participate in
this process productively.

### Scope of This Process

This RFC process is limited to issues concerning the [npm
cli](https://github.com/npm/cli) and the web services that support it.

Of course we operate within a broad community ecosystem, and will often
choose to implement features in a way that is compatible with other package
management tools in the JavaScript community.  However, if a given proposal
cannot or will not be implemented by other package managers, that is not in
itself reason enough to abandon a proposal.  We are here to make _npm_
better.

### Full Consensus is Not The Goal

It is not our intention, or within our ability, to accomodate every
possible objection to any given proposal.  It _is_ our intention to surface
all such objections, and make an informed decision as to whether the
objection can be addressed, should be accepted, or is reason enough to
abandon the proposal entirely.

We encourage you to participate in these discussions, and to feel free and
comfortable bringing up any objections that you have or can imagine (even
if you don't entirely agree with the objection!)

Our job together then, is to ensure that the objection is given a fair
hearing, and is fully understood.  Then (either in the pull request
comments, or in our OpenRFC meetings), we will decide whether the proposal
should be modified in light of the objection, or the objection should be
ignored, or if the proposal should be abandoned.

If an objection is brought up a second time without any relevant changes,
after having already been addressed, then it will be ignored.  Only _new_
objections merit new or continued consideration.

### Iterate on Building Blocks

Frequently a feature will be proposed or even fully specified in an RFC,
and upon analysis, the feedback might be to cut it into separate RFCs, or
implement another proposal first.

This can be frustrating at times, but it ensures that we are taking care
to improve npm iteratively, with thorough consideration of each step along
the way.

### Implementation as Exploration

Typically, RFCs are discussed and ratified prior to implementation.
However, this is not always the case!  Occasionally, we will develop a
feature then write an RFC after the fact to describe and discuss it prior
to merging into the latest npm release.

Very often, an RFC will be difficult to examine without running code.  In
those cases, we may opt to develop a proof of concept (or even fully
production-ready implementation) of an RFC in process, in order to test it
in reality before accepting it.

Even when an RFC _is_ accepted, during implementation it is common to note
additional objections, features, or decisions that need to be made.  In
these cases, we may propose an amendment to a previously ratified RFC.

### Final Authority

The ultimate authority as to the ratification of any given RFC proposal is
the npm CLI team, as they have ultimate authority over the direction and
development of the actual thing these RFCs are about.

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
should be accepted, and all objections have been considered.  At that
point, it will be merged into the `latest` branch, and will be considered
"ratified".

It is common for an RFC to require multiple rounds of editing to address
concerns brought up in the discussion.

The RFC may be rejected altogether at the discretion of npm collaborators.
Reasons for this may include, but are not limited to:

- Objections are raised that are deemed to be relevant to the npm CLI, and
  cannot be reasonably addressed within the RFC.
- The feature conflicts with another intended feature, or otherwise does
  not align with the future development direction of the npm CLI.
- The feature described is prohibitively difficult to implement.
- The feature described is better addressed by an alternate proposal.

## What happens after ratification?

Once an RFC is ratified, the npm team agrees to merge a corresponding PR
implementing the described changes, provided it passes a standard code
review by the maintainers. It is **not** a guarantee of implementation, nor
does it obligate the npm team itself to implement the requested changes.

Actual integration into the CLI may also be deferred to a later date, or a
later semver-major CLI release, at the npm collaborators' discretion. All
the RFC does is communicate the team's intention to work in a given
direction.

Actual development work on the npm CLI will be ordered based on priorities
and resources that are well outside the scope of this RFC process.

### Implementation

When the changes described in an RFC have been implemented and merged into the
relevant repository (and thus, due to be released), the corresponding RFC will
be moved from `accepted/` to `implemented/`.

If you'd like to implement an accepted RFC, please make a PR in the
appropriate repo and mention the RFC in the PR.  Feel free to do this even
for work-in-progress code.  The npm CLI team will provide guidance to
ensure that the patch meets our standards and addresses the proposed RFC.

### Withdrawal

From time to time npm collaborators will review RFCs awaiting
implementation to ensure their accuracy and relevance. In cases where a
previously ratified RFC is deemed to no longer be a viable candidate for
implementation, an [**amendment section**](withdrawn/0000-template.md) will
be added **to the top** of the document outlining the reason for repeal and
subsequently moved to the `withdrawn/` section of this repository.

## How do I change an RFC after ratification?

RFCs themselves are typically only modified after ratification to address
unanswered questions that may require implementation exploration.

More often, if an RFC has been previously ratified, and either cannot be
implemented as described, or should be superceded by another proposal, it
will be withdrawn as part of another RFC submitted through this process.
