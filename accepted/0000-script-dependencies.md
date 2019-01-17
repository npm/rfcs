# Script dependencies

## Summary

This proposal introduces dependencies for NPM run scripts.

## Motivation

Often times an NPM run script has dependencies. For example, `npm start` may require source code to be transpiled before starting a server, meaning that `npm run build` needs to be run before `npm start`. Almost always, `npm run build` requires packages that need to be installed, meaning that `npm install` needs to be run before `npm run build`. With dependencies defined, a new user could clone a repository, run `npm start` right away, and NPM would work out that it first needs to run `npm install`, then `npm run build`, and finally `npm start`.

## Detailed Explanation

The `package.json` format will be extended, so that it supports objects for the `scripts` section:

```json
{
  "scripts": {
    "build": {
      "command": "babel sources --out-dir dist",
      "depends": ["install", "./sources"],
      "produces": ["./dist"]
    },
    "start": {
      "command": "node ./dist/server.js",
      "depends": ["build"],
    },
	"hello-world": "echo Hello, World!"
  }
  ...
}
```

If a script is just a string (as with `hello-world` above), then it operates the same as a normal command alias. If the script is an object, however, then it is possible to specify dependency information. In the example above, running `npm start` would first run `npm install`, then would run `npm run build` (`babel sources --out-dir dist`), and finally would run `npm start` (`node ./dist/server.js`).

Running `npm start` again would immediately run `node ./dist/server.js`, without running `npm build` or `npm install`, since nothing else in the project has changed. Since `./sources` is listed as a dependency for `npm run build`, however, then if any of the files were edited in that directory, running `npm start` after such an edit would cause `npm run build` to be re-triggered first.

Specifically, then `scripts` section of the `package.json` file must satisfy the following rules:
* All values must either be a string, or be an object with the `command` field specified
* The `depends` and `produces` field is optional (a string is equivalent to an object with only the `command` field specified)
* The `depends` and `produces` fields must be arrays of strings. Each string in the `depends` array must be either the name of a built in NPM command, the name of another script, or a file path. Each string in the `produces` field must be a file path.

A script will run only if one or more of the following cases are met:
* The script has no `depends` field specified OR no `produces` field specified
* One or more of the built-in commands or scripts that it _depends on_ has no `produces` field
* One or more of the script's file dependencies, or the `produces` paths from a command or script dependency, has an updated timestamp that is equal to or greater than the updated timestamp of any of the files in the script's own `produces` paths

If a script depends on a built-in command or another script and it is determined that one of those dependencies must be run, then the script will only be run after all of its dependencies have run.

If a cycle is formed by the graph of scripts and their dependencies, then an error is emitted.

## Rationale and Alternatives

The goal is to be able to type in one command and have NPM work out what needs to be run to properly complete the command. This allows NPM to become a multipurpose tool, replacing the need for other boilerplate scripts and configurations such as Makefiles, helping to self document run scripts, and improving the user experience when working with different projects.

**Alternatives**
* Instead of specifying both `depends` and `produces` fields, scripts could only have `depends` fields (which would only be other scripts or built-in commands). Running a particular script would then run all of its dependencies (and their dependencies, etc.). This would make this feature simpler, but would drastically reduce its usefulness. Many scripts can take a long time to run. By comparing the updated timestamps from dependencies with those of files in the `produces` field, NPM is able to skip dependencies that don't need to be run, thereby decreasing the time needed to run a chain of commands.
* Rather than overloading the existing `scripts` field within the `package.json` file, this feature could be added via another field, or perhaps even another file, and associated with a different built-in command than `npm run`. This would defeat one of the primary motivators of this feature, however, which is to augment the existing run script behavior. Additionally, this approach would decrease the discoverability and adoption of this feature.

## Implementation

I'm still looking through the NPM CLI codebase to understand exactly what this feature would affect, and will update this PR as I learn more. Here's a very rough brain dump of notes about things that will need to be implemented, though:
* configuration parsing will need to be updated
* all built-in NPM commands will need to be associated with `depends` and `produces` values for use by other run scripts
* cycle detection will need to be implemented
* utilities for checking files/directories for the latest updated timestamp will be needed

{{Give a high-level overview of implementaion requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

This feature is directly based off of the [make](https://www.gnu.org/software/make/manual/make.html) tool, and the implementation is roughly based off of my understanding of how `make` works.

## Unresolved Questions and Bikeshedding

* The naming of the fields in script object shown above is just a first pass. Maybe `command`, `depends`, and `produces` are the best naming options, but maybe not.
* As currently described above, circular dependencies for a particular script's chain of dependencies emits an error. `make` handles this case a little differently, by simply dropping circular dependencies and emitting a message. Do we want that behavior instead? In my opinion, a circular dependency is an error in the configuration, and so the sooner an error is emitted, the better.
* Do we want to support variables in any form, similar to [Makefile variables](https://www.gnu.org/software/make/manual/make.html#Variables-Simplify)? I personally feel that variables could complicate this feature, making it much harder to develop a working first version. To that end, I would recommend that variables are saved for later in the future (if ever).
* This feature will work great for a certain class of commands which are intended to be run _discretely_, but does not work for commands that are intended to be run _continuously_. For example, many build tools contain a "watch" mode that automatically triggers further action when certain files change. These commands would not work as well with the feature as outlined above. I think it would be awesome if this feature could also support these types of commands, meaning that NPM takes care of watching for dependency changes, etc. Nevertheless, this opens up a whole host of other complexities, and so is probably best out of scope for the first revision of this feature. I wanted to bring it up to illustrate the full potential, though!
* Others?

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
