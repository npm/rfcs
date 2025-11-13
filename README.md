# The npm CLI RFC Process

This document describes the RFC process for the npm CLI. The intent of this process is to provide the [npm CLI team](https://github.com/orgs/npm/teams/cli-team) as well as the broader npm team to gather feedback from our community, as well as providing a means for the community to have discussions about features and the direction of the npm package manager.

## What is an RFC?

The name is a reference to the **IETF's Request For Comments** process. An RFC can propose any change to the npm CLI. In some cases an RFC may also propose changes to the public npm registry or other services, however changes outside of the npm CLI itself will require more time and engagement with the broader npm team in order to be ratified.

The npm team's roadmap is **not** determined by the RFC process. Approval of an RFC **does not** guarantee its implementation, only that if the work were to be completed to the standards upheld by the npm team the implementation will be accepted. If you open an RFC you should be prepared to carry it through implementation yourself. The npm CLI team maintains a presence in the [Open JS Foundation Slack](https://openjsf.org/collaboration/)'s `#npm` channel to assist community members through this process.

## Review Process

After an RFC has been opened, the npm CLI team is responsible for providing an initial review within 2 weeks.

After this inital review the RFC will be added to the agenda of an upcoming Open Office Hours call. The author of the RFC will be notified when their RFC is scheduled for discussion, and is encouraged to join this call. Their participation in the call is not mandatory, and if they are unable to attend feedback will be gathered on their behalf and shared as comments to the RFC.

All discussions surrounding an RFC are covered by the npm [Code of Conduct](https://www.npmjs.com/policies/conduct). Please keep conversations constructive, civil, and low-temperature. If tensions flare during discussion, the npm team may, at its own discretion, moderate, remove, or edit posts, as well as locking the discussion on that PR or the entire RFCs repository.

### Approval and Rough Consensus

The approval of RFCs follows a [Rough Consensus](https://tools.ietf.org/html/rfc7282) model, similar to the IETF.

Feedback is gathered through comments in the RFC issue as well as real time conversation during Open Office Hours. The purpose of this feedback is to provide a means for the community to raise objections to proposals. Each objection will be discussed and considered. It is not a goal for everyone to agree on all aspects of an RFC. Objections do not prevent an RFC from being ratified, but they must be given a fair hearing until an understanding is reached and an informed decision can be made.

When a proposal no longer has **new** objections it has completed the review process and may move into implementation.

While community feedback is an important part of our process, the npm CLI team holds the final authority for approving or rejecting an RFC.

### Reasons an RFC could be rejected

The npm team may choose to reject an RFC and close it. Here is a non-exhaustive list of reasons this could happen:

1. The proposed feature is in direct conflict with existing features or is generally undesirable
2. There is no commitment to completing the work
3. Objections are raised that are deemed to be relevant and cannot be reasonably addressed
4. The feature is prohibitively difficult to implement
5. The feature is better addressed by an alternate proposal
6. The scope of changes extends beyond the reach of the npm CLI
7. The feature does not align with the future development direction of the npm CLI
8. The implementation has stalled with no clear path forward

## Implementation and Communication

After an RFC is approved it will remain open as the primary means of communicating about the feature work. After the implementation is complete the npm team will review the changes made for code standards as well as ensuring that the implementation matches what was described in the RFC.

### Modifying an RFC after approval

It is possible that an RFC will require changes after it has been approved and implementation has begun. When this happens, the npm CLI team will use their discretion to determine if the RFC should be added back to an Open Office Hours agenda or to approve or reject the change, or the entire RFC, directly.

---

## Open Office Hours

In our ongoing efforts to better listen to & collaborate with the community, we've started an open office hours call that helps to move conversations on RFCs forward as well as help answer broader community questions. It is meant to provide a synchronous forum to engage with the community beyond the discussion/comment threads in issues & PRs.

The first half of Open Office Hours is meant to discuss RFCs that are on the agenda. The second half is an open conversation allowing our community to ask questions, share what they're working on, talk about ideas or even just to say hello.

### When?

#### ~Wednesday's @ 2:00 PM EST~ UNTIL FURTHER NOTICE, OPEN OFFICE HOURS HAVE BEEN SUSPENDED

**Cadence:**
This event is scheduled to take place **weekly**. Previous meetings (including "Open RFC" calls) agendas & notes can be found [here](https://github.com/npm/rfcs/issues?q=is%3Aissue+sort%3Aupdated-desc+is%3Aclosed+label%3Ameeting) or watched on [YouTube](https://www.youtube.com/playlist?list=PLQso55XhxkgBKhtFahRx20wyWE488kKJJ).

### How to join?

**Add to your Calendar:**

You can track all **npm** public events by adding/tracking our **public events calendar**:

* gCal: [`https://calendar.google.com/calendar/embed?src=c_a0133cbf87923c19822d1e868565c3ed281dc47859d9523a2462f4a6a57f20c8%40group.calendar.google.com`](https://calendar.google.com/calendar/embed?src=c_a0133cbf87923c19822d1e868565c3ed281dc47859d9523a2462f4a6a57f20c8%40group.calendar.google.com) 
* iCal: [`https://calendar.google.com/calendar/ical/c_a0133cbf87923c19822d1e868565c3ed281dc47859d9523a2462f4a6a57f20c8%40group.calendar.google.com/public/basic.ics`](https://calendar.google.com/calendar/ical/c_a0133cbf87923c19822d1e868565c3ed281dc47859d9523a2462f4a6a57f20c8%40group.calendar.google.com/public/basic.ics)

**Zoom Link:** You can join the Public Open Offices hours Zoom calls [here](https://github.zoom.us/j/93497811229?pwd=SjJWaVd1V2dEZkMvUWRMQlFYdVgzQT09)
