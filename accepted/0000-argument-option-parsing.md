# Option and Argument Parsing for npm

## Summary

Currently, option, and argument handling in npm is not using any kind of
standard library (either internal or a third party lib). In addition, invalid
arguments or flags are not detected for any of the subcommands. Where possible,
invalid arguments or flags should throw an error.

## Motivation

Originally proposed in [this issue](https://github.com/npm/npm/issues/20856).

Because there's no error thrown when invalid command-line flags are passed, you
can pass in invalid flags and not realize they're invalid for a particular
context. e.g., if you type: `npm audit --format=json` instead of `npm audit
--json` you get the normal output of `npm audit` without any arguments, vs. an
error that you passed an invalid flag. For `npm install` and some other
subcommands, this may be unavoidable, for reasons described
[here](https://npm.community/t/invalid-command-line-flags-are-ignored-vs-throwing-error-usage/164/2).
Basically, there are cases where people rely on the behavior of additional
command line arguments getting passed through to scripts that it runs
indirectly.

## Detailed Explanation

This would pull in a third party lib, and / or create new methods in the core
libs that would be used to declare subcommands, arguments, and options in a
standardized way. Ideally, it should be self-documenting (so that usage text,
auto-completion, help pages, etc. could be as auto-generated as possible).

## Rationale and Alternatives

The main rationale is that exiting non-0 and throwing an error is the correct
behavior when the user passes in ambiguous or invalid input. 

Additionally, if the command line flags and args are built and documented
using a standard library, there's less chance for drift between usage / docs
and reality as new subcommands, flags, and arguments are added. After the
initial work, this should also make implementing new options easier.

I'm guessing it could also make keeping completion up to date easier.

## Implementation

From the discussion, it sounds like using a third party library is not an
option. According to developers, this would probably be handled in
`lib/config/core.js` or possible `lib/config/defaults.js`.

This would be considered a major / breaking change.

## Prior Art

* [ava](https://github.com/avajs/ava/blob/master/lib/cli.js) - uses [meow](https://www.npmjs.com/package/meow)
* [forever]() - seems to use a [custom internal lib](https://github.com/foreverjs/forever/blob/master/lib/forever/cli.js)

## Unresolved Questions and Bikeshedding

I guess one question is whether the inconsistent behavior between subcommands
would be an issue if some subcommands (`npm run` and `npm audit` were mentioned
as subcommands that could possibly be switched to reject invalid args) had this
behavior, but others allowed everything.

I would argue that even if invalid flags can't throw an error, there would be
some benefit to allowing subcommands and arguments to be more self-documenting
than they are now.
