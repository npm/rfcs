# Run Suggestions

**IMPLEMENTED** by [npm/npm#20879](https://github.com/npm/npm/pull/20879).

## Summary

This proposal is for adding additional "help" text when a command name provided to `npm run` is not found.
Using primarily [edit distance](https://en.wikipedia.org/wiki/Edit_distance) heuristics, this feature will suggest similar named `scripts` to assist users in running their commands.

## Motivation

When you mistype a script name within `npm run`, there is no suggestion of similar commands you might have meant.
This can be particularly confusing for users not yet familiar enough with npm to know to check their `package.json`.

Suppose a user has a script `lint:src` and tries these commands:

* `src:tslint` ❌
* `src:lint` ❌
* `tslint:src` ❌
* `lint:srv`❌
* `lint:src` ✔

When any of the ❌ scripts are attempted, the output contains only a complaint and a log location:

```
λ npm run src:lint
npm ERR! missing script: src:lint

npm ERR! A complete log of this run can be found in:
npm ERR!     C:\Users\smoosh\AppData\Roaming\npm-cache\_logs\2018-05-24T10_40_07_124Z-debug.log
```

It would be useful to suggest the correct script to run (see below for formatting proposals).

## Detailed Explanation

I think the only interesting logic here is how we determine which script names are similar enough to print.

Easy mode: `tslint:src`❌ and `lint:srv`❌ have low [edit distances](https://en.wikipedia.org/wiki/Edit_distance) to `lint:src`✔.
Solution proposal: if the script isn't found, give the first 1-3 scripts with a low Levenshtein distance out of the union of (built in scripts) & (package.json scripts).

Hard mode: `src:lint`❌ flips `lint:src`✔ around the `:`.
How common is the `group:specific` pattern?
It could be useful to also check reverses of the scripts and consider them in the edit distances.

## Rationale and Alternatives

It could keep the same behavior, which I think doesn't help users with script typos.

It could show all scripts as per `npm run` without arguments.
This doesn't seem like it would help with confused users; not explicitly calling out probable typos won't suggest a typo to the user.

## Implementation

See _Detailed Explanation_.
Are there more implementation details you'd like me to go into?

## Prior Art

Git uses Levenshtein Distance ([source](https://github.com/git/git/blob/1f1cddd558b54bb0ce19c8ace353fd07b758510d/help.c#L302)) to suggest similar commands:

```
λ git pun
git: 'pun' is not a git command. See 'git --help'.

The most similar command is
        prune
```

Within code, language services such as TypeScript's will suggest similar names when an unknown member/property is provided ([source](https://github.com/Microsoft/TypeScript/blob/e53e56c/src/services/codefixes/fixSpelling.ts#L28)):

```typescript
class Foo {
    myBar = 7;
}

// Property 'myBaz' does not exist on type 'Foo'. Did you mean 'myBar'?
new Foo().myBaz;
```

## Unresolved Questions and Bikeshedding

### Placement

How we present the option is interesting.
I would like this to be targeted in experience for users unfamiliar with npm, as they are arguably the most likely to need the assistance.
How about basing it off of Git's format:

```
λ npm run src:lint
npm ERR! missing script: src:lint

npm ERR! A complete log of this run can be found in:
npm ERR!     C:\Users\smoosh\AppData\Roaming\npm-cache\_logs\2018-05-24T10_40_07_124Z-debug.log

'src:lint' is not a script specified in your package.json. 

Did you mean to type:
    npm run lint:src
```

This proposal intentionally break conventions (and practicality?) of having the log location be last.
It's easy to miss verbose output not at the direct top or bottom of the log.
Putting suggestions last places them closest to where the user is typing and therefore more likely to see.
Is such a thing possible?

#### Suggestion text

Git only suggests command names for brevity.
An equivalent here would be:

```
Did you mean to run:
    lint:src
```

However, I would prefer to explicitly list out `npm run lint:src` as the runnable command:

```
Did you mean to type:
    npm run lint:src
```

* It's slightly easier to select the full new command for copy & paste to run it.
* There's no ambiguity over whether to run `npm run command` or just `command`.
    * A command named something like `npm-run` could be confusing.

#### 📎

Additionally, what is the npm team's opinion on Easter eggs for the CLI?
Can we add a `--clippy` CLI flag / `clippy` `.npmrc` setting to phrase the suggestion like [Clippy](https://en.wikipedia.org/wiki/Clippy)?
If so, could we add the 📎 emoji if the console environment is known to support it?

```
λ npm run src:lint
npm ERR! missing script: src:lint

npm ERR! A complete log of this run can be found in:
npm ERR!     C:\Users\smoosh\AppData\Roaming\npm-cache\_logs\2018-05-24T10_40_07_124Z-debug.log

📎 I see you're trying to run a command! I don't see this one in your package.json.

Did you mean to type:
    npm run lint:src
```
