# Add `--query` flag to `npm audit`

### Motivation

Today `npm audit` has a limited set of options to filter the packages that are included or excluded from it's scope. There has also been [very public, legitimate critcism about the signal to noise ratio](https://overreacted.io/npm-audit-broken-by-design/) of `npm audit`'s ouput. Unfortunately, this has lead many developers to turn off `npm audit` checks completely during installation (ex. `--no-audit`) or switching to alternative package managers who do not run audits by default. 

The current configuration options are based on `Arborist`'s underlying  support for, & limited to, package types (ie. `--omit` & `--include` can be used today to filter by only `prod`, `dev`, `optional` & `peer` dependency types today). Expanding `npm audit`'s filter capabilities & leveraging the new, rebust [Dependency Selector Syntax](https://docs.npmjs.com/cli/v8/using-npm/dependency-selectors) - at the command-line/project-level - will help end-users define complex groups of dependencies to be included.

### Solution

Add support for a new `--query` flag to `npm audit` which takes a **Dependency Selector** as it's value. 

### Implementation

When the `--query` flag is defined it will set `--omit` & `--include` values to empty & configure `Arborist` to run the `tree.querySelectorAll("<query-selector-string-value>")`.

### Prior Art

[Audit Resolutions](https://github.com/npm/rfcs/blob/f333557af40beecf49d60d222599f02e5f0947fc/accepted/0003-interactive-audit-resolver.md) is one of the oldest RFC's still open which has a similar scope/goal. In that RFC a `ADVISORY_NUMBER|DEPENDENCY_PATH` value is referenced as the ideal value to apply "resolutions". In this alternative, a **Dependency Selector** will be used which, today, already supports paths/ancestory via the direct decendant/child combinator (`>`). Advisory metadata & pseudo selector support (ex. `:cve()`, `:cwe()` & `:vulnerable`) was defined in the original [Dependency Selector Syntax RFC](https://github.com/npm/rfcs/blob/3d5b2130504139bdc8a3b599923aa07d2ff79c96/accepted/0000-dependency-selector-syntax.md) & is queued up to be worked on by the npm CLI team.
