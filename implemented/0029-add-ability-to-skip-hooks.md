# Add the ability to skip pre- and post hooks when running a script

## Summary

Today, when running any `npm` script, there is no way to skip a script's pre and/or post hook. I'd like this to be changed.

## Motivation

When running `npm install` today, it's very easy to ignore any `postinstall` scripts, for example, by using the `--ignore-scripts` option. When using `npm test` (which, on first glance, seems like a top-level command as well) however, the same does not work.
Additionally, if for example you have a `pretest` script defined such as `"pretest": "npm run lint"` but you would want to run skip linting this time for whatever reason, that is not possible other than completely removing the `pretest` script from `package.json` temporarily.

## Detailed Explanation

I would suggest to change the behavior of the `--ignore-scripts` option to also skip the `pre` and `post` hooks of a given command.
To me, this would feel consistent with the behavior of how the flag works with `npm install` already today. It would establish the semantics as "run only the command/script I specified, nothing else".

## Rationale and Alternatives

Instead, we could add a separate flags `--ignore-hooks` (or similar). This would have the benefit that it does not alter the existing behavior of `--ignore-scripts`. It would however be difficult to come up with a descriptive name for this new option and I'd imagine the differences and superficial overlap with `--ignore-scripts` be difficult to explain and not intuitive to understand.

Alternatively, we can just not change anything and rely on users manually editing their `package.json`

## Implementation

_skipped for the moment_
