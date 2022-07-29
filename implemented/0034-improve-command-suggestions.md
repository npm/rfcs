# Improve command suggestions

## Summary

Currently, we have a few places where a slightly incorrect command will display an error but print a "Did you mean?" type of suggestion.

For example, `npm run tes` when you have a script named `test` will suggest running `npm run test`.

These suggestions, however, are very limited and have minimal (if any) awareness of other commands.

I propose that we allow an error from a failed command to suggest entirely different commands, this would allow `npm run tap` when no script named `tap` exists to suggest `npm exec -- tap`, and `npm exec test` to suggest `npm run test`.

In addition, I propose that we remove typo-based "affordances" from commands in favor of this new suggestions engine. The breaking change there would be these affordances would stop working, and would instead inform the user of what command we believe we intended them to run.

## Motivation

Discoverability of the correct command to run when a user makes a common mistake is something we can improve. It's easy to confuse when to use `npm exec` vs `npm run`, and even easier to assume that `npm` works like `yarn` and allows you to `npm foo` for a script named `"foo"`. Instead of giving an unknown command error, we could instead present the user with a suggestion based on what we think they're trying to do. This is not quite as useful as unknown top level commands running scripts or bins, but it is far more explicit and safe.

I would note that I do not believe we should run the suggestion for them. I could, however, see prompting (when a tty is available and we are not in CI, similar to how we handle the prompt for `npx` when it needs to download a package) and asking a user if our assumption is correct and running for them at that point. Additionally if multiple suggestions are available, we could prompt the user to choose one.

A critical part of this puzzle to avoid breaking things for folks is that we default to not assuming we know what the user wants. The affordances in the npm CLI (like `npm hlep` working as `npm help`) are, in my opinion, a mistake. When a user makes a typo, we should not assume that we know what they're trying to do. We should tell them their command was invalid and suggest some valid commands that may be what they wanted.

## Detailed Explanation

As a starting point, I'd like to see this apply to the output when an invalid command is encountered as well as when no script matches in `npm run` and no binary matches when running `npm exec`. Any of these three scenarios should suggest valid `npm run` or `npm exec` commands if one seems available.

Current behavior of `npm run tes` when a script named `"tes"` is not defined, but one named `"test"` is:

```
npm ERR! missing script: tes
npm ERR!
npm ERR! Did you mean this?
npm ERR!     test
```

Proposed output with the same scenario, but the addition of a package in the tree named `test` that includes a discoverable binary:
```
npm ERR! missing script: tes
npm ERR!
npm ERR! Did you mean one of these?
npm ERR!     npm run test
npm ERR!     npm exec -- test
```

An alternative approach, without `exec` reference would be:
```
npm ERR! Missing script: "tes"
npm ERR!
npm ERR! Did you mean this?
npm ERR!     npm test # Test a package
npm ERR!
npm ERR! To see a list of scripts, run:
npm ERR!   npm run
```

Current behavior of `npm foo` where `foo` is an unknown command:

```
Top hits for "foo"
————————————————————————————————————————————————————————————————————————————————
npm help package-json                                                     foo:50
npm help exec                                                             foo:16
npm help npx                                                              foo:16
npm help folders                                                          foo:15
npm help scripts                                                           foo:7
npm help config                                                            foo:7
npm help init                                                              foo:6
npm help developers                                                        foo:4
npm help star                                                             foo:3
npm help package-lock-json                                                 foo:3
————————————————————————————————————————————————————————————————————————————————
(run with -l or --long to see more context)t
```

Proposed behavior of `npm foo` when both a script named `"foo"` and a package named `foo` with a discoverable bin exist:
```
npm ERR! unknown command: foo
npm ERR!
npm ERR! Did you mean one of these?
npm ERR!     npm run foo        # (runs the "foo" script)
npm ERR!     npm exec -- foo    # (runs the "foo" binary in node_modules)
```

The current behavior of `npm exec` is ambiguous enough that implementing these suggestions in a reasonable way there is near impossible. This feature would depend on a proposal such as [#336](https://github.com/npm/rfcs/pull/336) having been implemented in order to be able to avoid the current fallbacks built in to `npm exec`.

## Rationale and Alternatives

This is an alternative to allowing unknown commands to fall back to running scripts or executing binaries, the advantages of this implementation are that it does not make assumptions about what the user wants, and it does not take action without the user being explicit.

We do, however, maintain the benefits of helping the user determine what command they actually intended to run.

Improving discoverability of the correct commands is a safer approach than creating ambiguous behavior.

## Implementation

I would suggest that we add a blessed property to errors thrown by commands `suggestions`. In the CLI framework, if a command rejects with an error that has this property, we display the suggestions.

As for discovering the suggestions, we already have logic to find similarly named scripts based on levenshtein distance. This would need to be abstracted to a utility that can be consumed in `run-script` as well as `exec` and `help-search`.

Discovering installed binaries is a new feature, implementation for that is discussed in [#336](https://github.com/npm/rfcs/pull/336). We would take the same approach putting the discovery in a utility and consuming it in `exec`, `run-script` and `help-search`

## Prior Art

The `git` CLI suggests commands based on typos, but does not run them for you. For example:

```
> git commti
git: 'commti' is not a git command. See 'git --help'.

The most similar command is
	commit
```
