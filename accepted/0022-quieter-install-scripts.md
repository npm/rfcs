# Silence successful npm pre/post/install scripts

## Summary

`npm install` shows too much low level information which is unhelpful to
most developers.  When a build script succeeds (or when failure is ignored
for optional dependencies), there should be no output.

## Motivation

It is too difficult to tell if a `npm install` has worked or not. Users,
especially new users, are confused at the output as it looks like something
has gone wrong when everything runs just fine.

Displaying this output also reduces options for performance improvements,
as install scripts cannot be run in parallel.

## Detailed Explanation

Historically, stdio is shared with child processes for all lifecycle
scripts.  However, this means that:

1. Output is shown even when the script is successful, which can be
   confusing if the user is not familiar with their dependency's build
   process, which might be excessively verbose.
2. Output is shown when the script fails, but for an optional dependency,
   which is doubly confusing, as the _install_ process succeded, but the
   terminal is full of errors.
3. Lifecycle scripts at install time cannot be effectively parallelized
   without interleaving output, making it useless anyway.

Only show output from lifecycle scripts if the script exits in error, or
if the output of the script is the explicit purpose of the command being
run.

In general, for any scripts related to the package in the local prefix,
stdio _should_ be shared with the child process.  For any dependencies,
stdio should _not_ be shared with the child process.

So, for example, if a user runs `npm test`, then the `test` script output
should be printed directly to their terminal.  However, if they install a
package with a `postinstall` script, then that should _not_ be printed to
their terminal.

If a background script fails, then its output _must_ be included in the
error that is displayed to the user.

## Drawbacks and Considerations

Many CLI tools only print color if the `stdout` or `stderr` are a proper
TTY file descriptor.  If install script lifecycle events are run with a
`pipe` stdio, then most install scripts will be less colorful.  This is not
considered a blocker at this time.

Some developers use a `postinstall` script to print a banner on the user's
terminal asking for project funding or other support.  Despite the
controverisal opionions around this practice, npm had taken no official
stance, but recognized that it is both (a) annoying to many users, and (b)
an important way for _other_ developers to continue to work on OSS.

Prior to the introduction of `npm fund`, this was considered a blocker for
silencing build scripts, as it would silence those pleas for funding.  Now
that `npm fund` is in widespread use by developers seeking funding, this is
no longer a consideration.

## Rationale and Alternatives

One alternative approach is to set the loglevel config to `silent`.
However, this also hides errors that the user _ought_ to see, because they
caused the install to fail.

## Implementation

If everything worked, then do not show lifecycle script output from any
package but that in the current local prefix.

If anything relevant didn't work, then print the output from the failed
build script.

## Prior Art

yarn, pnpm
