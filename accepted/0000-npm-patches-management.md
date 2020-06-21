# npm patches management - a new structure for community collaborators

## Summary

This document proposes an organizational structure and set of processes that
change the way the npm CLI team interacts with external collaborators. It
establishes some new roles that collaborators can take on as they learn about
and commit (pun intended) to the project.

## Motivation

Ultimately, the goal is to open up development of the npm CLI as much as
possible, to maximize input (and contribution) from the community while
uplifting the wonderful folks who help us, and balancing that with npm, Inc's
company and product-related needs (and, potentially, future organizations that
may pay for developer time).

Right now, and for most of the history of the project, there's been no clear way
to "become" a contributor to npm that has more responsibility than any other
given community member. This has had some less than pleasant effects: For one,
it's discouraged continued contribution from interested parties and dissuaded
them from putting in the time necessary to "learn the ropes" of what has
historically been a pretty difficult codebase to deal with. For two, it puts the
entire load of any significant development or project decisions squarely on the
shoulders of the core CLI team, which at the time of this writing was a mere two
full-time developers.

And those two developers are hella burnt out on a regular basis.

At the same time, it's important to keep in mind that labor has value, and
having community members providing significant amounts of work to a project
uncompensated raises unpleasant ethical concerns and can often be an
exploitative practice, especially for some marginalized communities. It is,
essentially, paramount to asking artists for free art "for the exposure". In the
end, "exposure" is not acceptable compensation for human labor, especially
compared to cold, hard cash.

In short, the concrete goals of this process are:

* Get the community to have more ownership over a project that affects so many of them. Give them the ability to propose and make meaningful changes to the project and feel genuinely empowered to do so.
* Lighten the load on the core CLI team so they can increase their focus on features, fixes, and products that benefit the most from their domain expertise.
* Keep npm development nimble: allow efficient decision-making and find ways to prevent the long, exhausting stalemates that tend to lock down consensus-based systems.
* Preserve npm, Inc's ability to build its products for the good of the community and allow it to continue guiding its development, while empowering the community to have their own meaningful say in how that works or conflicts with their own needs and goals.
* Integrate other stakeholders more actively in our development process (such as Node Core)
* Increase the overall quality of the project by increased participation "given enough eyeballs, all bugs are shallow".
* Uplift community members that have contributed to this shared project, raising their status in the open source community.
* Encourage sustainable corporate investment into open source and the people that work on it.
* Create a positive, creative, educational, and fun environment for the npm developer community to connect and network with each other while doing cool stuff together!

## Detailed Explanation

### Collaborators and Ranking

"Collaborator" is the general term for anyone who has contributed to the npm
Core project, in any of its defined Roles, whether or not they have officially
been recognized. Anyone who officially becomes a part of a Role, in accordance
with that Role's processes, becomes a Member.

There are two types of Member: Full Members and Guest Members.

#### Full Member

These Members are considered committed, established, and can represent their
Teams and Roles in an official capacity in the project.

Full Members are official Members who contribute more than 4 hours per week to
the npm Core project. Full Members can attend wider-project meetings and take
active part in their Teams' decision-making processes (in the case of consensus
systems, they can block; in the case of voting systems, they get a vote).

#### Guest Member

Guest Members are considered valuable collaborators who make noteworthy
contributions to the project as a whole, but are not generally committed to the
project the way a Full Member would be.

Guest Members are official collaborators who contribute less than 4 hours per
week to the npm Core project. These members can only observe in decision-making
processes for various Teams, they have no special privileges granted within the
organization, and they cannot participate in Roadmap Proposal discussions.

Please note that in order to have work accepted when it takes more than 4 hours
per week, the labor must be compensated somehow. See below for details.

#### Memberships and Multiple Roles

Membership status operates on two levels: if a collaborator gains Full Member
status on _any_ Role, they are treated as Full Members in any cross-organization
situation. Within a Role, though, they are only considered Full Members if they
put at least 4 hours of compensated work _into that specific Role_.

Thus, collaborators can be Guest Members of as many Roles as will accept them,
but only Full Members of a limited number of Roles.

Additionally, there's a hard cap of 4 Full Memberships for any Member. Any other
Roles will be treated as Guest Memberships in the case of additional Roles, and
Full Memberships that the collaborator picks must be declared beforehand. Roles
should reject significant, over-4-hours worth of labor from these "Full Time"
members if they are a Guest Member of that Role.

#### Labor and Compensation Limits

In general, the npm Core project does not accept regular contributions of more
than 4 hours per week of work from any collaborator (member or otherwise) who is
not being directly compensated for that work. That is, in order for
contributions to be accepted when labor time has exceeded 4 hours per week, a
collaborator is expected to have found compensation for it. This can be
fulfilled by an employer agreeing to let the collaborator work for 4 hours a
week on general open source while on the clock, it can be an employer
specifically assigning the collaborator to npm Core for 4 hours or more per
week, or it can be a self-employed collaborator (or someone funded by donations)
who decides to invest that time from their work time.

Enforcement of this rule is done through an honor system. We trust
collaborators! We don't want a bunch of work for free! Our collaborators are
people and they're valuable, and their labor has value. npm Core does not
believe open source is an excuse for not paying people for their hard work, and
the project is committed to help facilitate this compensation.

These limits are also directly related to the distinction between the two types
of Member: Guest Members and Full Members.

### Groups and Roles

Groups are the toplevel organizational unit for the npm open source project.
Every group has a number of Roles within it (and, in the future, might have
Sub-Groups). Each Group is accountable for the responsibilities held by
individual Roles. Each Role has a set of responsibilities, which it holds
ultimate control over (barring cross-cutting concerns).

The current Groups and Roles are mutable. Individual Roles may spin off separate
Roles by surrendering some of its responsibilities. In this case, the new Role
has complete control over those, and the original one can no longer make any
calls about those. Groups can likewise be spun off if a group of Roles redefine
themselves as needing their own general Group.

Members of a Role form a "Team", and each Team gets to decide how they organize
themselves. It's suggested that until a Team grows bigger than 3 people, that
they stick to a trusting-consensus system instead of highly-formalized systems,
but it's up to the Team itself how they make team decisions. It is also up to
the Team who they allow into the Team, or whether to remove someone. For this
process, they should work with their Group's Role coordinator both to document
it and ensure that everything goes smoothly.


### Proposed Groups and Teams

#### Role: Project Coordination

* Purpose: Define and enable overall project direction

* Responsibilities:
  * Draft quarterly Roadmap Proposals based on RFCs and input from Groups/Roles.
  * Track and document Roadmap progress and check in with Groups/Roles.
  * Facilitate Roadmap Proposal discussions/meetings to reach a final decision on each Roadmap, making sure all Roles with something to say get heard.
  * Work with the rest of the project to draft or modify general project bylaws, with the exception of those overlapping with Community Health and Facilitation, which is responsible for conduct-related bylaws.
  * Hear petitions for cross-project decision requests and organize the events accordingly.

* Note: This Role is **not** a decision-making role. It is a facilitation role that acts as glue between the different groups and their roles. Ultimately, project decisions come directly from those Roles, except which group decision-making system is used for Roadmap Proposals.

#### Liaisons Group

The Liaisons group consists of only individual Liaison Roles and the Role
Coordinator. Each Liaison Role represents a single relationship between the npm
open source project and an external entity. A Liaison Role is responsible for
helping coordinate and manage two-way communication between the external
organization and the npm project team. The Role Coordinator is responsible for
working with both projects to find one or more people who would be good at
fulfilling the Liaison role. There are no hard constraints, except that those
collaborators should have relatively easy access (that is, direct lines) to both
sides. Often, these Liaisons will be company employees or external project
members.

Liaison Roles only exist for organizations that have a significant, active
investment in the project. This can be financial (by funding development) or
through some exceptional relationship (such as Node Core, which is an important
downstream consumer).

Liaisons exist to represent the interests of the external organization within
the open source project, as well as for facilitating two-way communication
between both. They have a voice in Roadmap decision-making, and are thus able to
help decide project direction overall. More fine-grained decisions can be
represented by external organization members becoming collaborators of other,
non-liaison roles, according to those Roles' requirements.

##### Role: Liaison Coordination

* Purpose: Manage Liaison Role memberships and Liaison Roles themselves.

* Responsibilities
  * Document and track existing Liaison Roles and collaborators that belong to each one.
  * Facilitate conversations between the npm open-source project and external organizations in order to create/change/remove Liaison Roles.
  * Help individual Liaison Roles find the right people to assign as collaborators.

##### Role: npm Liaison

* Purpose: Represent the overall interests of npm, Inc, in npm core.

* Responsibilities:
  * Participate in Roadmap decision-making.
  * Act as an open bidirectional communication channel between npm Core and various internal teams at npm, Inc.
  * Work with npm Product managers and npm Core developers to coordinate product releases that require work on both ends.
  * Generally represent the interests of npm, Inc, as needed.

##### Role: Node Liaison

* Purpose: Represent the overall interests of both Node Core and the Node Foundation, in npm Core

* Responsibilities:
  * Participate in Roadmap decision-making.
  * Act as an open bidirectional communication channel between various Node project segments and npm Core.
  * Make sure new npm releases are downstreamed to nodejs/node in accordance with both teams' downstreaming practices.
  * Work with Node Core to coordinate technical details of upcoming releases and any mutual changes that must be done together.
  * Keep an eye on overall health of the npm CLI in Node.

#### Community Group

The Community Group is responsible for general community interactions and
communication. Its primary domain is [npm.community](https://npm.community), and
its associated spaces.

##### Role: Community Coordination

* Purpose: Manage and coordinate cross-Role requirements between the various Community Roles and make sure the interests of the wider npm community are represented in npm Core.

* Responsibilities:
  * Document and track existing Community Roles and the collaborators belonging to each one.
  * Facilitate changes related to Role structure, their membership, and their responsibility.
  * Pay attention to the overall health and comfort of the npm userbase and spot patterns or concerns that need to be represented to other parts of the project.
  * Help clarify individual responsibilities within Community Roles.

##### Role: Support Champion

* Purpose: Help the community find answers to issues preventing them from successfully using npm Core tools.

* Responsibilities:
  * Go through [#support](https://npm.community/c/support) and triage them by tagging them and looking for duplicates.
  * Answer questions if the answer is known or exists elsewhere.
  * Reach out to relevant npm Core members for answers or making them aware of issues that might be of note.
  * Keep track of support issue patterns and work with the Documentation  and Developer Role(s) to find better ways to document and address common misunderstandings.
  * Maintain [#how-do-i](https://npm.community/c/support/how-do-i) and [#troubleshooting](https://npm.community/c/support/troubleshooting).
  * Encourage folks to file full, well-formed bug reports for things that might be bugs instead of usage questions, and [#ideas](https://npm.community/c/ideas) and RFCs for things that should be new features.

##### Role: Bug Champion

* Purpose: Ensure the overall quality of npm Core tools, particularly as it affects the wider community.

* Responsibilities:
  * Go through [#bugs](https://npm.community/c/bugs) and triage them by tagging them and looking for duplicates.
  * Keep an eye on bugs as they evolve and notify developers as needed of any important news on them.
  * Make bugs more visible to community collaborators and seek out bugfix contributions.
  * Look for overall bug patterns, areas of concern, or potential risks and communicate those with the Core Developer team and community.
  * Look for and communicate any blockers that might prevent `next` from becoming `latest`.
  * Block releases from going out if they're not up to quality standards.

##### Role: Outreach and Marketing

* Purpose: Reach out to the wider npm community and manage communications.

* Responsibilities:
  * Manage overall official comms for the project.
  * Work with Liaisons and get in touch with Marketing stakeholders to coordinate cross-project marketing comms.
  * Make the wider community aware of the project's work.
  * Help reach out to new collaborators and generate interest in contribution.
  * Give talks and presentations about the project, the roadmap, and other stuff

##### Role: Community Health and Facilitation

* Purpose: Preserve the overall health and well-being of the people in the community and help all collaborators focus on their contributions.

* Responsibilities:
  * Help create a harassment-free experience for everyone.
  * Facilitate difficult technical conversations for the rest of the project on request.
  * Provide a facilitator for cross-project votes and work with Project Coordination to smooth out the process.
  * Follow the guidelines in the Code of Conduct for addressing interpersonal conflict within the project.
  * Follow the guidelines in the CoC for enforcement actions against members, including temporary and full removals from the project, exclusion from certain Roles, etc, so long as these decisions follow processes outlined in the CoC.
  * Lead discussions with the rest of the community to define/maintain the Code of Conduct and related community health guidelines. No one with a guest or full membership in the Health and Facilitation committee is able to vote on CoC changes, but they may be heard, and they may propose changes.

#### Development Group

The Development Group is responsible for the codebases for npm Core, developing
the actual tools that the project produces.

##### Role: Documentation

* Purpose: Ensure the project has high-quality, accessible, useful documentation for its functions and various usecases, both at the user and the developer levels.

* Responsibilities:
  * Fix issues in existing documentation.
  * Make sure undocumented things get documented.
  * Maintain [#docs-needed](https://npm.community/c/docs-needed)
  * Plan out documentation reorgs.
  * Work with the npm Liaison to work with its own documentation team to keep website docs up to date and working good.

##### Role: Core Development

* Purpose: Maintain and develop the code for npm Core's collection of tools and projects.

* Responsibilities:
  * Maintain codebases.
  * Fix bugs and write tests.
  * Work with the Documentation Team to document new and existing features.
  * Implement new features in concordance with the Roadmap and other RFCs.
  * Recategorize triaged bugs and talk with community members about them.
  * Be available for the Support Team to answer questions about support issues.
  * Review pull requests and help contributors as needed until they get accepted

* Note: As with all other Roles, Core Development can spin off new Roles that it will defer some responsibilities to. It can no longer lay claim to those responsibilities once they've been handed to the other Role.

##### Role: Release Coordination

* Purpose: Manage releases of project products.

* Responsibilities:
  * Decide which Developer-accepted pull requests will go into the next release, in accordance with the roadmap, and merge them into integration branches as needed.
  * Manage release cadence.
  * Move `next` releases into `latest` based on input from Bug Champions.
  * Develop and maintain release-related ancillary systems for the project, such as CI, build processes, and release automation for the project.

### Checks and Balances

* Cap of 4 roles as "Full Member" -- no limit on guest memberships
* 4hr minimum for "Full Member" status puts a limit on overall influence
* Organization-wide decisions, such as votes, made for important situations are handled at the member level, not the role level, and always facilitated.
* Picking decision systems on a per-Role basis prevent a single governance model from preventing other Roles from having a system that works better for them, and improves the general feeling of federation/sindicalism.
* Any Full Member can petition the Project Organizers to call for a project decision. Project Organizers are responsible for choosing the format/system used for that decision (but this can be overridden by full consensus of non-Project Organizer members).
* Ultimately, the userbase organizing and forking acts as a passive check against project decisions.

## Rationale and Alternatives

Governance is intentionally very "flat", with actual authority and
responsibility bubbling "up" from individual members in their various roles.
"Higher" ranks act more as coordinators for the will of the larger community and
have no more authority over their groups/areas than any other teams. This is
intended to maximise community/collaborator control of the project, and for
emphasising that non-developer roles are considered to have as much value to the
project as roles whose output is strictly code-related.

{{Discuss 2-3 different alternative solutions that were considered. This is required, even if it seems like a stretch. Then explain why this is the best choice out of available ones.}}

## Implementation

### Resources and Transition

Launching this process will be a significant load on the CLI team until the
project is done bootstrapping. Other npm folks may help, but it's worth noting
that most of the roles described here are already roles that members of the CLI
team have already taken on as their jobs.

Transitioning to this process will require final approval of the public RFC, and
then any necessary permissions setup on `npm/cli` and npm.community. Everything
will have to be documented... somewhere. Once the transition is over, it's
expected that the CLI team will have much more time to focus on their work as
codebase maintainers, project leads, and working on products and projects
relevant to npm, Inc. itself. A lot of the "ancillary" tasks that the CLI team
is currently responsible for will become the full responsibility of community
members, instead, and potentially other employees of npm, Inc.

### Bootstrapping

At first, it'll pretty much only be npm employees taking on all available Roles.
Any npm employees participating in a certain Role, whether they put 4 hours of
work into that role, are considered Provisional Full Members of that Role.
Provisional status lasts until that Role receives its first non-npm Full Member,
at which point the npm employee loses Provisional status and will have a member
status following the usual rules of 4h -> full member.

If the Role loses all other Full Members, and no one else in the organization is
able to take on a Full Membership in that Role, a Provisional Full Membership
may be granted to an existing Guest Member, while still not allowing them more
than 4h of work. If no willing Guest Members exist, the Responsibilities for
that Role become the responsibility of other Roles with similar or overlapping
responsibilities, until the Role can find a new Full Member.

## NEXT STEPS (post-meeting)

* Extract the multiple job descriptions the CLI itself is already doing (for framing as a team within npm)
* Work on goals from the perspective of npm itself too
* Write down what this structure looks like day 0, 3mo in, 1yr in, etc
* Make a new private repo that splits into multiple documents
* Sit down and write down scenarios of what this looks like with different types of disruptive participants.
* Write a "short" spec version of this. (presumably what day 0 would look like)

## Prior Art

<!-- TODO: plenty of FOSS out there. It's worth studying how some of them are structured -->

* Node Core
* OpenStack
* Webpack
* Babel

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
