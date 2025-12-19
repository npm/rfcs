# Notification system for cli updates

## Summary

A new notification system to warn users about new versions of the **npm cli**.

## Motivation

- Remove an extra http request from the cli
- Remove dependency on `update-notifier`
- Original discussion: https://github.com/npm/rfcs/discussions/118

## Rationale and Alternatives

- Do nothing, keep the same system in place
- More alternatives?

## Implementation

- Set a `user-agent` header in the requests from the **npm cli**
- Add a check on the registry that notifies user if a greater version of the cli is available
- Add a new header in the registry response that alerts for a new version of the cli
- Also allow customization so that other registry clients can implement/benefit from the same system

## Prior Art

- https://www.npmjs.com/package/update-notifier

## Unresolved Questions and Bikeshedding

TBD
