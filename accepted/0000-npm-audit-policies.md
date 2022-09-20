# Audit Policies

### Motivation

Today there are a limited set of conditions in place that prevent the installation of a package (ex. integrity mismatches & engines conflicts); audits also happen post-installation meaning they are only advisory in practice.

### Solution

Introduce easily configurable audit definitions that can gate the installation of packages. This new feature should leverage existing functionality/commands (ex. `install`, `update` & `audit`), syntax (ex. Dependency Selectors) & metadata without expanding the scope to unbounded, arbitrary code execution (unlike `preinstall` scripts or lifecycle hooks).

### Known Caveats
- Adding extra validation during installation will slow down execution
  - this will be up to end-users to control & determine what validations are necessary to meet their own requirements
- Not all usecases will be met
  - we will be limited by the existing commands, syntax & metadata supported
  - we aim to meet 80% (or the majority) of usecases with this feature
  - end-users with broader security needs can & still should look at locking down developer environments & enforce policies at the system/network level (something that is outside the scope of the `npm` CLI today)

### Implementation

```json
{
    "audit": {
        "policies": [
            {
                "name": "Vulnerable",
                "type": "error",
                "query": ":vulnerable"
            },
            {
                "name": "Peer Conflicts",
                "type": "error",
                "query": ".peer:not(:deduped)"
            },
            {
                "name": "Deprecated",
                "type": "warn",
                "query": ":deprecated"
            },
            {
                "name": "Outdated",
                "type": "log",
                "query": ":outdated()"
            },
            {
                "name": "Licenses",
                "type": "log",
                "query": ":not([license=MIT])"
            },
            {
                "name": "Remotes",
                "type": "error",
                "query": ":type(git), :type(remote)"
            },
            {
                "name": "Extraneous",
                "type": "warn",
                "query": ":extraneous"
            },
            {
                "name": "Missing",
                "type": "warn",
                "query": ":missing"
            },
            {
                "name": "Duplicate Peers",
                "type": "warn",
                "query": ".peer:not(:deduped)"
            },
            {
                "name": "Bad Packages",
                "type": "error",
                "query": "#phishing, #spam, #malware"
            },
            {
                "name": "Bad Actors",
                "type": "error",
                "query": ":attr(contributors, [email=bad@example.com])"
            },
            {
                "name": "Architecture Mismatch",
                "type": "error",
                "query": "@supports(cpu:x64) { [cpu=!x64] }"
            }
        ]
    }
}
```

