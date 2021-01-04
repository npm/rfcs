# Script file fallback in `npm run`

## Summary

`package.json` scripts are very handy. We can rely them to create industry standards like `npm run build` and `npm run test` to build and test files respectively.
This RFC suggests a fallback for script files, instead of explicitly listing them in `scripts`.

## Motivation

In big Node.js repos, the `package.json#scripts` JSON key might get very crowded. It's widely common to see `test:e2e`, `test:unit`, `test:integration` and many more things.
The problem is that declaring scripts in JSON is hard to maintain and to reason about:

- Any logic you put into the scripts is hard to manage, because they're practically one-liners
- You can't use prettier/shellcheck/TypeScript or any other tool to check your syntax and enforce standards
- If you do want to extract your script into a standalone script file, you will still need to have an explicit reference to the file from `package.json#scripts`

npm could suggest a standard location to write script files so they will be picked up automatically instead of explicitly referencing them in `package.json#scripts`.

## Detailed Explanation

Practically, if `package.json#scripts#SCRIPT_NAME` is missing, and `scripts/SCRIPT_NAME` exists and executable, we should run this script.

This will make it easier to use tools like [`argv`](https://www.npmjs.com/package/yargs), [`commander`](https://www.npmjs.com/package/commander), or [`cmd-ts`](https://www.npmjs.com/package/cmd-ts) to create scripts that receive arguments with proper validation instead of overloading scripts.
So, instead of `npm run test:e2e` you could run `npm run test e2e` — and declare it in your favorite language that supports reusing code, instead of a Bash one-liner.

We can also support `namespaced:script`, which uses a colon to separate the calls — a standard we probably got from Rake, and look for a file in `scripts/namespaced/script`.

## Rationale and Alternatives

- [scripty](https://www.npmjs.com/package/scripty) is a package that does exactly that. But you still need to explictly declare your scripts in `package.json#scripts` to all call `scripty`, which be better avoided
- [nps](https://www.npmjs.com/package/nps) is a package for managing scripts. They have a suggestion to use `package.json#scripts` to call `nps`
- [jake](https://jakejs.com/) is a Rake-inspired tool which you can declare all your tasks similar to distributed Rake tasks

Both are great, but I think we should drive to having good standards in the Node.js community, and not always rely on 3rd parties.

## Implementation

When running `npm run $SCRIPT_NAME`:

- If a `$SCRIPT_NAME` key exists in `package.json#scripts`, run its value and exit
- `$SCRIPT_PATH = path.join(projectRoot, ...$SCRIPT_NAME.split(':'))`
- Run `$SCRIPT_PATH` and exit, if it exists and executable
- Run `node $SCRIPT_PATH.js` and exit, if it exists

## Prior Art

As mentioned in the alternative list, [scripty](https://www.npmjs.com/package/scripty) is a package that does exactly that.
The need of explictly declaring your scripts in `package.json#scripts` to call `scripty` feels redundant and could be avoided by embracing this as a standard.

## Unresolved Questions and Bikeshedding

- What about TypeScript files, or any other compile-to-JS languages? We can use `ts-node` or `@swc-node/register` but that would require some configurations. Of course, we can use shebangs and not use Node explicitly, but I'm not sure about Windows support for these.
- Should this directory be called `scripts` or something else, like `tasks` or `npm_scripts`?
