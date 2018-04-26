# Installed Size Information

## Summary

This proposal introduces the idea of adding extracted package size information to the output summary for npm install.

## Motivation

npm was originally written to be a package manager for the Node.js community.
Since then, it's seen wide adoption by the general JavaScript community -- most
of them web developers.

While Node users can get away with installing more things, because disk usage is
cheap, those new web developers introduce a new optimization pressure to npm
users: minimizing the size of the bundle they're shipping off to client
browsers. As applications accumulate more and more dependencies, the ability to
minimize their footprint has become a valuable feature in modern libraries.

Right now, there's no built-in way for npm users to figure out the size impact
of adding or removing a package from their tree. In the past, it would have been
easier because you could just trace the nested tree -- but now, because of
flattening and deduplication, it's not trivial to take into account how many new
packages would be added by a particular install, and what their total impact
would be.

This proposal aims to give our users a better ability to gauge the effects
something might have on their production bundle size. This is a unique feature
that essentially requires per-application knowledge, of the kind only a
project-aware installer can provide.

## Detailed Explanation

### Changes to `npm install`

The `npm install` output will be changed such that total size information is
included, and displayed in different ways depending on output mode:

#### `npm install`

The default, human-readable view currently looks like this:

```
➜ npm i webpack
+ webpack@4.6.0
added 536 packages from 24 contributors in 9.299s
```

It will be changed to display size information like this:

```
➜ npm i webpack
+ webpack@4.6.0
added 536 packages (+32MB) from 24 contributors in 9.299s
```

Or when the net value is negative:

```
➜ npm rm pacote
removed 39 packages (-5MB) in 5.148s
```

Even when both additions and removals have occurred:

```
➜ npm i pacote@1
+ pacote@1.0.0
added 35 packages, removed 33 packages, updated 1 package and moved 1 package (-3MB) in 5.817s
```

#### `npm install --json`

The JSON format will add two things to each `action` record: `size` and
`unpackedSize` fields, and a `fromRequested` field that is true if a particular
action was done as a result of a changed dependency request (either a changed
value in `package.json`, or a requested package as an argument to `npm rm` or
`npm i`):

```
➜ npm i ssri --dry-run --json
{
  "added": [
    {
      "action": "add",
      "name": "ssri",
      "version": "6.0.0",
      "path": ".../node_modules/ssri",
      "size": 12116,
      "unpackedSize": 40772
    }
  ],
  "removed": [],
  "updated": [],
  "moved": [],
  "failed": [],
  "warnings": [],
  "elapsed": 535
}
```

#### `npm install --parseable`

The `--parseable` tab-delimited format will remain unchanged by default, to
prevent potentially breaking parsers. Instead, the `--long`/`-l` option will be
supported, which will add two additional columns next to each entry: the tarball
`size`, and the `unpackedSize`. It's up to users to add the numbers up
themselves.

```
➜ npm i ssri --dry-run --parseable --long

add     ssri    6.0.0   node_modules/ssri 12116 40772
```

## Rationale and Alternatives

Adding this sort of information directly to the default summary has one very
important effect: it makes it very visible and obvious when one installs a
certain package, what sort of effect that package is having. We already report
such information by printing out the number of installed dependencies, the
number of dependencies removed, and even the number of contributors involved.

This information, when printed by default, can then be a useful jumping-off
point for folks to make more conscious decisions about the size of dependencies
they're installing.

There are, of course, other alternatives (which can still be considered):

* Have the npm website itself calculate and host this information (initially without project-level awareness, but we could extend it by integrating more with projects or using uploaded metadata from newer npm versions). This would be a similar approach to [PackagePhobia](https://packagephobia.now.sh) or [BundlePhobia](https://bundlephobia.com) -- and [bundle.run](https://bundle.run/) for running the actual bundling.
* Create a separate command to do this analysis. If we do this _instead_ of the current proposal, we'd lose the "default information" part, and rely on discoverability to show this information to users. I think this would make the feature much less useful. [`cost-of-modules`](https://npm.im/cost-of-modules) seems to serve this purpose.
* The biggest drawback of this proposal, though, in my opinion, is that it does not specifically give _bundle size information_. While I don't think there's any way to come up with exact bundle size information without running the specific bundler the user is using, with the user's specific information, on every single install, and somehow doing a size diff based on that, there may be a compromise to be had: npm might be able to detect whether a bundler is being _used_, and then spit out a pre-calculated bundle estimate (with minification and gzip).
* Another way to achieve "get the bundle size" is to have npm _finally_ officially support an `npm build`/`npm bundle` command, and provide some kind of protocol so that `npm install` can invoke this and run a diff of the final bundle size. At this point, though, it might be just as useful to have the user implement this themself. This approach can very possibly become completely impractical for some webapps, which can often take several minutes to complete the full production bundling process. It might be best to stick with ballpark estimates here for the sake of expediency.

## Implementation

This would need to patch both the npm installer (in `lib/install.js` and
`lib/install/actions/extract.js`), as well as add an extra field to the
`finalizeManifest` process in [`pacote`](https://github.com/zkat/pacote)
(`lib/finalize-manifest.js`).

This also requires some registry-side changes to support the necessary metadata.

### npm registry changes

The registry packuments (both the fullfat and the corgidocs) need to have
`dist.unpackedSize` and `dist.size` calculated and backfilled for all existing
packages. This will ensure that `npm install --dry-run` can be used to do this
kind of estimation.

### npm installer changes

There are two changes to be made to the installer:

On the reporting side, update the three reporters (`printInstalledForHuman`,
`printInstalledForParseable`, and `printInstalledForJSON`) in `lib/install.js`.
You should be able to check `_size` and `_unpackedSize` in the `child.package`
value, which holds the manifest for each installed package. Note: if **any** of
the packages in the calculation are missing the `_unpackedSize` value and the
current reporter is `printInstalledForHuman`, this file size summary should be
omitted altogether. This case will happen for legacy registries when using `npm
install --dry-run` -- it will otherwise be calculated from actual extracted
size.

On the extract side, you will need to check if the `child.package._size` and
`child.package._unpackedSize` properties exist. If they do not, you should set
them based on metadata returned by `pacote.extract()`.

### `pacote` changes

`pacote` needs to do two things to support this:

* `lib/finalize-manifest.js` should be modified to get the compressed and uncompressed tarball size from package manifests, _but only if they are available_. They should be assigned to `_size` and `_unpackedSize` respectively, and are present in the `dist.size` and `dist.unpackedSize` properties of the manifest.

* `extract.js` and `tarball.js` should have their functions modified such that they return or emit size and unpackedSize as part of the metadata, where appropriate, after the operation has completed. This should be calculated from the actual data getting extracted (and may require changes to `lib/extract-stream.js` as well as `lib/with-tarball-stream.js`.

## Prior Art

* [packagephobia.now.sh](https://packagephobia.now.sh/) -- service-based, allows pretty fast searches, but gives numbers centered more around node-side dependencies than bundle sizes -- so getting an idea about compression is impossible, and furthermore, the sizes are wildly inaccurate for a particular project because it doesn't take into account per-project deduplication. It only calculates this flattening at the level of the dependency itself. I do not believe this style of tool serves our purposes.
* [`yarn why`](https://yarnpkg.com/en/docs/cli/why) -- this does give some level of this information, but it's not quite prepared in a way that's useful for estimating the specific impact of the package on a bundle. Furthermore, the command seems fairly broken and inaccurate as of 1.6.0 (???), so there might be something strange about how it calculates things. A nice thing about this command is that it can be used after installation to start hunting down disk-hungry packages, which is a workflow this proposal does not account for.

## Unresolved Questions and Bikeshedding

This proposal establishes a workflow centered around `npm install`, and expects
users to use `npm install --dry-run` if their intention is to evaluate
individual alternatives to their package. It does not present a single interface
for comparing several packages at the same time. This could perhaps be added as
a separate command. Maybe something like `npm maybe <pkg> <pkg> <pkg>`?

Another aspect of this is that this change does not make it easier to track down
_existing_ packages for potential bloat. It would be useful to have something
like `yarn why` to do this kind of project spelunking.

A potential gotcha of this approach is also that when installing dependencies of
one type, the overlap with the other dependency type will make the numbers less
useful for folks trying to determine specifically what, say, production
dependencies are costing. For example, if a devDependency is installed with a
transitive dependency `B`, and _then_ a regular production dependency is
installed that has that same transitive `B` dependency, the second install
operation won't report `B`'s size -- even though `B` was just introduced as a
production dependency. It might be worthwhile to add a check that adds
transitive dependencies to the calculation when they've gone from devDep ->
prodDep (the inverse does not seem that useful).

The npm website may end up wanting to support some or all of this, but that's
separate from the CLI itself (which is what this proposal is for).
