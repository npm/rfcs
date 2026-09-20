---
title: "RFC 0049 follow-up: bounded bulk attestation retrieval"
number: null
status: proposed
created: null
accepted_at: null
implemented_at: null
withdrawn_at: null
implementation: null
---

# RFC 0049 follow-up: bounded bulk attestation retrieval

## Summary

Add a documented, bounded npm registry interface that accepts multiple exact
package versions and returns a result for each, optionally including the
attestation bundles needed for local verification. Pacote and the npm CLI can
use the interface where it reduces work and retain the current per-version path
as a fallback. If bulk retrieval is not currently feasible, document the
existing exact-version endpoint as a supported integration path.

## Motivation

[RFC 0049](https://github.com/npm/rfcs/pull/626), merged on 2022-11-07,
described fetching provenance and publish attestations in bulk for an installed
dependency graph, similar to the advisory API. Bulk retrieval was present in the
[initial draft](https://github.com/npm/rfcs/blob/6e6ec6c4a3a3786bc5b8481c3e0e939bc08fc015/accepted/0000-link-packages-to-source-and-build.md#L289)
and remains in the implemented RFC's
[performance design](https://github.com/npm/rfcs/blob/520fe7d8a0e9c4ccbaf20acbbc73d954dd6f19f3/implemented/0049-link-packages-to-source-and-build.md#L408-L413).

The current `npm audit signatures` path instead:

1. invokes `pacote.manifest(name@version, ...)` for each eligible dependency,
   with concurrency limited to 20
   ([source](https://github.com/npm/cli/blob/6400533ab3d830716964bcf0def42b6c47f3fd70/lib/utils/verify-signatures.js#L27-L45),
   [manifest call](https://github.com/npm/cli/blob/6400533ab3d830716964bcf0def42b6c47f3fd70/lib/utils/verify-signatures.js#L294-L311));
2. reads `dist.attestations` from the selected version; and
3. retrieves and verifies that version's attestation response when advertised
   ([Pacote source](https://github.com/npm/pacote/blob/c82bdcdd8010a9a87c95e1e09b0ba51322b4f93f/lib/registry.js#L228-L239)).

This is a reasonable bounded-concurrency implementation, but it is not the
multi-version retrieval path described by RFC 0049.

Since npm 11.12.0, `npm audit signatures --json --include-attestations` can
include the verified bundles it retrieved for use by downstream tools
([npm CLI PR 9049](https://github.com/npm/cli/pull/9049)). That is a useful
CLI output boundary, but it does not change the retrieval path: the command
still performs the per-version Pacote work above and does not expose a
registry-level multi-version contract.

Version metadata already exposes the per-version `dist.attestations` object.
At the registry protocol layer, a lockfile consumer that already knows the exact
package name, version, tarball URL, and integrity currently has two practical
choices:

- call the observed exact-version endpoint,
  `GET /-/npm/v1/attestations/<name>@<version>`, once per version; or
- fetch package metadata and then retrieve the registry-advertised bundles for
  versions that advertise attestations.

In the dependency graph measured below, direct retrieval used fewer operations.
However, I could not find the exact-version endpoint documented as a supported
npm registry contract. The metadata-first path avoids constructing that route
but adds metadata requests and still requires a bundle response for every
version that advertises attestations.

I reviewed the RFC discussion and the implementation reviews in
[Pacote PR 259](https://github.com/npm/pacote/pull/259) and
[npm CLI PR 6153](https://github.com/npm/cli/pull/6153). I found discussion of
provenance value, rollout, provider support, policy, testing, and error handling,
but did not find a recorded rationale for replacing bulk retrieval with the
current per-version path. I may be missing registry constraints or implementation
history that were not recorded there.

### Measurements

I tested 993 unique `(name, version)` pairs from the npm CLI monorepo
[lockfile](https://github.com/npm/cli/blob/72a6088fcdd8099d5f07bf7e06f54a24a835fc5f/package-lock.json)
on 2026-08-10 and repeated the test on 2026-09-19. Both runs found exactly 169
versions with attestations and 824 returning 404. Sequential direct retrieval
took 92.3 seconds in the first run and 79.3 seconds in the second. Network
timings varied, but the request count and availability split did not.

The 2026-09-19 rerun compared the main client-side alternatives with concurrency
20 where applicable:

| Retrieval path | Request shape | Measured wall time | Successful response bodies |
|---|---:|---:|---:|
| Direct exact-version GET | 993 GETs | 4.4 s | 2.42 MB |
| Abbreviated packuments, then bundles | 839 + 169 GETs | 7.4 s | 69.74 MB |
| HEAD preflight, then attestation GETs | 993 HEADs + 169 required GETs | 4.8 s for preflight only | 0 for preflight only |

These are local metadata and bundle measurements, not an npm install benchmark
or a benchmark of a bulk implementation. Response-body figures exclude headers,
and wall time depends on network and registry conditions. The supported
conclusion is structural: registry operations on the current paths grow with
the dependency graph, and the alternatives tested do not remove that scaling
behavior.

## Detailed Explanation

Add a documented, versioned registry endpoint that:

- accepts a bounded list of exact package names and versions for one registry;
- may accept expected artifact integrity to bind each result to the artifact
  already selected by the client;
- returns an explicit `available`, `absent`, or error result for every item;
- supports returning predicate metadata only or the corresponding bundles;
- defines item-count, request-size, response-size, and per-item bundle limits;
- defines authentication, partial-failure, and caching behavior; and
- preserves deterministic correlation between each request item and result.

Large graphs should use bounded batches or a bounded streaming response rather
than an unbounded document.

For the npm CLI, Pacote, and independent package managers or admission tools,
this would provide a supported protocol instead of dependence on an observed
route. It would give cold dependency graphs a bounded request shape as
attestation adoption grows, and its per-item results would distinguish clean
absence from transport, authorization, format, and other failures. Publishing
the same contract would also give alternate registries, mirrors, and proxies a
clear implementation target. Clients could retrieve the graph's evidence in a
bounded phase and then perform artifact-bound verification locally.

Pacote can validate the response and retain its current per-version behavior for
registries that do not implement the endpoint. The npm CLI can use the bulk path
where it reduces work. Because `npm audit signatures` also obtains registry
signatures from manifests, an attestation-only bulk endpoint may not eliminate
all manifest operations from that combined command. Returning registry
signatures as part of the same contract can be considered separately.

If a bulk interface is not currently feasible, documenting the existing
exact-version endpoint and its stability, status semantics, limits, and
authentication behavior would still provide a supported baseline.

The response remains untrusted registry input. Clients must still bind each
attestation to the exact package identity and artifact digest, validate its
signature and trust material, and distinguish absence from transport, format,
authorization, and verification failures. Clients must also partition requests
by registry so a batch never discloses private- or alternate-registry package
identities to the public npm registry.

## Rationale and Alternatives

The proposed bulk contract addresses both the request shape and the lack of a
documented multi-version integration point. It does not make evidence transfer
or cryptographic verification constant-time; those remain proportional to the
number and size of returned attestations.

### Keep direct retrieval with bounded concurrency and caching

This avoids a mandatory metadata preflight and was the lowest-operation path in
the measured graph; it remains a necessary fallback. Concurrency 20 reduced the
measured 993-request wall time from 79.3 seconds sequentially to 4.4 seconds. It
does not reduce upstream request count. An integrity-keyed local cache can
improve repeat runs but not a cold graph or newly published versions.

### Fetch packuments first

Not preferred for the whole graph. The measured packument-first path made 1,008
requests, took 7.4 seconds, and transferred 69.74 MB of successful response
bodies, compared with 993 requests, 4.4 seconds, and 2.42 MB for direct
retrieval.

Reusing a packument already needed to resolve an entry without a tarball URL is
worthwhile. For this corpus, such reuse reduced the modeled marginal attestation
request count from 993 to 352. That optimization depends on lockfile shape and
disappears when every entry already has a resolved tarball URL, so it complements
rather than replaces a bulk contract.

### Use a HEAD presence preflight

Not preferred. It retains one request per version and requires another GET for
every version with attestations. The measured corpus therefore requires 993 HEAD
requests before 169 bundle GETs, or 1,162 total requests.

## Implementation

The registry service would own the versioned request and response contract,
authentication behavior, resource limits, cache semantics, and per-item error
model. Pacote would add schema validation and a bounded fallback to its existing
per-version behavior. The npm CLI could consume that Pacote capability while
retaining any manifest operations still required for registry-signature
verification.

Tests should cover mixed available, absent, malformed, unauthorized, and failed
items; batch limits; response limits; deterministic correlation; registry
partitioning; and fallback behavior. Benchmarks should compare request count,
successful response bytes, and wall time on small and large dependency graphs.

No change to Sigstore verification is implied. Retrieval and presence do not
constitute verification.

## Prior Art

RFC 0049 itself identifies npm's bulk advisory retrieval as the analogous
registry pattern. This proposal follows that direction while requiring limits
and per-item outcomes appropriate for larger attestation evidence.

## Unresolved Questions and Bikeshedding

1. Was RFC 0049's bulk-retrieval design deliberately deferred or replaced? If
   so, what constraint drove that change?
2. Should the first contract return only attestations, or also the registry
   signatures needed by the combined `npm audit signatures` workflow?
3. If a bulk contract is not currently feasible, can the existing exact-version
   endpoint be documented as a supported integration path?
