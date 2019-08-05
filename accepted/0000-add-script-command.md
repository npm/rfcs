# Add script to manifest from command


## Summary

An `npm` command that lets you create a task in the scripts section of the `package.json`.

**Example:**

* `npm --add-script start "http-server ."`


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

I've been wanting this for like 5 years.

Outside of personal daily use (which I think is worth it just for that), it would make educational uses much easier.

When giving instructions in a classroom setting (like in workshops) or just in tutorials, I'd prefer to say this:

> "Run **`npm install --save-dev nw`** and then run **`npm --add-script start "nw ."`** then run **`npm start`**."

The current way has more steps and is proned to error:

> "Run **`npm install --save-dev nw`** then open the **`package.json`** file and add a **`scripts`** section with a **`start`** set to **`nw .`** then save that and go back to the command prompt/terminal and run **`npm start`**."

Especially since the `npm install` portion could take a long time, so if they modify the `package.json` while the install is still ongoing then when it completes and adds the dependency to the `package.json` it will overrite what they had (happens all the time for me).


## Detailed Explanation

I want to be able to do this, walk away, and come back and it be done and running:

```
npm init -y && npm install --save-dev http-server && npm --add-script start "http-server ." && npm start
```

Colons and hyphens are common in script names. they would look like this:

* `npm --add-script test:e2e "nightwatch"`
* `npm --add-script test-unit "jest --config jest.config.js --coverage"`


## Rationale and Alternatives

1. I could do `npx nw .` but there is an expectation that projects should just be `npm install && npm start`.
1. I could manually edit the `package.json` and type in the script name and value in the scripts section. (current common approach)
1. Someone could make a Node module/script to solve this that would need to be globally installed. But I'm the one writing this RFC and even I would never use that. I'm especially opposed to this as I don't believe to do something this basic should require poluting the global PATH, so I would never mention it in a workshop, classroom, or tutorial.


## Implementation

I don't know, probably something like this:

1. Write code to accept the argument, parse it into the script name and value
1. Parse the `package.json` as an object
1. If there is no `"scripts"` section, create it
1. If the script name is already in use, store it for a warning message
1. `manifest.scripts[scriptName] = value`
1. Convert back to a happy string and save over the `package.json`
1. If there was an existing script with a different value, output a warning message


## Prior Art

The proposal of `--add-script` is similar to the existing `--save` and `--save-dev` in the sense that it is a command followed by arguments that result in the modification of `package.json`.

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


## Unresolved Questions and Bikeshedding

* * *

**Bike A.** I do not know what the expectaion would be if a script with that name already exists. I would assume that it would replace its value in the `package.json`.

* **In `package.json`:** `"start": "express"`
* **Run:** `npm --add-script start "nw ."`
* **In `package.json`:** `"start": "nw ."`

**Resolution:** Will automatically replace the value, but show a warning:

```
Warning: Existing "start" script has been overwritten. Replaced "express" with "nw .".
```

* * *

**Bike B.** I am not familiar with the naming convention used for `npm` arguments. I also don't really care what it's called. I assume something like this:

* `npm --add-script start "nw ."`
* `npm --save-script start "nw ."`
* `npm --create-script start "nw ."`

If **Bike A** results in us overriding existing scripts with a new value then `--create-script` would not make sense.

**Resolution:** `npm add-script <name> <cmd>`

* * *

**Bike C.** Amount of arguments.

It seems cleanest to do this:

* `npm --save-script start "some value"`

But if accepting two arguments (`start` and `"some value"`) is beyond convention, then we could follow the pattern set by `--save-dev`.

* `npm install --save-dev nw@latest`
* `npm --save-script start@"nw ."`

**Resolution:** `npm add-script <name> <cmd>`

* * *

**Bike D.** Perhaps a more generic approach should be taken.

Instead of:

* `npm --add-script start "nw ."`

it could be

* `npm --add-field scripts.start "nw ."`
* `npm --add-field main "index.html"`
* `npm --add-field private true`

But this would have a whole host of other problems to solve like:

* `npm --add-field keywords ["asdf", "qwer"]`

Also adding in `--add-script` does not prevent us from also eventually creating `--add-field`. As there is already a `--save` and `--save-dev` which target the modification of specific fields in `package.json`.

**Resolution:** Generic approach to be considered in separate RFC (if desired).
