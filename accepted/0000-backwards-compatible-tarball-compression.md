# Improving tarball compression while maintaining backwards compatibility

## Summary

At publish time, improve compression of tarballs. Do this in a backward-compatible way, using [Zopfli][zopfli].

## Motivation

The goal of this proposal is to improve compression of npm packages while limiting usability disruption. I believe this can be implemented in a way that is transparent to package maintainers, users, and registries.

For developers, this could speed up installations, lower bandwidth usage, improve reliability on spotty connections, and leave more room on the hard drive. Registries and mirrors would also benefit; reduced resources likely means lower costs.

I compressed the latest version of several popular packages using my proposed method. Here are the size savings:

| Package | Original size   | Compressed size | Savings             |
| ------- | --------------- | --------------- | ------------------- |
| lodash  | 318,961 bytes   | 300,307 bytes   | 18,654 bytes (~6%)  |
| express | 55,756 bytes    | 53,157 bytes    | 2599 bytes (~5%)    |
| react   | 81,166 bytes    | 77,147 bytes    | 4019 bytes (~5%)    |
| mocha   | 47,9952 bytes   | 454,189 bytes   | 25,763 bytes (~5%)  |
| npm     | 2,456,743 bytes | 2,343,491 bytes | 113,252 bytes (~5%) |

Even a small savings, like 5%, would reduce the registry's bandwidth usage by multiple terabytes. For example: React [was downloaded 561,743,096 times in 2021](https://npm-stat.com/charts.html?package=react&from=2021-01-01&to=2021-12-31). If we assume that each of these downloads shrunk from 81,166 bytes to 77,147 bytes, the registry would have saved more than 2 terabytes in bandwidth for React alone.

## Detailed Explanation

npm packages are distributed as compressed archives; specifically, gzipped tarballs, compressed with zlib. Improvements to the compression of these archives would lessen bandwidth and storage used. However, many compression improvements are backwards-incompatible. For example, npm could start compressing packages with [zstd][], but existing clients would need to be updated.

[Zopfli][zopfli] is a library that can compress data in a gzip-compatible format. In other words, data gzipped with Zopfli can be decompressed "as normal". It generally improves compression over zlib but takes longer.

When running `npm pack` or `npm publish`, the resulting tarball would be compressed with Zopfli instead of gzip. This would take longer at publish time, but the resulting file would be smaller.

## Rationale and Alternatives

1. Use Brotli archives instead. Node 10+ supports Brotli natively, and things might work with minimal disruption.
1. Perform this compression on the server, compressing existing packages. This would save much more bandwidth, but could disrupt developers' local caches and integrity checksums.
1. Perform this compression on the server at package submission time, for new packages. This would mean that package authors would submit a tarball that would be modified by the server, which could wrinkle some feathers. It might also introduce a delay between package publishing and availability, while clients wait for the server to finish compression. But it would require no changes to the CLI, or other third-party clients.
1. Perform backwards-incompatible compression, and use content negotiation for newer clients.
1. Use, or build, an alternative to Zopfli that even further improves compression.

## Implementation

At a high level, tarball creation is currently one step in the CLI: [run it through `tar` with the `gzip` option][current].

This proposes that this happens in two steps:

1. Create the tarball with no compression.
2. Compress the tarball with Zopfli.

I expect the first step to be straightforward: call `tar` without compression.

The second step could be implemented in a variety of ways. For example, we could use [Zopfli compiled to WebAssembly][wasm]. Each of these options has pros and cons.

As a proof of concept, here's a snippet of Bash code that re-compresses `express` with Zopfli:

```sh
# Download the Express tarball
npm pack express@4.18.1

# Get the original size
du -b express-4.18.1.tgz

# Extract and re-compress the tarball with 1000 Zopfli iterations
gunzip express-4.18.1.tgz
zopfli --gzip -i1000 express-4.18.1.tar

# Get the new file size
du -b express-4.18.1.tar.gz
```

To further test this proposal, I have published two packages this way ([nocache][] and [humanize-duration][]) and both seem to be working well after thousands of downloads.

## Prior Art

- npm [sorts its tarballs](https://github.com/npm/npm-packlist/pull/33) to improve compression
- Cargo is [discussing compression improvements](https://github.com/rust-lang/cargo/issues/2526). The implementation is fairly different, but it suggests that improved compression is a worthwhile discussion

## Unresolved Questions and Bikeshedding

The main question I posed above: how should we invoke Zopfli? Should we use the C API or a WebAssembly version, or something else? How do we pick a trustworthy package?

Some other questions:

- What testing should be done to ensure this doesn't break anything?
- How should the CLI behave if Zopfli compression fails? Could the CLI fall back to using "regular" gzip?
- How many iterations should be used? A smaller number would compress more quickly, but the file will likely be larger.
- Are there other novel compressions to perform? For example, could `package.json` be minified before publishing?
- Should this be done in "userland" by packages like [np][], rather than the official CLI?

[zopfli]: https://github.com/google/zopfli
[gzip9]: https://github.com/npm/pacote/blob/35db9561f1d7472bf473f7f9451b670350b3acfd/lib/util/tar-create-options.js#L7-L13
[zstd]: https://facebook.github.io/zstd/
[pacote]: https://github.com/npm/pacote
[current]: https://github.com/npm/cli/blob/d60cfbcb43745705fd418fc2a7b8b427c6611911/node_modules/pacote/lib/dir.js#L70-L74
[nocache]: https://npm.im/nocache
[humanize-duration]: https://npm.im/humanize-duration
[wasm]: https://www.npmjs.com/package/@gfx/zopfli
[np]: https://npm.im/np
