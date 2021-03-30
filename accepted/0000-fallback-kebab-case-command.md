# Fallback to kebab-case command

## Summary

If the command is unknown, then fallback to it prefixed with `npm-` if that is in the `PATH`.

## Motivation

It allows users to create custom commands for `npm` such as:

```sh
npm my-command
```

## Detailed Explanation

Let's say that `npm my-command` is run. Then `npm` should first see if their is a builtin command called `my-command`. If not then it will look through the path for `npm-my-command`. If that fails, then the current fallback will be run:

1. Command exists?
2. Custom command on `PATH`?
3. Fallback

## Rationale and Alternatives

It is currently not possible to do this.

## Implementation

All that will have to be done is have a conditional check before the fallback checking if there is a custom command. If there is, then the arguments will be passed to it.

## Prior Art

N/A

## Related resources and links

https://github.com/npm/rfcs/pull/332 was related to this proposal
