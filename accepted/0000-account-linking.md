# RFC: Account Linking

## Summary

Add a verified way to link your npm account with other accounts that you own.

## Motivation

Today, you can add your GitHub or Twitter username to your npm profile, which
helps the community figure out who you are on other services. However, this is
not a verified process, and thus it is possible to masquerade as someone you're
not. By adding integrity to account linking, we solve this problem and also
create the potential for authentication via third-party services.

## Detailed Explanation

We need a new subcommand in the CLI that will enable an authenticated user to
link their npm account with an account on another service. To avoid vendor
lock-in, we will not define a specific list of third-party service in the CLI,
and will instead leave it to the upstream registry to figure out what services
are available for linking and inform the CLI accordingly.

As an additional security measure, we will also add nonce support to the CLI to
avoid the possibility of replay attacks.

## Rationale and Alternatives

One alternative is to make no changes. This maintains the status quo where
an npm user can pretend to be anyone on GitHub or Twitter, which damages the web
of trust in the JavaScript ecosystem.

Another alternative is to implement this change, but as a web-based flow that is
managed fully within a user's account profile page. However, if you use npm with
a third-party registry (like Artifactory or Nexus Repository Manager), you will
still need a CLI-based interface. Also changing the website is a larger effort
and thus not as tightly scoped as a CLI-first solution.

A CLI-based workflow for account linking is the fastest path to
validating the integrity of associated accounts in the JavaScript ecosystem.

## Implementation

* Add a new `link` subcommand under `npm profile`, which accepts an optional
  positional argument (e.g. `npm profile link github`).
** If you run `npm profile link` with no arguments, the registry will return a
   list of third-party services that you can link.
** If you provide one of these services as an argument to `npm profile link`,
   the registry will open a browser window and attempt to authenticate to your
   account on that third-party service.
* The CLI should generate a nonce to circumvent replay attacks.

**NOTE:** If the CLI generates a nonce, all npm registries must also implement
nonces, or else login will always fail. Accepting a response without the nonce,
when a nonce was provided, defeats the purpose. See [npm/npm-profile#7](https://github.com/npm/npm-profile/issues/7)
for more details.

## Prior Art

This feature is inspired by the standard OAuth flow of "Login with X", which is
common for services that want to provide users with the ability to login with a
third-party authenticator. This has the side-effect of linking those accounts
together, which is what this RFC is designed to accomplish. You will still need
to manage separate npm credentials [for now].

## Unresolved Questions and Bikeshedding

