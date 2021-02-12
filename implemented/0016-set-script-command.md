# Set script in package.json from command line


## Summary

An `npm` command that lets you create a task in the scripts section of the `package.json`.

**Example:**

* `npm set-script start "http-server ."`


```
{
  "name": "whatever-was-already-here",
  "scripts": {
    "start": "http-server .",
    "test": "some existing value"
  },
  ...
}
```

## Motivation

Outside of personal daily use (which I think is worth it just for that), it would make educational uses much easier.

When giving instructions in a classroom setting (like in workshops) or just in tutorials, I'd prefer to say this:

> "Run **`npm install --save-dev nw`** and then run **`npm set-script start "nw ."`** then run **`npm start`**."

The current way has more steps and is proned to error:

> "Run **`npm install --save-dev nw`** then open the **`package.json`** file and add a **`scripts`** section with a **`start`** set to **`nw .`** then save that and go back to the command prompt/terminal and run **`npm start`**."

Especially since the `npm install` portion could take a long time, so if they modify the `package.json` while the install is still ongoing then when it completes and adds the dependency to the `package.json` it will overrite what they had (happens all the time for me).


## Detailed Explanation

I want to be able to do this, walk away, and come back and it be done and running:

```
npm init -y && npm install --save-dev http-server && npm set-script start "http-server ." && npm start
```

Colons and hyphens are common in script names. they would look like this:

* `npm set-script test:e2e "nightwatch"`
* `npm set-script test-unit "jest --config jest.config.js --coverage"`


## Rationale and Alternatives

1. I could do `npx nw .` but there is an expectation that projects should just be `npm install && npm start`.
1. I could manually edit the `package.json` and type in the script name and value in the scripts section. (current common approach)
1. Someone could make a Node module/script to solve this that would need to be globally installed. But I'm the one writing this RFC and even I would never use that. I'm especially opposed to this as I don't believe to do something this basic should require poluting the global PATH, so I would never mention it in a workshop, classroom, or tutorial.


## Implementation

1. Add new top-level command at `lib/set-script.js`
1. Require 2 arguments.  First is the script name, second is command.
1. Parse the `package.json` as an object
1. If there is no `"scripts"` section, create it
1. If the script name is already in use, store it for a warning message
1. `manifest.scripts[scriptName] = value`
1. Convert back to a happy string and save over the `package.json`
1. If there was an existing script with a different value, output a warning message


## Prior Art

The proposal of `set-script` is similar to the existing `--save` and `--save-dev` in the sense that it is a command followed by arguments that result in the modification of `package.json`.

* `npm install --save-dev http-server`

```
{
  "name": "whatever-was-already-here",
  "devDependencies": {
    "http-server": "^1.0.0"
  },
  ...
}
```
