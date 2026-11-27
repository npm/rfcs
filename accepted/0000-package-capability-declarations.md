---
title: Package capability declarations
number: null
status: proposed
created: null
accepted_at: null
implemented_at: null
withdrawn_at: null
implementation: null
---

# Package capability declarations

## Summary

Add an optional `capabilities` field to `package.json` in which a package author declares the capabilities the package uses by itself, without being called. A capability is a kind of access to the system around the package, such as the network or the filesystem. The first version covers four. These are contacting network hosts, reading or writing files, starting other programs, and reading environment variables. A capability is not harmful in itself, and legitimate and malicious packages use the same ones. Each capability is declared separately for two phases, `install` and `load`. A third phase, `runtime`, is reserved for a later version.

Package managers can show the declaration and how it changed between versions. Security tools can compare it with the behaviour they observe and with the previous published version. A declaration is a claim by the package author. It grants no permission and is not proof that the package is safe.

## Motivation

### The problem

Security tools that analyse npm packages before installation find capabilities in code. A package downloads a file, starts a program, or reads an environment variable. What a security tool cannot see is whether the package author meant the package to do that. Today the only hint a security tool has is the package's history. A capability that was already present in previous published versions is probably part of what the package does, and one that appears suddenly in a new version deserves a look. A package that downloads its platform binary from GitHub in a `postinstall` script looks, to static analysis, much like a hijacked release that downloads a payload from an attacker's server. Every security tool therefore has two poor choices. It can report the capability and raise false alarms on legitimate packages, or it can stay silent and miss the attack.

False alarms are not only an inconvenience. When a security tool flags many legitimate packages, developers learn to dismiss its findings, and a real attack is dismissed with the rest. To avoid this, developers raise thresholds, stop failing builds, or add allowlists, and a package on an allowlist is what an attacker most wants to hijack. The authors of security tools face the same pressure from the other side. To keep false alarms low they drop or narrow rules, and attacks that look like legitimate behaviour pass unreported. Because malicious versions are rare compared with all the versions developers install, even a low false-alarm rate means most alerts are false.

Studies of static analysis in general show the effect. Developers interviewed by Johnson et al. (2013) named false positives as a barrier to using these tools. At Google, Sadowski et al. (2018) found that when a static analysis tool wastes developer time with false positives, developers "will lose faith and ignore results", and checks that draw too many negative reactions are disabled until they improve.

The package author knows which capabilities are intended, but npm has no place to record that. The `scripts` field shows that an install script exists, but not what it does.

### What a declaration changes

A declaration does not make any behaviour safe, and security tools should keep reporting sensitive behaviour whether or not it is declared. What it adds is a statement of intent that a security tool or a person reviewing the update can check. This helps in three situations.

1. **First versions.** A newly published package has no history. Every capability in it is new, so a client that calls its own service looks the same as a hijacked package that sends data to an attacker. With a declaration, a security tool can tell a capability the package author stated from one that appears nowhere in the package author's own description.
2. **Updates.** When a new version adds network access at load, or starts reading a credential variable, the change shows in a short list that a person reviewing the update can read without reading the code. This includes a capability that moves into the load phase, such as network code that used to run only when called and now runs as soon as the package is imported. The same list makes a hijack harder to hide. An attacker must either leave the declaration unchanged, which leaves the new behaviour undeclared, or extend it, which creates a visible change.
3. **Mismatch.** Behaviour that a security tool observes but the declaration does not cover is a specific and explainable finding. "This version contacts a host the package does not declare" is easier to act on than "this package uses the network".

### Evidence

One measurement shows the size of the problem. TreeCustodian, an open-source static security tool for npm, was run on two sets of legitimate packages with the registry fixed at 26 November 2026. On 374 versions of established packages it flagged 6 (1.6%), five of them for capabilities used at install time with no harmful code found. On 306 packages published in the previous six months it flagged 28 (9.2%), most of them again for capabilities with no harmful code found. New packages have no history to compare with, so every capability counts as new and the false alarm rate rises. The selection and full results are described at https://gitlab.com/treecustodian/treecustodian/-/blob/main/docs/EVALUATION.md.

These figures come from one security tool and do not show that a declaration would remove any of these flags. They show that legitimate capabilities are a main source of false alarms for an analysis that cannot see intent. Any security tool that inspects package behaviour shares that limit.

### Why package authors would declare

Packages with install scripts, native binaries or network clients are the ones security tools flag most often, and their package authors have no standard way to answer. A declaration gives them one, in a form that security tools and developers can read. Package authors whose packages use none of these capabilities can declare empty phases, which states that clearly. Nothing changes for packages that do not adopt the field.

## Detailed Explanation

### Field structure

`capabilities` is an optional top-level object in `package.json`. It holds up to two phase objects, `install` and `load`, and reserves a third key, `runtime`. Each phase holds any of the four categories `network`, `fs`, `childProcess` and `env`. A JSON Schema is given in Appendix A.

```json
{
  "name": "example-image-tool",
  "version": "2.4.0",
  "scripts": { "postinstall": "node install.js" },
  "capabilities": {
    "install": {
      "network": ["github.com", "*.githubusercontent.com"],
      "fs": { "write": ["$PKG/vendor/"] }
    },
    "load": {}
  }
}
```

In this example the install script contacts two hosts and writes into the package's own `vendor` directory. Loading the package uses none of the four categories.

### Phases

The first version covers behaviour the package performs by itself, without being called. In these phases the package author alone decides what the code does, and it runs because the package is installed or imported, not because the dependent project asked for anything.

| Phase | Meaning | Example |
|---|---|---|
| `install` | Code that runs when the package is installed as a dependency, through its lifecycle scripts (`preinstall`, `install`, `postinstall`) and anything they start. | A `postinstall` script downloads a platform binary into `$PKG/vendor/`. |
| `load` | Code that runs when the package is required or imported, before the dependent project calls any of its exports. This includes work the module schedules while loading, such as a timer or a promise started at its top level. | Module initialisation reads a configuration variable or opens a connection. |
| `runtime` | Reserved. Not defined in this version. See Why runtime is not yet defined. |  |

A phase is set by what makes the code run, not by when it happens in the dependent project's life. `load` code runs whenever the package is required or imported, whether that happens when an application starts, during a build or test run, or inside another package's install script. When a package's own install script loads its own files, that code is `install`. A file the package loads only after the dependent project calls one of its exports is runtime.

A package's command-line program, listed in its `bin` field, runs because the developer starts it, not because the package was installed or imported. Running it is therefore runtime, and what the program does is not declared in this version.

### Why runtime is not yet defined

Runtime is the code that runs when the dependent project calls the package's exports, or when the developer runs the package's command-line program. It matters, and the field reserves a key for it. It is left undefined in this version for three reasons.

- **Whose behaviour it is.** Runtime behaviour belongs to the package's code but is partly chosen by the caller. An HTTP client contacts the host the dependent project gives it. A file utility touches the path it is given. It is not clear whether such a capability is the package's to declare.
- **A fixed list is impractical.** For general-purpose libraries a list is either impossible to write or reduces to "any host" or "any path", which tells a security tool nothing.
- **It is hard to check.** Whether runtime code runs, and with what arguments, depends on how the dependent project calls it, so a comparison between declared and observed behaviour is unreliable for this phase.

Defining it too early would also cost later. Package authors would fill an undefined key with their own idea of runtime, security tools would read it differently, and a later definition would have to stay compatible with those declarations or break them. Package authors should therefore not use `runtime` in this version, and security tools should ignore it.

A later version must answer these questions. Does a runtime declaration describe what code can do or what it does by default? How are capabilities chosen by the caller declared? Where do callbacks, workers and long-running background work belong?

### Capability categories

These four are where the code of legitimate packages and of attacks meet most often at install and load. Hijacked versions use them to reach a server, read credentials, start a payload or change files, and they are what security tools can observe today. Other kinds can be added in later versions.

| Key | Value | Meaning |
|---|---|---|
| `network` | Array of host names | Hosts the package's code connects to, as host names only. Names match exactly, in lower case. A leading `*.` matches one or more labels, so `*.githubusercontent.com` covers `objects.githubusercontent.com`. |
| `fs` | Object with `read` and `write` arrays of path scopes | Locations the package reads or writes. Each entry is a placeholder, optionally followed by a path. A scope ending in `/` covers everything below it. |
| `childProcess` | Array of program names or paths | Programs the package starts, as named in the call (`git`, `node`, `$PKG/vendor/optimiser`), without arguments. Starting a shell counts as starting the shell program. |
| `env` | Array of variable names | Environment variables the package's own code reads, as exact names. Variables that child processes inherit without being named are not counted. |

#### Path placeholders

| Placeholder | Meaning |
|---|---|
| `$PKG` | The directory the package is installed in. |
| `$TMPDIR` | The operating system's temporary directory, as returned by `os.tmpdir()`. |
| `$HOME` | The user's home directory, as returned by `os.homedir()`. |
| `$CWD` | The working directory of the process. At install this is usually the package directory, and at load the dependent project. |

#### What must be declared on the filesystem

- Reading the package's own shipped files does not need to be declared.
- Any write under `$PKG`, in either phase, must be declared. This includes downloads into a `vendor` directory and caches kept inside the package.
- Any read or write outside `$PKG` must be declared.

#### Native builds and package manager work

A package that ships a `binding.gyp` file has no install script in `scripts`, but npm runs `node-gyp rebuild` for it during installation. RFC #54 treats that build as the package's install script and blocks it by default. This RFC treats it the same way. The package declares what its build needs at install, for example `nodejs.org` under `network` for the Node.js header download and `$HOME/.cache/node-gyp/` under `fs.write` for the header cache.

Work the package manager does for every package, such as downloading and unpacking the tarball, is not declared. Commands that the package's own lifecycle scripts run, and everything those commands do, are declared.

#### Further rules

- Network entries are host names only. Scheme and port are left out of the first version, since the host is what a person reviewing the update needs to judge. They can be added later without breaking existing declarations.
- The package declares every host its code contacts, including redirect targets it knows of. A proxy that the developer configures is not the package's to declare.
- Child processes are declared by program, not by arguments. Arguments vary too much to list, and the program is what matters for review.
- Environment variables are exact names, without wildcards. Every entry can then be checked against the code.
- Bundled code is declared by the package author. Whatever is in the published tarball is the package author's responsibility, whoever wrote it.
- There is no cache placeholder. A cache inside the package is `$PKG/...` and a user-level cache is `$HOME/...`.
- There is no schema version field. Later versions of this format only add keys, and `runtime` is already reserved, so a declaration written for this version stays valid.

### Declaration semantics

- A missing `capabilities` field means the package makes no declaration. It must not be read as a statement that the package uses no capabilities.
- An empty phase object, such as `"load": {}`, declares that the phase uses none of the four categories.
- An omitted phase is undeclared, which is not the same as empty.
- An omitted category inside a declared phase means the category is not used in that phase. This is what makes a declaration checkable.
- Each package declares only its own behaviour. A declaration says nothing about the package's dependencies, which have their own.
- A `runtime` key, if present, is reserved and carries no meaning in this version.
- A key a security tool does not recognise, inside a phase or at the top level, is reported and ignored, as `runtime` is. It does not make the declaration invalid, so a declaration that uses kinds added in a later version still works with security tools written for this one.
- The declaration is read from the `package.json` inside the published tarball, which is what gets installed. The registry does not check that the copy of `package.json` it serves matches the one in the tarball, a gap known as manifest confusion and noted in RFC #54. A security tool that finds the two copies declare different capabilities should report it.
- A declaration is a claim. It grants nothing and proves nothing.

### Guidance for security tools

This section is guidance, not a requirement. It describes outcomes that any security tool can produce from a declaration, so that results are comparable between security tools. How a security tool weights these outcomes in its own risk assessment is up to that security tool and is outside the scope of this RFC.

| Outcome | Meaning |
|---|---|
| Declared and observed | The security tool observes a capability that the declaration covers. |
| Observed, not declared | The security tool observes a capability in a declared phase that the declaration does not cover. |
| Declared, not observed | The declaration lists a capability the security tool did not find. This is informational, since static analysis cannot see everything. |
| Changed since the previous published version | An entry was added, removed or changed compared with the previous published version. |
| Undeclared phase | The phase, or the whole field, is missing. The security tool has no claim to compare with. |

Security tools should keep sensitive behaviour visible whether or not it is declared. A package that declares `NPM_TOKEN` and an unknown host at load has told the truth about something that still needs attention. Security tools should not treat a declaration as evidence that a package is safe, and should not treat a change as proof of compromise.

### Working with install-script approval (RFC #54)

npm RFC #54, accepted in June 2026, blocks dependency install scripts by default. This covers `preinstall`, `install`, `postinstall` and automatic `node-gyp` builds. The developer allows scripts for chosen packages in an `allowScripts` field in their own project's `package.json`, and an `npm approve-scripts` command helps build that list. RFC #54 describes `allowScripts` as "a consumer-side policy, not a publisher declaration". This RFC supplies the publisher side.

The two fit together at the moment a developer decides. Today the developer sees that a package wants to run an install script, but not what the script does. With declarations, npm can show what each script declares next to the request.

```
$ npm install
3 dependencies have install scripts that are not approved:

  example-image-tool@2.4.0     postinstall
    declares  network  github.com, *.githubusercontent.com
              fs.write $PKG/vendor/
  example-native-addon@1.8.2   node-gyp build (binding.gyp)
    declares  network  nodejs.org
              fs.write $HOME/.cache/node-gyp/
  example-helper@0.3.1         postinstall
    no capability declaration

Run npm approve-scripts to review.
```

Declarations also cover a case that approval alone does not. In RFC #54 an entry with only a package name allows the scripts of every version of that package, including versions published later. If such a package is hijacked, the new version's install script runs without a new approval. A change in its install declaration is the visible signal at that point.

```
example-image-tool  2.4.0 -> 2.4.1   (scripts allowed for all versions)
  install declaration changed
    + network  collector.example.net
```

An attacker can avoid this by leaving the declaration unchanged, in which case the new host is undeclared and a security tool that compares observed behaviour with the declaration can report it. These listings illustrate the idea and are not a proposed output format. How npm presents declarations, and whether a declaration change asks for approval again, is for npm maintainers to decide.

### npm CLI behaviour

- `npm view <pkg> capabilities` shows the declaration, like any other field.
- `npm publish` and `npm pkg fix` warn, without failing, when the field does not match the schema.
- Where npm shows information about dependency install scripts, it can also show the `install` declaration and any change between the installed version and the new one. Comparing any two versions, as `npm diff` does for files, can follow later. The exact place is for npm maintainers to decide.
- npm does not check that a declaration is true and does not enforce it.

## Rationale and Alternatives

### Declaration first (proposed)

A declaration is useful without any enforcement mechanism. Developers and security tools can use it as soon as package authors adopt it, and it gives any later enforcement work a format to build on. This is the approach chosen.

### Enforcement first

Runtime enforcement would give stronger guarantees. The Node.js Permission Model applies to the whole process, not to single packages, and its documentation states that it gives no security guarantees in the presence of malicious code. Enforcement per package is therefore not available today. Not chosen as a starting point, though a declaration format is what later enforcement would need.

### Install-script approval only

npm RFC #54 (PR #868), "Make install scripts opt-in", lets the developer decide whether a dependency's install scripts run. It decides whether code runs, not what the code does, and it does not cover the load phase. Not a replacement for this proposal. Declarations add to it, as described in Working with install-script approval.

### Security tools only

Security tools can infer capabilities, but inference cannot recover intent. Without a statement from the package author, each security tool must guess, and different security tools guess differently. Not chosen, because it is the situation this RFC sets out to improve.

### A separate file

A separate `capabilities.json` would keep `package.json` short. Not chosen, because it would be a second file to keep in step with the package and a second place for security tools to look, while `package.json` already describes the package.

### Registry-held metadata

The npm registry could store declarations itself, as data attached to each version on its servers, possibly editable after publishing. Not chosen, for four reasons.

1. It separates the claim from the code. If a declaration could change without a new version, what a given version declared would no longer be fixed, and comparing versions would lose its meaning.
2. It needs new registry features. Storing, editing and serving the data is a larger change than documenting a field.
3. It only exists on one registry. Private registries and mirrors would not have it, while a field in the tarball goes wherever the tarball goes.
4. It adds another copy that can disagree. The registry already serves its own copy of `package.json` that it does not check against the tarball (manifest confusion). A second registry-held record would add to that problem.

A field in the published `package.json` travels with the version it describes and cannot change without a new version.

### Do nothing

This avoids schema and adoption costs. Not chosen, because it leaves every security tool to guess intent on its own and leaves developers approving install scripts without knowing what they do.

## Implementation

| Area | Change |
|---|---|
| `package.json` documentation | Describe the `capabilities` field, its phases, categories and placeholders, and publish the JSON Schema with it. |
| `npm publish` | Validate the field against the schema and warn, without failing, when it does not match. |
| `npm pkg fix` | Report the same schema problems, so package authors can find them before publishing. |
| `npm view` | No change needed. The field shows like any other field of the published `package.json`. |
| Install-script approval (RFC #54) | Where npm lists dependency install scripts awaiting approval, show each package's `install` declaration and any change from the installed version. The exact place is for npm maintainers to decide. |
| Registry package pages (optional) | Show the declaration and its change from the previous published version. |

Repositories affected are the npm CLI and the npm documentation, and optionally the registry website. Validation and display add no runtime cost to installation, and packages without the field are unaffected.

### Example implementation

An example implementation that reads the field is in TreeCustodian, on the branch https://gitlab.com/treecustodian/treecustodian/-/tree/18-capability-declarations. It validates the declaration against the schema, reports the outcomes from Guidance for security tools next to its existing findings, and lists declaration changes between the scanned version and the previous published version. It compares capabilities, not individual entries, since its findings do not record the host or program they involve. It shows one way a security tool can use the field. It is not a reference for how security tools should weight it.

## Prior Art

- npm RFC #54 (PR #868), "Make install scripts opt-in", accepted 8 June 2026. Blocks dependency install scripts by default and lets the developer allow them per package. It also notes manifest confusion, the registry not checking its copy of `package.json` against the tarball.
- npm PR #297, "RFC: permissions", opened December 2020 and not accepted. An earlier proposal on permissions for module loading.
- Node.js Permission Model. Process-wide controls over the file system, child processes, workers and other resources.
- Install-script controls in other package managers, such as pnpm's list of dependencies allowed to build, Bun's `trustedDependencies` and Deno's opt-in for npm lifecycle scripts. These decide whether scripts run, not what a package declares it does.
- Permission manifests of browser extensions and mobile apps. The author lists what the software needs, and the store or the user sees the list and its changes on update. This is the closest analogue, with the difference that this RFC does not enforce the list.

## Unresolved Questions and Bikeshedding

Most design questions have a proposed answer in Detailed Explanation, open to change in discussion. The runtime phase has its own section. These remain open.

- Is `capabilities` the right name for the field?
- Are `install` and `load` the right names for the phases?
- Are other kinds worth declaring, such as starting worker threads, loading native addons, or running code built at runtime with `eval`?
- Where should npm show declarations and their changes? This is for npm maintainers to decide.
- Should provenance or signed release metadata protect declarations against changes that slip through unnoticed? This is a possible future direction, not part of the first version.

## References

- Johnson, B., Song, Y., Murphy-Hill, E. and Bowdidge, R. (2013). Why don't software developers use static analysis tools to find bugs? Proceedings of the 35th International Conference on Software Engineering (ICSE 2013), 672-681. doi:10.1109/ICSE.2013.6606613
- Sadowski, C., Aftandilian, E., Eagle, A., Miller-Cushon, L. and Jaspan, C. (2018). Lessons from building static analysis tools at Google. Communications of the ACM 61(4), 58-66. doi:10.1145/3188720
- npm RFC #54, Make install scripts opt-in. https://github.com/npm/rfcs/blob/main/accepted/0054-make-scripts-install-opt-in.md
- npm PR #297, RFC: permissions. https://github.com/npm/rfcs/pull/297
- Node.js Permission Model. https://nodejs.org/api/permissions.html

## Appendix A. JSON Schema

Schema for the value of the `capabilities` field. Path patterns allow a placeholder alone or followed by a path. Host patterns allow one leading `*.` label. The `runtime` key is allowed but has no defined contents. Other keys are allowed at the top level and inside a phase, so that later versions can add kinds without making earlier declarations or security tools invalid. Inside `fs`, only `read` and `write` are allowed.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "capabilities.schema.json",
  "type": "object",
  "properties": {
    "install": { "$ref": "#/$defs/phase" },
    "load":    { "$ref": "#/$defs/phase" },
    "runtime": {
      "description": "Reserved. Not defined in this version."
    }
  },
  "$defs": {
    "phase": {
      "type": "object",
      "properties": {
        "network": { "$ref": "#/$defs/hosts" },
        "fs": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "read":  { "$ref": "#/$defs/paths" },
            "write": { "$ref": "#/$defs/paths" }
          }
        },
        "childProcess": { "$ref": "#/$defs/names" },
        "env": {
          "type": "array", "uniqueItems": true,
          "items": { "type": "string", "pattern": "^[A-Za-z_][A-Za-z0-9_]*$" }
        }
      }
    },
    "hosts": {
      "type": "array", "uniqueItems": true,
      "items": { "type": "string",
                 "pattern": "^(\\*\\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$" }
    },
    "paths": {
      "type": "array", "uniqueItems": true,
      "items": { "type": "string",
                 "pattern": "^\\$(PKG|TMPDIR|HOME|CWD)(/.*)?$" }
    },
    "names": {
      "type": "array", "uniqueItems": true,
      "items": { "type": "string", "minLength": 1 }
    }
  }
}
```
