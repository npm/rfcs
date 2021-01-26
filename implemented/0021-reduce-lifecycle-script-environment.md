# Reduce the environment variables provided to lifecycle scripts

In versions of npm up to v6, the following items are all placed into the
environment of scripts run for various lifecycle events (install, prepare,
etc., as well as explicit scripts such as `test` and `start`).

- `PATH` Configured to include `.../node_modules/.bin` for current and all
  parent `node_modules` directories.
- `npm_package_*` for all `package.json` values in the current package for
  which the lifecycle event is running.
- `npm_config_*` for all npm configuration values that do not start with a
  `_` character.
- `npm_lifecycle_event` the current lifecycle event.
- `npm_lifecycle_script` the command being run.
- `npm_node_execpath` the path to the Node.js executable npm is using.
- `npm_execpath` the path to the npm executable being run.

The suggestion presented here is to remove (or vastly reduce) the
`npm_config_*` and `npm_package_*` environment variables from the context
of lifecycle scripts, and potentially also add new fields that may be more
useful to more users.

## Motivation

Lifecycle scripts are run in many different contexts throughout the npm
codebase.

- Explicit scripts are run directly from the `lib/run-script.js`
  command implementation.
- Build scripts are run from the context of the tree building logic, which
  is moving to a new implementation with `@npmcli/arborist` in v7.
- Prepare scripts are run by `pacote` when it creates a tarball for
  publication or when it installs `git` dependencies.

All of this necessitates passing around a single configuration object,
which has some problems.

1. It is tedious and error-prone, and has led to a more complicated
   codebase
2. While we have not had security issues with it in the past, it runs the
   risk of exposing something sensitive in a context where it should not be
   exposed.
3. It invites users to fork package behavior based on npm configuration,
   which should be a contract between the user and npm, and not between the
   user, npm, and the publisher.
4. While the package.json data does not have as many of these problems, it
   is also largely unnecessary (and not widely used).  The `package.json`
   file is readily available and easily parsed, and most scripts that would
   depend on package data simply read it directly.
5. The environment is created anew for every script that's run.  This could
   be optimized further, but as it currently stands, it's pretty
   inefficient.
6. Lastly, exposing the full configuration and `package.json` makes the
   environment significantly larger, and can lead to problems on
   memory-constrained systems.

The advantage of including `npm_config_*` values in the lifecycle
environment is that npm commands run from within lifecycle events will have
the same config values as the process that spawned them, since `env` values
will override any other values except explicit command line flags.

For example, a script named `release` may run tests, update the changelog,
and then publishe the package.  Running `npm run release --otp=123456` will
put the two-factor auth one-time password into the `npm_config_otp`
environment variable, so that the subsequent `npm publish` command will
have the one-time password provided in the config.

## Detailed Explanation

1. Remove `npm_package*` values from the script lifecycle environment.
2. Provide a new field, `npm_package_json`, with the path to the
   `package.json` file.
3. Provide a new field, `npm_command`, with the canonical name of the
   command being run.
3. Remove all `npm_config_*` values from the script lifecycle environment
   _except_:
   1. `npm_config_userconfig`
   2. `npm_config_globalconfig`
   3. Environment variables corresponding to any non-default config
      values.
4. Add `npm_package_from`, `npm_package_resolved`, and
   `npm_package_integrity` for the package whose lifecycle event is
   running, if it's part of an install.  (This addresses the needs of build
   tools, as discussed in
   [#38](https://github.com/npm/rfcs/pull/38#issuecomment-529182151).)
5. `PATH` will continue to be provided as it currently is, so that scripts
   find their dependencies' executables first.

This makes it easier to find and rely on `package.json` data, while ensuring
that config defaults are maintained, without blowing up the size of the
environment for lifecycle processes, or requiring access to the npm config
subsystem in every npm CLI dependency.

In addition to these, the following environment variables will be
preserved from npm v6's set, in order to provide an easier upgrade path:

* `npm_package_name`
* `npm_package_version`
* `npm_package_config_*` Each key in the `config` object will be included,
  but npm will _not_ override values with a `<pkgname>:<keyname>` config
  value if one exists.
* `npm_package_engines_*`
* `npm_package_main`
* `npm_package_bin_*`

## Rationale and Alternatives

Possible alternatives:

### Just go ahead and pass around the whole config object like we do today

This is not ideal for the reasons mentioned above, but also, it makes it
virtually assured that Arborist remains tightly coupled to the npm cli.
While _some_ degree of coupling is unavoidable, having to provide a valid
npm config object would make this coupling much tighter than necessary.

### Inversion of Control on the npm-lifecycle environment creation

Rather than provide a config object matching a given interface, provide
`npm-lifecycle` with a method that can build up and return the environment
object.

This approach would address the tight coupling between cli and arborist,
but it doesn't address the other problems with having a giant config object
dumped into the environment.

## Implementation

The npm CLI will set all non-default config flags in the environment so
that scripts and sub-scripts will have them set in their configs by default
at the env level.

Replace `npm-lifecycle` with a lighter-weight approach, published as
`@npmcli/run-script`.

Instead of building the environment up from the config and package data,
`@npmcli/run-script` will only set `npm_package_json` to the path to the
package.json file for the package being run, take an object to define
additional environment variables, and always inherit the environment in the
child process being run.

Because the npm CLI sets the relevant config fields, they'll be inherited
to the child processes automatically.  Arborist will use the environment
option to pass in the `npm_package_from`, `npm_package_resolved`, and
`npm_package_integrity` values.

## Prior Art

npm v6 and yarn both do roughly the same thing, though they have different
config values.

## Downsides

Some modules today use `npm_config_argv`.  These will have to be updated to
use other means to get this information.

Where the argv is being parsed in order to determine the command being run,
the `npm_command` environ provides a safer approach.
