# Handling of npm config options in the CLI and dep stack

NB: this is an internal RFC related to the code structure and patterns of
the CLI and its dependencies.  No user-facing changes are contemplated by
this proposal.

## Summary

- Replace usage of `figgy-pudding` with plain JavaScript option objects.
- Document and define defaults for configs used by each module in the
  stack.
- Clone options objects if they may be mutated in the future.
- Pass options objects intact to components further down the stack.
- Canonicalize option names to match consistent `camelCase` format.

## Motivation

The goal of FiggyPudding was to get the npm CLI and its associated
dependencies away from having a shared `npmconf` god-object with `.get()`
and `.set()` methods, which could be mutated at any time, and contain any
arbitrary fields.

However, the use of FiggyPudding has led in practice to added complexity
and an even _more_ entrenched reliance on a god-object pattern, albeit one
that is even more opinionated and harder to use than `npmconf` was.

In one example where this has proven particularly challenging, `npm ci`
does not get the full set of config values, and thus it does not properly
respect config values that would be handled if the user ran `npm install`.
Since _all_ package tree generation and reification will be handled by an
external dependency in npm v7 (ie, `@npmcli/arborist`), this will become an
even bigger issue.

## Detailed Explanation

In all of the CLI's dependencies, remove `figgy-pudding`, and replace with
an options object that uses the canonical names for npm config values.

In the npm CLI, create an options object with these canonically named
fields, applying defaults and resolving aliases, as appropriate, using the
`npm.config` object as its source of truth.

### Canonical Naming

Use the `camelCase` forms of all config fields.  For example, if the user
runs `npm install --prefer-online`, then the config options object would
contain `{ preferOnline: true }`.

Thus, the npm CLI's dependencies should use `options.preferOnline` instead
of `options['prefer-online']`.

## Rationale and Alternatives

It's worth noting the problem that figgy-pudding aims to solve and the value
it currently provides, and ways that we will continue to solve that problem
and gain that value.

1. A figgy-pudding config object is a self-documenting list of the options
   that a given module uses, with defaults, canonical name, and so on.
2. Figgy-pudding allows a module to have a _different_ set of respected
   configs than it provides to the modules deeper in the stack, because
   they all proxy to the same underlying data object.
3. Figgy-pudding prevents any accidental mutation of the options provided
   to a module.
4. Use of figgy-pudding avoids tight coupling to an `npmconf` object with
   `get` and `set` methods.

The response to these points is:

1. It is better to document the list of options that a module uses _in its
   documentation_, and make it clear in the code what their default values
   are.  For example, instead of: 

    ```js
    const MyOptions = figgyPudding({
      someFoo: { default: 'foo' },
      myBar: {},
    })

    module.exports = (options) => {
      options = MyOptions(options)
      // ...options.someFoo
    }
    ```

    We will now do:

    ```js
    module.exports = (options = {}) => {
      const { someFoo = 'foo' } = options
      // doSomething(someFoo)
    }
    ```

    and document the `someFoo` field in the package `README.md`.

2. When a module in the CLI dependency stack needs to call out to one lower
   down (for example, arborist calling pacote, which in turn calls
   npm-registry-fetch, which then calls make-fetch-happen, etc.), we can
   just pass the options object to the deeper dep.

    It's _fine_, really.

3. When an options object might be mutated, it should be cloned first.  For
   example, instead of:

    ```js
    class Foo {
      constructor (options) {
        this.options = options
        // ... later ...
        this.options.foo = 'foo'
      }
    }
    ```

    we will now do this:

    ```js
    class Foo {
      constructor (options = {}) {
        this.options = { ...options }
      }
    }
    ```

4. We achieve the same benefit by passing plain old JavaScript objects as
   arguments rather than sharing an npmconf object.  The `npm.config`
   object will only be used to create the config object that gets passed to
   dependencies, it will never be shared directly.

Some alternatives:

### Continue Using Figgy Pudding

One alternative is to update tar, pacote v10, and arborist to use
figgy-pudding as well, and fix the issues that make it a challenge in other
scenarios.

It is our assessment that doing so involves more work than simply removing
figgy pudding from the CLI entirely, and solving the problems in a
different way.

### Create a less opinionated/easier to use/less read-restricted version

We could update figgy-pudding to be less of a pain to work with.  However,
we would remain in a mode of having a very unusual way of passing around
option arguments to functions and classes, which runs against the grain of
JavaScript development.  And, reducing the restrictions of figgy-pudding
would tend to also reduce its benefits.

Ultimately, we don't need something to _enforce_ config object and
documentation discipline, we just need to be disciplined about config
object usage and documentation.

## Implementation

Note: all of this is planned for npm v7.  It has no effect on npm v6, or
any versions of any deps used by npm v6 and before.

While making changes to deps and the CLI, update documentation to specify
which config values are relevant, and consider adding tests to ensure that
provided config objects cannot be inappropriately mutated.

### Phase 1 - Canonicalize Config Names, provide POJO config

- Create a list of all the config names and their canonical names.
- Update the CLI to create this object and pass it to dependencies instead of
  the figgy-pudding object currently created in
  `lib/config/figgy-config.js`.

This will require updating some cases where css-case config keys are used
rather than camelCase, but otherwise, should be relatively straightforward.
Anything that takes a FiggyPudding object can also take a regular object as
an argument.

### Phase 2 - Deepest Nested Deps

- Create semver-major updates to `ssri`, `npm-registry-fetch`,
  `npm-pick-manifest`, and `cacache` to take a plain old config object
  instead of a figgy-pudding object, and use canonical config keys.
- Update direct usage of these within the CLI to provide the plain
  JavaScript object instead of the FiggyConfig object.

### Phase 3 - `libnpm*` Deps

- Update `npm-profile` and all of the `libnpm*` dependencies (except for
  `libcipm`, which will be removed in npm v7 and replaced by arborist) to
  use the canonicalized pojo config object, and pass the same downstack to
  their deps.
