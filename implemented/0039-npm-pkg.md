# npm pkg

## Summary

A new top-level command that manages any property in your `package.json`.

## Motivation

Some users prefer managing their `package.json` using **npm cli** comands rather than manually editing a JSON file.

As of today, some of the **npm cli** commands already handle the automated management of the `package.json` file, such as `npm install` adding / updating dependency declarations, `npm version` bumping the version value, or in the case of `npm set-script` a top-level command that serves specifically the purpose of managing `"scripts"` data in the `package.json` file.

## Detailed Explanation

- Add a `npm pkg` command that has the following subcommands:
  - `npm pkg get <value>`
  - `npm pkg set <key>=<value>`
  - `npm pkg delete <key>`

## Rationale

Making manage your `package.json` file something less manually curated and more of an automated experience.

## Implementation

- Add a new `lib/pkg.js` top-level command that will handle adding / removing / modifying properties in your `package.json` file.
- Reuses the same logic existing to query for object properties from `lib/view.js`
- Throws when trying to replace current literal values with object notations
- Type cast via json parse using the `--json` cli option

### Example

```
$ npm pkg set scripts.lint=eslint
$ npm pkg get scripts
{
  "lint": "eslint"
}
$ npm pkg get scripts.lint
"eslint"
$ npm pkg set scripts.lint.eslint.foo=bar
error: "scripts.lint" exists and is not an object
$ npm pkg set scripts.lint.eslint.foo=bar --force
$ npm pkg delete scripts
$ npm pkg set scripts.lint.eslint.foo=bar
$ npm pkg get scripts
{
  "lint": {
    "eslint": {
      "foo": "bar"
    }
  }
}
$ npm pkg set tap.timeout=60 --json
$ npm pkg get tap
{
  "timeout": 60
}
$ npm pkg set contributors[0].name=Ruy contributors[0].email=foo@bar.ca
$ npm pkg set contributors[1].name=Gar contributors[1].email=foo@bar.ca
$ npm pkg get contributors.name
{
  "contributors[0].name": "Ruy",
  "contributors[1].name": "Gar"
}
$ npm pkg set foo.bar[0][0][0]baz.lorem[ipsum.dolor]sit=amet
$ npm pkg get foo
{
  bar: [
    [
      [
        {
          baz: {
            lorem: {
              "ispum.dolor": {
                sit: "amet"
              }
            }
          }
        }
      ]
    ]
  ]
}
```

## Prior Art

### Other npm cli top-level commands

- `npm set-script` top-level command that allow users to add new scripts to their package.json
- `npm init -w <ws-path>` init command will add the current path to `"workspaces"` property
- `npm install|uninstall <pkg>` will add/remove deps to `"dependencies"`

### Userland alternatives

- https://www.npmjs.com/package/pkg-jq
