# `npm audit` assertions

## Summary

A mechanism for package maintainers to assert that their packages are not impacted by advisories.

```
npm audit assert --package=<package-name> --id=<advisory identifier> --impactful=<boolean> --comment=<string with reasoning>
```

The scope of this PR is *just* the addition of a new command (`npm audit assert`), updates to `npm audit`, and required registyry/platform changes.

There are a number of previous, alternative, and related initiatives. Some of these initiatives are complentary, and others are entirely incompatible. It's worth taking a look at a few of them - most notably, [rfcs#18](https://github.com/npm/rfcs/pull/18), the proposed OASIS CSAF [VEX](https://github.com/tschmidtb51/csaf/blob/22ea042b47fdbe5ff3709d6f78249f216f51f7f7/csaf_2.0/prose/csaf-v2-editor-draft.md#55-profile-5-vex) format, the NTIA [vulnerability sharing doc](https://www.ntia.doc.gov/files/ntia/publications/draft_requirements_for_sharing_of_vulnerability_status_information_-_vex.pdf).

## Motivation

It's relatively common that `npm audit` creates a painful experience for maintainers of transitive dependencies and for end-users, with a seemingly high likelihood to have a disproportionately large negative impact on beginners who don't actually know what's happening.

Further, the amount of noise that `npm audit` generates from transitive dependencies that rely on a "vulnerable" package where there is no world in which the "vulnerability" can be exploited leads to people ignoring `npm audit` rather than leveraging it to actually address vulnerabilities.

Enabling maintainers of dependencies - most importantly, dependencies that are most often transitive - to assert that their dependencies are not impacted by known vulnerabilities is a way to dramatically reduce the amount of pain that `npm audit` creates.

Further, this creates an additional cascading signal of _validity_ when the maintainers of a transitive dependency mark the advisory as impactful. As maintainers make assertions, we get more context about the impact of advisories across the ecosytem, which - if surfaced to end-users through `npm audit` - helps provide more context to make an informted decision about how to address advisories that they're seeing.

## Detailed Explanation

- `npm audit assert` will be added with the following arguments:
  - `--package=<package-name>` **(required)** where `<package-name>` is the name of the package having an assertion made. If I was a maintainer of `fastify` and wanted to make an assertion about it, I'd use `--package=fastify`.
  - `--id=<advisory identifier>` **(required)** is the identifier of the advisory that impacts my package that I'm making an assertion about. As a hypothetical maintainer of `fastify` wanting to make to make an assertion about the npm advisory `1726`, I'd use `--id=1726`. This also potentially allows for future expansion into other identifiers. For example, if I wanted to make an assertion about `CVE-2021-28562` advisory, I'd use `--id=CVE-2021-28562`. I'd love to see namespacing, like `npm-1726`, but I could understand why people might be against that.
  - `--impactful=<boolean>` **(required)** this should just be `true` or `false`. If it's `true`, then an assertion is made that the advisory is impactful to the package passed to `--package`. If it's `false`, then an assertion is made that the advisory is not impactful to the package passed to `--package`.
  - `--comment=<string>` **(required)** is a comment that, if false, explains why the vulnerability cannot be exploited and, if true, explains why the vulnerability can be exploited.
- `npm audit` will need to be updated to both consume additional data and provide additional filters.
  - by default, `npm audit` should
    - surface advisories that have no assertions or `--impactful=true` assertions
    - ignore advisories that have `--impactful=false` assertions, **presuming** there are no alternative paths to the advisories that have no assertions or `--impactful=true` assertions
    - display maintainer-provided comments when an assertion has been made.
  - the `--assertions` flag should be added
    - it should take the following values:
      - `only`: only show the advisories that have have assertions, `true` or `false`
      - `only-true`: only show the advisories that have `--impactful=true` assertions
      - `only-false`: only show the advisories that have `--impactful=false` assertions
      - `unfiltered`: show all the advisories, regardless of whether they have assertions, `true` or `false`
    - these should probably be sent to the server to be filtered server-side and enable smaller responses.
  - the UI should also display if an assertion has been made, and what that assertion is.
  - `--json` should include assertions, if any exist.
- The addition of `npm audit assert` will require some kind of change to the server that serves the information that powers `npm audit`. Specifically, this information will need to be accepted when `npm audit assert` is run, and returned with `npm audit` information. Additionally, depending on how this is implemented, this might reduce the number of requests made and data returned to end-users. Specifically, if the CLI assumes by default that users want to ignore vulnerabilities that have been marked as `--impactful=false` by transitive (or direct) dependencies **and** that is sent to the server, the server can return only what's needed rather than the full set of data.
  - This should hit a registry endpoint that is routed through the registry the user has defined. This should be done with both the explicit goal of allowing push/pull of _internal_ assertions, provided that the regsitry the user is talking to support this, and enabling third-party registries to cache the assertions on the public registry.

## Rationale and Alternatives

- Do nothing: The current state of the world that has caused [pain](https://overreacted.io/npm-audit-broken-by-design/).
- Allow reporters to mark which packages are impacted: not really scalable, especially since reporters won't be experts in the same way that maintainers are.
- Do something in a neutral space, run by an independent organization: There's no reason this couldn't eventually be implemented under this API. It is contingent on that work being done and being successfully adopted by others. That shouldn't necessarily prevent us from implementing this and mapping it over to that later.

This solution both begins to address the problem that exists presently, doesn't exclude potential external solutions/patterns from being adopted in the future, and allows an implementation to be implemented with _relative_ haste.

## Implementation

{{Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

I've not seen other tools doing this, but I would be surprised if there's not prior art. After some searching, I can't find anthing.

There are, however, related proposals and "standards":

- https://github.com/npm/rfcs/pull/18
- https://github.com/tschmidtb51/csaf/blob/22ea042b47fdbe5ff3709d6f78249f216f51f7f7/csaf_2.0/prose/csaf-v2-editor-draft.md#55-profile-5-vex
- https://www.ntia.doc.gov/files/ntia/publications/draft_requirements_for_sharing_of_vulnerability_status_information_-_vex.pdf

## Unresolved Questions and Bikeshedding

- The potential values for the `--assertions` filter on `npm audit` could probably be bikeshedded a bit. I'm unattached to the names.
- UI in `npm audit` outpit could be bikeshedded as well.
- It would be cool if there was the ability to have multiple maintainers run `npm audit assert` for a given `id` and surface that _multiple_ people signed off on the assertion as a way to begin combatting some forms of social engineering attacks we've seen in the past, but that might be too complex for now.
- There's some need for granularity that is not presently defined by this RFC. Choosing how to address that is... likely necessary.
  - semver ranges, dep type (direct, dev, optional, peer), binary impact vs. non-binary impact, and more.
- There's been an expressed desire for trusting third-parties *outside* of direct maintainers to provide asssertions. This should be discussed.
