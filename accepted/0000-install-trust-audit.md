---
title: Install trust audit — classified fetch telemetry for package publishers
number: null
status: proposed
created: null
accepted_at: null
implemented_at: null
withdrawn_at: null
implementation: null
---

# Install trust audit — classified fetch telemetry for package publishers

## Summary

This RFC adds an opt-in, per-package audit mode at the registry tarball
endpoint. When enabled, the registry classifies every tarball fetch as
`human`, `automation`, or `spam_user` and emits a structured
`install-trust-check` event. **No fetch is ever blocked.** Publishers get
real signal on human vs automated adoption — something download counts and
per-package CI tokens never delivered.

```jsonc
{
  "publishConfig": {
    "trustCheck": "audit"
  }
}
```

## Motivation

1. **Download counts are noise.** npm package download statistics mix real
   users, CI pipelines, mirrors, scrapers, malware sandboxes, and
   misconfigured loops. A spike can mean adoption, abuse, or infrastructure
   churn — publishers cannot tell.
2. **No per-package visibility today.** Publishers have no way to ask "of the
   50K installs this week, how many were humans vs CI vs scrapers?" without
   instrumenting their own package (which they cannot do reliably).
3. **Agent hallucination storms are a new threat.** LLM coding agents
   routinely attempt to install hallucinated or wrong packages. Audit events
   surface these patterns early — a publisher seeing 200 `automation` fetches
   for a version that doesn't exist knows something is wrong.
4. **Publish-side hardening is necessary but not sufficient.** npm's 2025
   work (mandatory WebAuthn 2FA, OIDC trusted publishing, staged publishing)
   correctly targets the publish side. Audit complements this by giving
   publishers install-side signal without blocking anything.

## Detailed Explanation

### Package policy

A new optional field in `package.json`, read at publish time and stored in
the registry package document:

```jsonc
{
  "publishConfig": {
    "trustCheck": "audit"
  }
}
```

- `"none"` (default): no change to existing install flow.
- `"audit"`: the registry classifies every tarball fetch and records an
  `install-trust-check` event. The tarball is always served.

No other modes are proposed in this RFC. Blocking modes (`require`,
`require-human`) were considered and rejected — see [Rejected: blocking
modes](#rejected-blocking-modes).

### Classification

The registry classifies each tarball request using passive signals already
available at the HTTP layer. No client-side changes are required for
`"audit"` mode — the tarball is served regardless of classification.

Signals:

- **IP/ASN reputation.** Known CI provider ranges (GitHub Actions, AWS
  CodeBuild, GitLab CI, Azure Pipelines, Google Cloud Build, Vercel,
  Netlify). Maintained from public IP range feeds.
- **User-Agent and TLS fingerprinting.** Standard CI `User-Agent` strings
  and headless TLS fingerprints. A desktop browser fingerprint from a cloud
  IP is treated as ambiguous.
- **Challenge echo.** The registry's metadata response includes an
  `X-NPM-Trust-Check-Challenge` nonce. The official npm CLI echoes it in the
  subsequent tarball request. Naive scrapers that skip the metadata fetch or
  don't mirror headers are classified as `spam_user` or `unattended`.
- **Abuse signals.** Known bulk-scraper networks, TOR exit nodes, open
  proxies, exploit-tooling `User-Agent` strings, and rate-limit violators
  accumulate a negative score.

Classification output (`tokenKind`):

| `tokenKind` | Meaning |
|-------------|---------|
| `human` | Residential IP, interactive client, no abuse signals |
| `heuristic-automation` | Known CI ASN, CI User-Agent, challenge echoed |
| `unattended` | Cloud IP but ambiguous signals — likely automated but not recognized CI |
| `automation` | Request presented an explicit `automation` token |
| `service` | Request presented a `service` token (mirror, indexer) |
| `spam_user` | Known scraper/proxy/exploit-tooling, or multiple abuse signals |

### Event format

Every tarball fetch for an `"audit"` package emits an
`install-trust-check` event:

```jsonc
{
  "type": "install-trust-check",
  "package": "some-package",
  "version": "1.2.3",
  "tokenKind": "heuristic-automation",
  "timestamp": "2026-08-19T12:00:00Z",
  "trustCheckIdHash": "sha256:abc123...",  // opaque, for dedup/appeal
  "provenancePresent": true
}
```

- No raw IP, fingerprint, or token value is retained. Only category-level
  signal names and hashes are stored.
- `provenancePresent` indicates whether the package version has a Sigstore
  provenance attestation. A version that **lost** provenance that prior
  versions had is a publish-side compromise signal — see below.

### Provenance regression signal

The audit event includes `provenancePresent` so publishers can detect the
pattern that defined 2025's catastrophic npm incidents:

- **Shai-Hulud (Sept 2025):** 500+ packages compromised via postinstall
  token theft. The tell was lost provenance on poisoned versions.
- **chalk/debug phished-maintainer takeover:** 17 packages, 2B+ weekly
  downloads. Same pattern — new versions lacked the provenance attestation
  that prior versions carried.

A publisher dashboard showing `provenancePresent: false` on a new version
where all prior versions were `true` is an early warning that doesn't
require any blocking or client-side change.

### Publisher dashboard

Publishers with `"audit"` enabled get a per-package view:

- Fetch counts by `tokenKind` over time (human vs automation vs spam).
- Provenance status per version.
- Anomaly alerts (sudden `spam_user` spike, provenance regression, agent
  hallucination storm on a non-existent version).

## Rationale and Alternatives

1. **Do nothing.** Publishers stay blind to human vs automated traffic.
   Agent hallucination storms go undetected.
2. **Per-package CI tokens.** Operationally expensive, excludes public forks
   and one-off scripts, and still gives no human-vs-automation breakdown.
3. **Client-side wrapper (`npx <pkg>-install`).** Trivially bypassed, doesn't
   protect registry metrics.
4. **Blocking modes (`require`/`require-human`).** Rejected — see below.

The chosen design is a registry-side, opt-in audit that classifies fetches
and emits structured events without ever blocking. It gives publishers the
signal they need at zero install-time cost.

## Rejected: blocking modes

Earlier drafts of this RFC proposed `require` and `require-human` modes that
would block tarball fetches (`428 Precondition Required`) until the client
presented a trust check token. These were rejected for the following
reasons:

1. **Does not address publish-side compromise.** The 2025 incidents
   (Shai-Hulud, chalk/debug) were publish-side attacks. The worm ran *after*
   a legitimate install already succeeded, on hardware that already proved
   it was human. A download-side gate does not touch that chain.
2. **Credential caching becomes a target.** If `human` tokens are
   session-cached (likely, for UX), the same malware that steals npm tokens
   and SSH keys gets a new high-value target: the trust-check token cache at
   `~/.npm/_trust-checks`.
3. **Heuristic automation is not proof.** Known-CI-ASN + fingerprint is
   exactly the profile a *compromised* CI job already has — it genuinely is
   CI. The heuristic lane provides convenience, not security.
4. **Hardware-binding raises cost, doesn't eliminate automation.** Mechanical
   USB security-key pressers mass-produce valid WebAuthn signatures.
5. **Ecosystem friction.** Headless servers, SSH sessions, and developers
   without security keys are disproportionately affected. pnpm's lighter
   trust check already generates steady "breaking installs" reports.

`audit` mode delivers the telemetry value without any of these risks.

## Implementation

### Registry

- Add `trustCheck` to the package document schema (`"none"` or `"audit"`).
- Build and maintain the CI signal catalog (ASN, IP ranges, UA patterns, TLS
  fingerprints) from public feeds.
- Build and maintain an abuse signal catalog (known scraper ASNs, TOR exits,
  open proxies, exploit-tooling signatures, rate-limit violators).
- Add `X-NPM-Trust-Check-Challenge` to metadata responses.
- Classify tarball requests and emit `install-trust-check` events.
- Expose event aggregation via the publisher dashboard API.
- No blocking logic, no 428/403 responses for `"audit"` packages.

### CLI

- Add `npm-trust-check` header support and challenge-echo logic to
  `npm install`.
- No interactive prompts, no WebAuthn, no token caching.
- Older CLI versions that don't send the header are classified as
  `unattended` — the tarball is still served.

### Web

- Publisher dashboard showing fetch classification breakdown, provenance
  status, and anomaly alerts.

### Documentation

- Update registry API docs to describe `trustCheck`, the signal catalog, and
  the event format.
- Publish the classification taxonomy and signal sources for transparency.

## Prior Art

- **Docker Hub** unauthenticated pull limits and authenticated rate tiers.
- **PyPI** project file-size and bandwidth limits.
- **npm provenance / Sigstore** (publish-time attestation): complementary.
  Provenance says where a package was built; audit says who requested the
  install and whether provenance is still present.
- **Cloudflare Turnstile** and **hCaptcha** invisible challenges: this RFC
  avoids client-side challenges entirely, relying on passive server-side
  signals.

## Anticipated Risks and Mitigations

### False positives in classification

- Classification is non-blocking. A misclassified request still gets the
  tarball. The only cost is a wrong `tokenKind` in the event log.
- The CI signal catalog is versioned and publicly auditable; false positives
  can be reported and corrected without a package release.

### Privacy

- No raw IP, fingerprint, or token value is retained. Only category-level
  signal names and opaque hashes are stored.
- ASN/UA/TLS signals are derived from metadata the registry already
  observes; no new tracking scripts or pixels.

### Adoption

- The feature is opt-in per package and defaults to `"none"`.
- Zero install-time cost — no latency, no blocking, no client-side prompts.
- Publishers who don't enable it see no change.

## Unresolved Questions

1. How often should the CI signal catalog be updated, and who maintains the
   canonical list of cloud provider IP ranges?
2. Should the challenge echo be required for `heuristic-automation`
   classification, or should ASN/UA alone suffice?
3. What is the retention period for `install-trust-check` events?
4. Should events be streamable (webhook/SSE) or dashboard-only?
5. Should `provenancePresent` be a boolean or include the attestation
   source (Sigstore, custom)?
