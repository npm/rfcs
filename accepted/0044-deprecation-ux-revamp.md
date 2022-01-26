# Deprecated packages UX revamp

## Summary

Add a new notification interface at the end of every `install` informing the user of how much packages are deprecated in their current installed tree, in replacement of warning messages printed to standard output during the install.

## Motivation

There are two main motivations for this change:

1. It has been a long time coming effort to clean the output of `npm install` and this would be the final act to convert what used to be hundreds of lines printed in users interface during install into the notification system provided at the end that let users aware of audit issues, funding and now deprecations.
2. The current warning messages does not provide any context to where that package is coming from, leaving users very confused to see that warning when the deprecated package in question is not a direct dependency of their project.

## Detailed Explanation

During `npm install` arborist should no longer print warnings lines for each package that is marked as deprecated and it should instead queue them up and provide metrics that can be printed at the end of the install, similar to how it works with audit today.

A new command can be introduced to properly display the current deprecations.

## Alternatives

- Leave warning messages as is, don't change anything in the current UX
- Implement only the increments to existing commands
- Implement notifications system but not any of the increments to existing commands
- Modify warning messages during install and leave deprecations warnings to ecosystem, e.g: https://github.com/ljharb/npm-deprecations

## Implementation

Install changes:
- **arborist** should implement a mechanism to queue deprecation notices, maybe something similar to: `lib/audit-report.js`
- **cli** will need additions to `lib/utils/reify-output.js` in order to make sure we retrieve that info from arborist and properly display the deprecated packages notification.

### Install example:

```sh
$ npm install abbrev

added 6 packages, and audited 6 packages in 870ms

3 deprecated packages found (1 direct, 2 transitive)

To find out more, run:
  npm deprecations

4 vulnerabilities found (1 low, 1 moderate, 2 high)

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details
```

### Overview of all deprecated packages after an install

Creates a new `deprecations` subcommand in the cli.

For the next few examples, assume an install such as:

```sh
$ npm ls
project@1.0.0 $HOME/work/project
├── foo@0.4.0
├─┬ lorem@0.4.0
│ └── ipsum@2.0.0 deprecated
├─┬ abbrev@3.0.9
│ └── bar@2.88.0 deprecated
└── once@1.4.0 deprecated
```

#### 1. Prints deprecated notices for direct dependencies in the current install, e.g:

```
$ npm deprecations
once@1.4.0 https://github.com/lydell/resolve-url#deprecated
```

#### 2. Prints deprecated notices for **all** deprecated packages in the current install, e.g:

```
$ npm deprecations --all
ipsum@2.0.0 this library is no longer supported
bar@2.88.0 "Please update to latest v2.3 or v2.2"
once@1.4.0 https://github.com/lydell/resolve-url#deprecated
```

#### 3. Print deprecation notices for a given package from the current install when using package name only, e.g:

```
$ npm deprecations once
once@1.4.0 https://github.com/lydell/resolve-url#deprecated
```

#### 3.1. Support different output types:

```
$ npm deprecations once --json
{
  "once": {
    "1.4.0": "https://github.com/lydell/resolve-url#deprecated"
  }
}
```

#### 3.2. Support multiple positional arguments:

```
$ npm deprecations once ipsum
once@1.4.0 https://github.com/lydell/resolve-url#deprecated
ipsum@2.0.0 this library is no longer supported
```

#### 4. Support reaching to the registry when using qualified spec as positional argument, e.g:

```
$ npm deprecations dot-prop-legacy@latest
dot-prop-legacy@4.2.1 dot-prop released a v4.2.1, please migrate back to dot-prop@4.2.1 https://www.npmjs.com/package/dot-prop/v/4.2.1
```

#### 5. Support other common arborist options, e.g:

```
$ npm deprecations --only=prod
once@1.4.0 https://github.com/lydell/resolve-url#deprecated
```

## Prior Art

`npm install` will print a single warning line during install for each deprecated package found, e.g:

```sh
$ npm install
npm WARN deprecated ipsum@2.0.0: this library is no longer supported
npm WARN deprecated bar@2.88.0: "Please update to latest v2.3 or v2.2"
npm WARN deprecated once@1.4.0: https://github.com/lydell/resolve-url#deprecated

4 vulnerabilities found (1 low, 1 moderate, 2 high)

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details
```
