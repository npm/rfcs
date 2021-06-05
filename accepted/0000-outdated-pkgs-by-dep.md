# Group outdated packages by package type

## Summary

Group outdated packages by with their corresponding dependency type in `package.json` (_e.g._ `dependencies`, `devDependencies`, etc).

## Motivation

It helps developers to visualize and manage outdated packages according to their dependency type. This is specially useful for projects with a large number of dependencies.

## Detailed Explanation

Currently, by running `npm outdated --long`, the output include two additional columns: `Package Type` and `Homepage`. The former indicates the dependency type as defined in `package.json`. However, there is no CLI option to group the packages by `Package Type` and, thus, the packages are sorted by `Package` name only.

### Example

Current behavior, rows are sorted by `Package`.

```bash
$ npm outdated --long
Package          Current   Wanted   Latest  Location  Package Type          Homepage
@types/jest       25.2.3   25.2.3  26.0.23  example   devDependencies       ...
@types/node      8.10.66  8.10.66  15.12.1  example   devDependencies       ...
chalk              3.0.0    3.0.0    4.1.1  example   dependencies          ...
cosmiconfig        6.0.0    6.0.0    7.0.0  example   dependencies          ...
glob               7.1.6    7.1.7    7.1.7  example   bundledDependencies   ...
memfs             2.17.1   2.17.1    3.2.2  example   peerDependencies      ...
rimraf             2.7.1    2.7.1    3.0.2  example   bundledDependencies   ...
typescript         3.9.9    3.9.9    4.3.2  example   devDependencies       ...
update-notifier    4.1.3    4.1.3    5.1.0  example   dependencies          ...
xregexp            3.2.0    3.2.0    5.0.2  example   optionalDependencies  ...
```

### Proposal

Using the new flag `--by-type`, rows are sorted by `Package Type` and then by `Package` name

```bash
$ npm outdated --long --by-type
Package          Current   Wanted   Latest  Location  Package Type          Homepage
glob               7.1.6    7.1.7    7.1.7  example   bundledDependencies   ...
rimraf             2.7.1    2.7.1    3.0.2  example   bundledDependencies   ...
@types/jest       25.2.3   25.2.3  26.0.23  example   devDependencies       ...
@types/node      8.10.66  8.10.66  15.12.1  example   devDependencies       ...
typescript         3.9.9    3.9.9    4.3.2  example   devDependencies       ...
xregexp            3.2.0    3.2.0    5.0.2  example   optionalDependencies  ...
memfs             2.17.1   2.17.1    3.2.2  example   peerDependencies      ...
chalk              3.0.0    3.0.0    4.1.1  example   dependencies          ...
cosmiconfig        6.0.0    6.0.0    7.0.0  example   dependencies          ...
update-notifier    4.1.3    4.1.3    5.1.0  example   dependencies          ...
```


## Rationale and Alternatives

An alternative solution is to filter the current list of outdated packages by type, using CLI options like `--prod` for `production`, `--dev` for `development`, `--optional`, `--peer`, and `--bundled`. Example:

```bash
$ npm outdated --prod
Package          Current   Wanted   Latest  Location
chalk              3.0.0    3.0.0    4.1.1  example
cosmiconfig        6.0.0    6.0.0    7.0.0  example
update-notifier    4.1.3    4.1.3    5.1.0  example
```
However, this alternative requires to give multiple commands to get all the outdated packages.


## Implementation

It would affect the [npm/cli](https://github.com/npm/cli) repository, particularly the command `outdated`, implemented by [outdated.js](https://github.com/npm/cli/blob/latest/lib/outdated.js).
