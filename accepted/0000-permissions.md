# `"permissions"` field for management of policies

## Summary

Add a `"permissions"` field to the standard fields picked up by `npm` when
reading `package.json` during installation. This field will request approval to
modify a global policy file with the requested permissions.

## Motivation

Users want to gain confidence that when they run scripts from `npm` they are not
given capabilities which they were not intending. For example, a user
installing a math library would not want to grant that package access to the
network. However, there isn't a clear signal when installing a package from
`npm` for what the expected capabilities it needs to function.

Introducing a field that does allow listing capabilities, would allow a consumer
of the package to accept the risk and grant the permissions to access
capabilities that limit what a package could access. Likewise a package author
could prescribe what permissions their package needs. This feature does need to
be done at install time due to needing to constrain usage of lifecycle scripts.

{{Why are we doing this? What pain points does this resolve? What use cases does it support? What is the expected outcome? Use real, concrete examples to make your case!}}

## Detailed Explanation

### Defaults should be permissive

In order to prevent backwards incompatibility from packages lacking
`"permissions"` the default behavior should be to accept all ambient permissions
and to not perform integrity checks at runtime. This would allow for packages
to continue to run if users are willing to install them without `"permissions"`.

### Listing modules needing integrity checks

It isn't feasible to know this, with default permissiveness it shouldn't be checked.

A flag to assert integrity on all files would be possible for easy configuration, but it might be too restrictive.

Likely flagging individual files can be left to a follow on.
### Listing possible packages that could be loaded

A combination of `import`/`require` call sites comparing what is resolved on
disk and the `node:` built-ins. Can use:

```cjs
require('module').builtinModules
```

To determine what valid built-ins are.

Static tools like `tofu` used by `node-policy` might be a way to automatically
estimate what the expectation is for a permissions field.

### Produce a guide on noise/signal usage for the feature

Avoid CVE prototype pollution style noise/signal ratio somehow.

### Produce usage guides for the produced artifacts.

Example, show the potential to keep an audit log of the permissions that an
application could duse from the produced `policy.json` file.

Example, show the potential to detect invalid alteration of the program prior
to running.
### Produce a set of best practices

- Why have a policy file outside of the current directory?

Explain need for --policy-integrity to avoid mutation of policy file causing a
privilege escalation. Explain denial of service if policy file is modified.

### Produce a tool for authors to get estimated field value

Some workflow that can be done as a PR bot, cli prior to publishing, and/or
Github action to ease package authors enabling the field should exist.

{{Describe the expected changes in detail, }}

## Rationale and Alternatives

### Alternative 1: CLI permissions E.G. `npm i --grant=fs --grant=http foo`

`npm` could allow users to declare what permissions they are granting through
flags in the CLI.

This would unfortunately break down once you start mixing modules with different
capability requirements:

```sh
npm i --grant=https express event-stream
```

In this example, it is undesirable to grant `event-stream` the capability to use
HTTPS, but there isn't a clear way in a simple CLI to limit this to just one of
the installing packages.

Additionally, this would mean that users would have to have a cycle of attempts
to grant permissions by reading the requirements manually, or seeing the
application failing and repeatedly granting more permissions.

```sh
# when this fails, they take the error message,
# and --grant until it goes away
node app.js
```

The problem centers around package authors not being able to list their
capabilities and relying on consumers to list those capabilities manually.

One nicety here is that if a installer lists their expectations they do not
need to be prompted at install time if the capabilities to grant match their
expectations.

### Alternative 2: Static Analysis

Tools like [`node-policy`](https://github.com/bmeck/node-policy) take a static
analysis approach to determining the capabilities of a package. Unfortunately,
it must be conservative and grants definitely more permissions than are needed.
This is because packages include files that are not intended to be used such as
examples and test files. Additionally static analysis has limitations and is not
capable of determining dynamic behaviors such as those involving runtime
evaluation results.

It would be feasible with such a tool to try and automatically generate a list
of capabilities for a package author which could then be manually pruned prior
to publishing.

### Alternative 3: External Tooling

It is possible to ship a different CLI that isn't part of `npm` that does these
behaviors; however, due to integrations with lifecycle scripts it would
generally need to completely recreate the `npm` CLI and may fall out of sync
with the `npm` behaviors for various things.

{{Discuss 2-3 different alternative solutions that were considered. This is required, even if it seems like a stretch. Then explain why this is the best choice out of available ones.}}

## Implementation

Have `npm` manipulate a well known `policy.json` policy manifest when performing
package installation.

Policies have 2 different high level features: `integrity` and `dependencies`.
In general most people think of grouping a package boundary into a single
security boundary. Features to create the policy entries likely would fall
under `"scopes"` for this reason.

Packages work at several different time frames: various lifecycle scripts and
runtime. Features likely want to configure permissions against these time
frames.

In `package.json` listing what files are used at a given time would allow
creating `integrity` to avoid various attacks manipulating the package itself.
This however, might be undesirable if the package writes to disk inside its
package directory.

In `package.json` there is already a listing of different dependencies. Defining
when those are available and listing what external dependencies their might be
would allow populating `dependencies`. In particular if a package needs
arbitrary access to `require`/`import` dependencies outside of their package
such as a global `.eslintrc.cjs` they would need to be able to escape any direct
mapping and thus would likely use `"dependencies": true` in policy entries.
Likewise, `node:` builtin modules are not listed in dependencies and would need
to be listed for the package to be granted the capability to access them.

{{Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

### [SES](https://github.com/Agoric/SES-shim)

The shim here uses manual configuration to enforce boundaries via ideas from the
TC39 Realms/Compartment proposal. It uses a JS API to perform the containment.

### [LavaMoat](https://github.com/lavamoat/lavamoat)

This uses SES and builds upon it to generate the boundaries and do inter-package
linkage. It is using a specialized runtime to work around various limitations.

{{This section is optional if there are no actual prior examples in other tools}}

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}

## Unresolved Questions and Bikeshedding

### Lifecycle scripts as shells

In general, a lifecycle script is a shell and has the ability to arbitrarily
execute code that may escape containment attempts. These can be granted a unique
policy file, but the shell itself is the escape mechanism then. Forcing
evaluation to go through node to use a policy is possible, however existing
mechanisms like [allow-scripts](https://github.com/dominykas/allow-scripts) seem
like potentially less chaotic approaches.

### Enforcement for `bin` installations

In order to use a policy, a CLI flag or ENV variable must be set. It is unclear
how this would work unless a wrapper is used for all `bin` installations.

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
