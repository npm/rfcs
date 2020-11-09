# Add `default-command` Config

## Summary

Create a config value `default-command`, which is the default command npm
runs when the first positional argument does not match any known command.

Default to `help`, to preserve the current behavior of npm.

## Motivation

If the root project package.json file contains a `"scripts"` section, then
yarn will treat any defined script names as top-level commands, if they do
not conflict with any known npm command.

We frequently get requests from users to add this behavior, but since it
would be a sigificant departure from previous behavior of the CLI, it
usually gets shut down.

However, we _do_ have some default behavior in npm.  When the first
positional argument doesn't match a known command (or an alias or unique
abbrev expansion), then the CLI calls the `help` command.  If the term does
not match a known help topic, then `npm help` in turn calls `npm
help-search`.  If that then finds a single matching help topic, it calls
`npm help` with that help topic.

It's very helpful!

What if, instead of having the default command be hard-coded to `npm help`,
we made it configurable, so that users could decide that they'd rather have
something else (usually `run-script`) be invoked instead?

## Detailed Explanation

- Add a new config key, `default-command`.  This value must be a known npm
  command (no aliases or abbreviations), and will have the default value of
  `'help'`.
- When the first positional argument does not match a known npm subcommand,
  it will invoke the `default-command` option with the remainder of the
  arguments.
- When the first argument _does_ match a known npm subcommand, then the
  `default-command` config value is not invoked.  (For example, `npm
  --default-command=run-script install foo` will still install `foo` if
  there is an `install` script in `package.json`.)
- If a new command is added in the future, and this means that current
  users of `npm foo` being an alias for `npm run-script foo`, then that's
  an acceptable disruption.  New commands are added very rarely, and only
  after a careful evaluation of existing userland packages.  But, this is a
  power-user convenience feature, and we do not expect _many_ of our users
  will take advantage of it (though we expect those that use it will be
  happy to have it, and will understand the risks).
- The `default-command` must only be a single command name.  It does not
  support setting configurations or specifying additional arguments.  For
  example, `npm config set default-command 'install --global'` would not be
  allowed.

## Rationale and Alternatives

`npm help` is a good default for most users, especially new users.
However, power users and those coming from Yarn may prefer to run their
build scripts with `npm build` rather than `npm run build`.

The rationale for being willing to clobber convenience use cases (eg,
scripts named "install", etc.) when a new command is added is twofold.
First, we are somewhat following in Yarn's footsteps, and Yarn only
auto-runs scripts when the command is not known.  Second, we have to
reserve the right to continue to expand the functionality of the CLI, or
else development of npm is unreasonably limited.

That said, it _does_ impose a non-zero cost in adding new commands to the
CLI, since users _may_ be relying on a `--default-command` config to handle
that term in some other way.

### Alternative 1 - run-script _and then_ help

One alternative would be to search for a match among known npm subcommands,
then `run-script` options, and only _then_ fall back to searching help.

This would be least surprising to current Yarn users, still pretty helpful,
and not require any opt-in.  However, it is not extensible to other command
use cases, and still imposes the cost of adding new commands.

### Alternative 2 - just make `help` know about scripts

Another alternative would be to make the current default `help-search`
behavior look at the `"scripts"` field in the current project's
`package.json` file.  If the term matches there, it could suggest that the
user might be thinking of the `run-script` command.

```
$ npm build
Top hits for "build"
————————————————————————————————————————————————————————————————————————————————
npm help install                                                         build:6
npm help config                                                          build:5
npm help explore                                                         build:5
npm help package-json                                                    build:4
npm help registry                                                        build:4
npm help rebuild                                                         build:4
npm help version                                                         build:4
npm help developers                                                      build:2
npm help semver                                                          build:2
npm help ci                                                              build:1
————————————————————————————————————————————————————————————————————————————————
(run with -l or --long to see more context)

`npm run build` will execute the following command:
  node scripts/build-my-stuff.js
```

This provides some guidance to users who expect `run-script` to be the
default command, without requiring much magic, and without the added cost
of adding new commands in the future.

### Why this, then?

Making the `default-command` configurable also enables a few other
interesting use cases:

- `npm config set default-command exec` This turns npm into something like
  a more powerful `npx`.  You can do `npm install` to install your
  dependencies, `npm create-react-app` to init a new react app, or `npm
  rimraf folder` to remove a folder recursively.
- `npm config set default-command install` Since `npm install` is the most
  common use case for npm, why not just drop the `install`?  Run `npm` with
  no args to install all your dependencies, or `npm react --save-peer` to
  install react and save as a peer dependency.

### Implementation

First, add the `default-command` config option, which must be a known npm
command name.

`lib/cli.js` contains this bit of code:

```js
const cmd = npm.argv.shift()
const impl = npm.commands[cmd]
if (impl)
  impl(npm.argv, errorHandler)
else {
  npm.config.set('usage', false)
  npm.argv.unshift(cmd)
  npm.commands.help(npm.argv, errorHandler)
}
```

Change it to this:

```js
const cmd = npm.argv.shift()
const impl = npm.commands[cmd]
if (impl)
  impl(npm.argv, errorHandler)
else {
  npm.config.set('usage', false)
  npm.argv.unshift(cmd)
  npm.commands[npm.config.get('default-command')](npm.argv, errorHandler)
}
```

## Prior Art

Yarn runs a script by the name specified in `package.json` if the command
is not known.  It's a pretty popular behavior among users.

## Unresolved Questions and Bikeshedding

Is the added cost to new commands worth the added convenience and power of
this feature?

Should we just make it `run-script` and then `help`, or is it worth
supporting things like `exec` or `install`?
