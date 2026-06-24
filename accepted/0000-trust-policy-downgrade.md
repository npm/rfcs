---
title: Fail installs on publish-trust downgrades (trust policy)
number: null
status: proposed
created: null
accepted_at: null
implemented_at: null
withdrawn_at: null
implementation: null
---

# Fail installs on publish-trust downgrades (trust policy)

## Summary

Add a `trust-policy` setting to the npm CLI that detects when a package's publish-trust level drops.
For example, a package was previously published via trusted publishing (OIDC) with provenance, and a newer version arrives with weaker evidence: provenance only, or nothing at all.
That drop is a strong signal of a supply-chain compromise, such as a stolen publish token or a hijacked maintainer account.
Depending on the configured policy, npm can warn (the proposed default) or fail the install (`error`) when it sees one, before any lifecycle scripts run.
Four knobs tune the behavior: `trust-policy-exclude`, `trust-policy-enforce-since`, `trust-lockfile`, and a one-off `--allow-trust-downgrade` escape hatch.
This is a trust-on-first-use (TOFU) check modelled on pnpm's `trustPolicy` family.

## Motivation

npm already lets publishers establish strong, verifiable trust in a release:

- **Trusted publishing.** Publishing from CI via OIDC with no long-lived token.
  The registry records this on each version as `_npmUser.trustedPublisher` and, for GitHub Actions and GitLab, automatically attaches provenance.
- **Provenance attestations.** SLSA provenance signed through Sigstore and logged in Rekor, recorded as `dist.attestations.provenance`.
- **Staged or approved publishing.** A human reviewer approves the release, recorded as `_npmUser.approver`.

What npm does not do today is notice when that trust goes away.
The absence of provenance or trusted publishing on a new version is silently ignored at install time.
`npm audit signatures` counts how many installed packages have verified attestations, but it treats missing attestations as completely normal, it runs after install (so a malicious `postinstall` has already executed), and it has no concept of "this package used to be trusted and now isn't."

This is the gap an attacker exploits.
The most damaging recent npm incidents follow the same pattern: an attacker obtains a maintainer's credentials and publishes a back-doored version.
If the legitimate releases were coming from a trusted-publishing CI workflow, the malicious hand-pushed version is a visible downgrade: it lacks the OIDC trusted-publisher record and provenance that every recent legitimate release carried.
Today npm installs it without comment.

Consider a concrete example.
`chokidar@5.0.0` is published today via GitHub Actions trusted publishing:

```jsonc
// https://registry.npmjs.org/chokidar/5.0.0 -> _npmUser
{
  "name": "GitHub Actions",
  "email": "npm-oidc-no-reply@github.com",
  "trustedPublisher": { "id": "github", "oidcConfigId": "oidc:3c578f99-..." }
}
```

If an attacker steals a classic token and pushes `chokidar@5.0.1` with a `postinstall` payload, that version's `_npmUser` is an ordinary user record with no `trustedPublisher` and no `dist.attestations`.
Every consumer who runs `npm install` pulls it and runs the script.
A trust-policy check would see that the strongest earlier release was `trustedPublisher` and the new one is `none`, flag the downgrade, and (in `error` mode) stop the install before the script runs.

This proposal is scoped to the npm CLI and its configuration.
It needs no registry changes to ship, because the signals already live in the registry metadata (see *Detailed Explanation*).
It is a narrower, more actionable form of the broader supply-chain detection discussed in [npm/rfcs#860][issue-860].
The main objection raised there, that it is legitimate for a maintainer to stop using provenance or OIDC ([@ljharb][860-ljharb]), is real.
The design answers it directly: relative TOFU only, a `warn` default, exclusions, a grandfathering cutoff, and an escape hatch.
The same thread also shows explicit demand for the check.
[@everett1992][860-everett] wrote that a trusted-publishing change is "a signal that I would want to fail an install and require a human in the loop."

## Detailed Explanation

### Publish-trust levels

npm assigns each version a trust level derived from metadata the registry already publishes.
The hierarchy (strongest first) mirrors pnpm's `getTrustEvidence` ranking and is verifiable against live registry data:

| Rank | Level               | Derived from (full packument)                                                  | Meaning                                                                     |
|------|---------------------|--------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| 3    | `staged-publish`    | `_npmUser.approver` present                                                    | A human approved the release through staged publishing.                     |
| 2    | `trusted-publisher` | `_npmUser.trustedPublisher` present and `dist.attestations.provenance` present | Published from CI via OIDC trusted publishing, with provenance.             |
| 1    | `provenance`        | `dist.attestations.provenance` present                                         | Provenance attestation only (e.g. `npm publish --provenance` with a token). |
| 0    | `none`              | none of the above                                                              | No machine-verifiable publish trust.                                        |

Notes:

- `trusted-publisher` requires both the OIDC record and provenance.
  A `trustedPublisher` record without provenance ranks as `provenance` (1), not 2.
- These fields are real and current.
  Examples confirmed live:
  - [`tinyglobby@0.2.17`](https://registry.npmjs.org/tinyglobby/0.2.17) has `_npmUser.approver`.
  - [`pacote@21.5.0`](https://registry.npmjs.org/pacote/21.5.0) has `_npmUser.trustedPublisher`.
  - [`sigstore@3.0.0`](https://registry.npmjs.org/sigstore/3.0.0) has `dist.attestations.provenance`.

### What counts as a downgrade

A downgrade is evaluated per package and ordered by publish date, not by semver.
For a target version `T` of package `P`:

1. **Exclusions.** If `P` (or `P@T`) matches `trust-policy-exclude`, pass.
2. **Cutoff.** If `T` was published before `trust-policy-enforce-since`, pass.
   (Lets legacy, pre-provenance versions install without per-package exclusions.)
3. **Strongest prior.** Compute `S` = the highest trust level among all versions of `P` published before `T`'s publish time.
   Pre-release versions are excluded from this scan when `T` is a stable release, so a trusted pre-release cannot block a stable release (and vice versa).
   When a lockfile entry for `P` exists, its recorded level is also taken into account (see *Lockfile integration*).
4. **Compare.** If `S` is stronger than `T`'s level, `P@T` is a trust downgrade.

Time-ordering matters: a maintainer (or attacker) can publish a *lower* semver after a higher one (back-ports, re-tags).
Comparing by publish time prevents an attacker from side-stepping the check by choosing a clever version number.

### Configuration

All settings are standard npm config (usable in `.npmrc`, `npm config set`, env as `NPM_CONFIG_*`, or per-command flags).

#### `trust-policy`

- **Type:** `"off" | "warn" | "error"`
- **Default:** `warn` *(See [Unresolved Questions](#unresolved-questions-and-bikeshedding))*
- `off`: disable the check entirely.
- `warn`: print a warning for each downgrade and continue (exit 0).
- `error`: fail the install with a non-zero exit and error code `ETRUSTDOWNGRADE`.
  Recommended for CI and lockfile-strict workflows.

```ini
; .npmrc
trust-policy=error
```

#### `trust-policy-exclude`

- **Type:** `string[]` of package selectors
- **Default:** empty

Selectors use the same grammar as other npm package matchers:

- `left-pad`: all versions of a package
- `chokidar@4.0.3`: a specific version
- `webpack@4.47.0 || 5.102.1`: a version set
- `@myscope/*`: a scope glob

```ini
; .npmrc (repeated keys form an array)
trust-policy-exclude[]=left-pad
trust-policy-exclude[]=@types/*
trust-policy-exclude[]=legacy-tool@1.0.0
```

The exclusion check runs first.
A match bypasses the entire trust check for the selected package or version.

#### `trust-policy-enforce-since`

- **Type:** ISO 8601 date (e.g. `2023-04-01`)
- **Default:** unset (enforce for every version)

Only versions published on or after this date are subject to the trust check, anything published earlier is grandfathered in.
This is the migration knob for the pre-provenance ecosystem: provenance and trusted publishing did not exist before 2023, so without a cutoff a strict policy would flag legacy versions that never had a chance to carry trust evidence.
Pin it to the provenance era (for example `trust-policy-enforce-since=2023-04-01`) and the exemption never needs revisiting.
Coverage grows on its own as more post-cutoff versions are published.

#### `trust-lockfile`

- **Type:** boolean
- **Default:** `false`

When `true`, npm trusts the trust levels already recorded in the lockfile and skips re-verifying existing lockfile entries against the registry.
Useful for closed-source projects where every lockfile change comes from a trusted author and the re-verification pass is unwanted overhead.
Leave it `false` whenever outside collaborators can edit the lockfile, because a poisoned lockfile authored under a weaker policy could otherwise slip through.
(Mirrors pnpm's `trustLockfile`.)

#### `--allow-trust-downgrade` (one-off escape hatch)

A per-command flag that permits trust downgrades for a single invocation.
It demotes `error` to a printed notice for that run only, so a developer who has *confirmed* a downgrade is legitimate can proceed without permanently editing config:

```sh
npm install chokidar --allow-trust-downgrade
```

This is the analogue of Yarn's `--no-time-gate`.
It is intentionally inconvenient and non-persistent so it cannot become an accidental default.

### Lockfile integration

To give the TOFU check durable, reproducible state, npm records the established trust level in `package-lock.json` (v3) per package, alongside the existing `integrity`.
This follows the precedent of `hasInstallScript`, which already stores a security-relevant per-package boolean in the lockfile:

```jsonc
"node_modules/chokidar": {
  "version": "5.0.0",
  "resolved": "https://registry.npmjs.org/chokidar/-/chokidar-5.0.0.tgz",
  "integrity": "sha512-...",
  "trust": "trusted-publisher"      // one of: staged-publish | trusted-publisher | provenance
}
```

The field is omitted when the level is `none`.
Recording it means:

- Reproducible, offline checks.
  `npm ci` can detect a downgrade against the level captured when the dependency was added, without re-deriving it.
- Update-time comparison.
  When `npm update` would move `P` to a version weaker than the locked level, that is itself a downgrade to report.
- `trust-lockfile` support.
  The recorded level is what `trust-lockfile=true` trusts.

The lockfile is never published, so this adds no publish-side surface.
The same data is written to the hidden `node_modules/.package-lock.json` so reified trees carry the state too.

### Where the check runs

The trust check runs during dependency resolution and ideal-tree construction, and, critically, before any lifecycle scripts run.
That is the advantage over `npm audit signatures`, which runs after install, once a malicious `postinstall` has already executed.
It applies to any command that resolves or reifies a tree: `npm install`, `npm ci`, `npm update`, and `npm dedupe`.

### Example output

`warn` mode:

```plaintext
npm warn trust-policy chokidar@5.0.1 is a trust downgrade (possible account takeover)
npm warn trust-policy   earlier releases were published via trusted-publisher. This version has no trust evidence
npm warn trust-policy   to allow: npm install --allow-trust-downgrade, or add to trust-policy-exclude
```

`error` mode:

```plaintext
npm error code ETRUSTDOWNGRADE
npm error High-risk trust downgrade for "chokidar@5.0.1" (possible package takeover)
npm error Trust checks are based on publish date, not semver. An earlier-published
npm error version had stronger publish trust (trusted-publisher) than this version (none).
npm error A trust downgrade may indicate a supply-chain incident. If you believe this
npm error change is legitimate, re-run with --allow-trust-downgrade or add the package
npm error to trust-policy-exclude.
```

## Rationale and Alternatives

### Why relative TOFU rather than an absolute minimum-trust requirement?

Requiring every install to carry provenance or trusted publishing would break the enormous long tail of packages that have never published with any trust evidence, and is a non-starter as a default.
A relative check only fires when a package that did earn trust later loses it.
It never penalizes a package for being consistently low-trust.
This is the same idea behind SSH `known_hosts` and HSTS: protect what was established at first use, and don't demand universal adoption up front.

### Alternative 1: do nothing, lean on `npm audit signatures`

Rejected.
`audit signatures` runs after install (too late to stop `postinstall`), reports only absolute counts, and has no downgrade concept.
It is a verification tool, not a gate.

### Alternative 2: registry-side enforcement

The registry could block or flag downgrades, or surface a per-package "minimum trust" in the abbreviated packument.
That is more powerful, but it is intentionally out of scope here (this RFC is limited to the CLI and its configuration), it takes longer to land, and it gives consumers no local control.
A client-side check ships now using metadata that already exists, and lets each consumer choose their own risk posture.
Registry support is worth pursuing later, and it would also remove the full-packument cost described under *Implementation*.

### Alternative 3: compare by semver instead of publish time

Publishing a low semver after a high one is legitimate (LTS back-ports) and is also an obvious evasion if the comparison were semver-ordered.
Publish-time ordering is robust to both.

### Alternative 4: a single boolean (`--require-provenance`)

Rejected as both too blunt (no hierarchy, no exclusions, no grace) and too disruptive (absolute, not relative).
The graded `off|warn|error` policy, plus the four tuning knobs, is what makes a default of `warn` workable.

## Implementation

Primarily npm CLI repositories:

- `@npmcli/config`: add the `trust-policy`, `trust-policy-exclude`, `trust-policy-enforce-since`, and `trust-lockfile` definitions, plus the `--allow-trust-downgrade` flag.
- `pacote`: manifest/packument fetching.
  The trust check needs `_npmUser.trustedPublisher`, `_npmUser.approver`, `dist.attestations`, and per-version publish `time`.
  Cost/precision tradeoff: the abbreviated 'corgi' packument used during install omits `_npmUser` and the top-level `time{}` map, though it keeps `dist.attestations`.
  Therefore:
  - A `provenance` vs `none` downgrade can be detected from the abbreviated doc.
  - Detecting the `trusted-publisher` and `staged-publish` tiers and doing time-ordering requires the full packument.

  When `trust-policy !== off`, npm should fetch full metadata for candidate packages and cache only the needed fields (`time`, `_npmUser.trustedPublisher`, `_npmUser.approver`, `dist.attestations.provenance`)
  pnpm hit real OOM issues caching whole documents on ~4k-entry workspaces and trimmed the cache to exactly these fields (npm should do likewise).
- `@npmcli/arborist`: integrate the check into the ideal-tree build and `reify`, gating before lifecycle scripts.
  Emit `warn` logs or throw `ETRUSTDOWNGRADE`.
  Read and write the new lockfile `trust` field in the shrinkwrap and hidden lockfile writers.
  Honor `trust-lockfile` to skip re-verification of existing entries.
- CLI surface: thread `--allow-trust-downgrade` through `install`, `ci`, `update`, and `dedupe`.
  Document the new error code.

The trust-level derivation is a small pure function over manifest fields and is straightforward to unit-test with fixtures for each tier and each downgrade transition (e.g. `trusted-publisher -> provenance`, `trusted-publisher -> none`, `staged-publish -> trusted-publisher`).

## Prior Art

### pnpm: the direct model

pnpm shipped this exact feature, which this RFC closely follows:

| Setting        | pnpm                                              | This RFC                                            |
|----------------|---------------------------------------------------|-----------------------------------------------------|
| Policy switch  | `trustPolicy: off \ no-downgrade` (default `off`) | `trust-policy: off \ warn \ error` (default `warn`) |
| Exclusions     | `trustPolicyExclude`                              | `trust-policy-exclude`                              |
| Grandfathering | `trustPolicyIgnoreAfter` (duration)               | `trust-policy-enforce-since` (date)                 |
| Lockfile pin   | `trustLockfile`                                   | `trust-lockfile`                                    |

pnpm reads the same npm registry fields (`_npmUser.trustedPublisher`, `_npmUser.approver`, `dist.attestations.provenance`), ranks them `stagedPublish > trustedPublisher > provenance > none`, compares them in publish order, and throws `TRUST_DOWNGRADE`.
Two differences here: npm gains a `warn` level (pnpm only errors, though it keeps the whole thing behind opt-in), and this RFC proposes `warn` as a default rather than fully opt-in.

### Other JavaScript package managers

- Yarn Berry has no provenance or trust-downgrade detection, but two relevant patterns: an age gate (`npmMinimalAgeGate`, default `1d`) that quarantines very new versions, and a hardened mode (`enableHardenedMode`) that auto-enables on public-repo PRs to validate lockfile resolutions.
  The auto-on-in-PRs idea is good prior art for making a strict check the default in the most dangerous context.
- Deno and JSR auto-create SLSA provenance at publish but enforce nothing at install time.
  The trust lives on the registry side, with no client-side downgrade gate.
- Bun's `trustedDependencies` is about lifecycle-script execution, not publish trust (it is orthogonal to this proposal).

### Outside JavaScript

- NuGet is the closest non-JS analogue.
  `trustedSigners` in `nuget.config` pins which author certificates or repository owners a consumer trusts.
  With `signatureValidationMode=require`, a version that is no longer signed by the pinned author (or whose `<owners>` changed) fails to install (`NU3034`).
  Like this RFC, the default is permissive (`accept`) and enforcement is opt-in.
- Go modules implement the strongest content TOFU: `go.sum` plus the global `sum.golang.org` transparency log make any `module@version` immutable and consistent across the ecosystem (hard fail on mismatch, default-on since Go 1.13).
  It protects content rather than publisher identity, but it shows that default-on TOFU can work at ecosystem scale.
- PyPI, RubyGems, and crates.io all added OIDC trusted publishing (and PyPI added PEP 740 attestations), but none of them detect a downgrade from trusted publishing back to a token upload.
  The two mechanisms simply coexist.
- Maven Central mandates GPG signatures at publish, but client verification is off by default and there is no downgrade detection.

### General downgrade-protection precedents

- TUF provides formal rollback protection (monotonic metadata versions + clients reject older state) and a model for legitimate trust changes through threshold-signed key rotation.
  The lesson: a downgrade should require an explicit, verifiable signal, not just "stop sending the evidence."
- HSTS (RFC 6797) is the classic "TOFU then enforce" pattern: after the first secure contact a browser hard-fails on a protocol downgrade, while `max-age` gives a built-in grace period.
  `trust-policy-enforce-since` plays a similar role.
- SSH `known_hosts` hard-fails when a host key changes and requires an explicit `ssh-keygen -R` to accept a legitimate rotation.
  That is the same shape as the `--allow-trust-downgrade` flag and the exclusion list here.
- Certificate Transparency (RFC 6962) shows append-only logs turning a later absence of expected evidence into an observable, auditable gap.

Lessons carried into this design: make the secure path the default but soft (`warn`) to avoid the NuGet and PyPI trap where opt-in enforcement goes unused.
Provide an explicit, inconvenient override for legitimate downgrades.
Grandfather the pre-provenance back-catalogue with a cutoff date, and keep publisher-identity trust separate from content integrity (which `integrity` already covers).

## Unresolved Questions and Bikeshedding

### Default level (the main open decision)

This RFC proposes `warn` as a rollout-safe default, with `error` recommended for CI and proposed as the eventual default in a future major.
 Should `error` be the default from day one given npm's scale?
 Alternatively, should `npm ci` (CI-oriented, lockfile-strict) default to `error` while `npm install` stays at `warn`, mirroring Yarn's hardened-mode-on-PRs heuristic?

### Config value naming

`off|warn|error` (severity) vs. pnpm's `off|no-downgrade` (policy).
Aligning value names with pnpm aids cross-tool muscle memory.
A severity triple is more npm-idiomatic and supports a `warn` default.
Relatedly, this RFC uses a date-valued `trust-policy-enforce-since` for grandfathering rather than pnpm's duration-based `trustPolicyIgnoreAfter`, since grandfathering is a fixed epoch and a date matches npm's `--before`.
Should it *also* accept a rolling duration for pnpm parity and for a "police only recent publishes" policy?

### Legitimate downgrades

The cleanest long-term answer (following TUF, SSH, and HSTS) is an explicit, registry-side maintainer signal ("I am intentionally dropping trusted publishing for this package"), so a downgrade can be distinguished from an attack without each consumer maintaining excludes.
Should this RFC reserve space for such a signal even though the registry change is out of scope here?

### Full-packument cost

Always fetch full metadata when `trust-policy !== off` (with field-trimmed caching), or push for the registry to add `trustedPublisher`, `approver`, and `time` to the abbreviated install document so the check is cheap for everyone?

### Lockfile field shape

`"trust": "trusted-publisher"` (string enum) vs. a structured object, and whether to persist in `package-lock.json` only, or also rely on the hidden lockfile.

### Scope of the trust signal

Should a missing registry ECDSA signature (`dist.signatures`), which essentially all modern registry packages carry, also count toward the trust level, or stay a separate concern of `npm audit signatures`?

### Workspaces, monorepos, and `--before`

Confirm interaction with workspace installs and with time-travel installs via `--before`.

[issue-860]: https://github.com/npm/rfcs/issues/860
[860-ljharb]: https://github.com/npm/rfcs/issues/860#issuecomment-4178654815
[860-everett]: https://github.com/npm/rfcs/issues/860#issuecomment-4195097331
