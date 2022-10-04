# Dist tag spec should install the exact version

## Summary

Correct the `@npmcli/arborist` behavior when install a dist-tag specified dependency.

## Motivation

Current strategy may install the wrong version of a dependency. [PR#5599](https://github.com/npm/cli/pull/5599) is a attempt to fix this behavior. But as [@wraithgar](https://github.com/wraithgar) [pointed out in the pr](https://github.com/npm/cli/pull/5599#issuecomment-1262518986), this is a break change, and should be discussed in detail.

## Detailed Explanation

Given `package.json` below:
```json
{
  "dependencies": {
    "kewu": "1.0.0",
    "wuke": "1.0.1"
  }
}
```
The two npm package dependencies are:

1. `kewu@1.0.0` has only one dependency `wuke@stable`
2. `wuke@stable` refers to `wuke@1.0.0`

Run code below, would only install `wuke@1.0.1` into the root dir of node_modules.

```javascript
const arborist = new Arborist({
  path: process.cwd(),
})
const idealTree = await arborist.buildIdealTree({})

console.log('idealTree wuke: %s', idealTree.children.get('kewu').children.get('wuke'))
```

`@npmcli/arborist` treats `wuke@1.0.1` as the matched version of `wuke@stable`, which is wrong.

## Rationale and Alternatives


## Implementation

Check out [PR#5599](https://github.com/npm/cli/pull/5599) for the implement.


## Prior Art

## Unresolved Questions and Bikeshedding

As tested, this implement will break all previous package-lock.json when running `npm ci`, So a proper way to fix package-lock.json or to make `npm ci` run in compatible mode is needed.

### References
[PR#5599](https://github.com/npm/cli/pull/5599)
