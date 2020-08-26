# Remove --depth from npm outdated

## Summary

Remove `--depth` in favor of a new option flag named `--all` that shows _all_ outdated packages in the tree.

## Motivation ("The Why")
Currently on npm v6 `npm outdated` has an optional depth flag to configure the maximum depth for checking outdated packages on the dependency tree. As it is right now, it takes an _integer_ value that represents the amount of nested levels deep it goes.

In practice, what most users care about is `--depth 9999` which should display a list of _all_ outdated dependencies on the tree. Also, npm v7 has already recently removed the `--depth` flag from `npm update` in favor of updating all nodes in the tree at every depth, which defeats the purpose of having the functionality to inspect outdated packages at specific depths if they are all going to be updated either way.

Removing `--depth` and adding a flag named `--all` aligns with the future plans for v7. Considering npm flags are global and apply to all commands, `--all` could be used not only on `npm outdated` but also in other commands such as `npm ls` in the context of "show all dependencies".

## Detailed Explanation
Going any level deep further than the top-level deps opens a complex scenario where a single dependency might need different versions to satisfy requirements from different packages depending on it. Basically, what this means is that the "wanted" version of a nested dependency could be either a  _single_ semver range or a _set_ of semver ranges. 

When `--depth` is used on v6, the same dependency and its "wanted" value will be displayed and repeated on console with their location as the sole way of differentiating its level of nesting in the logical tree. This current output can tend to clog the console since the command doesn't tell appart deduped dependencies and we end up with a lot of noise that could be summarized differently.

Ex.
```
➜  arborist git:(master) npm outdated --depth 9999 tar
Package  Current  Wanted  Latest  Location
tar       4.4.13  4.4.13   6.0.2  @npmcli/arborist > @npmcli/run-script > node-gyp
tar        6.0.1   6.0.2   6.0.2  @npmcli/arborist > pacote > cacache
tar        6.0.1   6.0.2   6.0.2  @npmcli/arborist > pacote > npm-registry-fetch > make-fetch-happen > cacache
tar        6.0.1   6.0.2   6.0.2  @npmcli/arborist > pacote

➜  arborist git:(master) npm ls tar
@npmcli/arborist@0.0.0-pre.11 /Users/claudiahdz/npm/arborist
├─┬ @npmcli/run-script@1.2.1
│ └─┬ node-gyp@6.1.0
│   └── tar@4.4.13
└─┬ pacote@11.1.0
  ├─┬ cacache@15.0.0
  │ └── tar@6.0.1  deduped
  └── tar@6.0.1
```

In this example, we only care about two versions of `tar`, `4.4.13` and `6.0.2`. Instead we are shown 4 lines of output.

Moreover, npm v6 currently has inconsistent behavior. Doing `npm outdated --depth 9999` displays all outdated packages that are direct children of the current node on the physical tree, missing out dependencies that are nested at other levels. This gives a wrong impression since we are not really displaying _all_ outdated dependencies of the tree. However, doing `npm outdated foo --depth 9999`, will indeed display all appearances of `foo` on the tree no matter if they are direct children of the node or not. This is precisely the functionality that displaying all deps should have too (`npm outdated` with no flags).

Finally, dropping `--depth` in favor of `--all` that will actually display _all_ outdated packages per dependency on the tree seems clearer and more useful to the end user than the original `--depth` flag.

Ex. `npm outdated --all`

For the tree:
```
root
+-- foo@1.0.0
|   +-- bar@1.0.0
+-- bar@2.0.0
```

With these dependencies for `root`:
```
{
  "foo": "^1.0.0",
  "bar": "^2.0.0"
}
```
and for `foo`:
```
{
  "bar": "^1.0.0",
}
```

Output:
```
Package                        Current   Wanted   Latest  Location
foo                              1.0.0    1.6.0    1.6.0  node_modules/foo
bar                              1.0.0    1.5.0    2.1.0  node_modules/foo/bar
bar                              2.0.0    2.1.0    2.1.0  node_modules/bar
```

## Implementation
Using Arborist, inspecting all nodes under a given root is straight-forward using `tree.inventory`. This will simplify the current algorithm and avoid having to use recursion.b

Finally, for the sake of clarity, location will now be `node.location`.

Ex.
```
Package                   Current   Wanted   Latest  Location
@npmcli/run-script          1.2.1    1.3.1    1.3.1  node_modules/@npmcli/run-script
minify-registry-metadata    2.1.0    2.2.0    2.2.0  node_modules/minify-registry-metadata
npm-package-arg             8.0.0    8.0.1    8.0.1  node_modules/npm-package-arg
pacote                     11.1.0   11.1.7   11.1.7  node_modules/pacote
semver                      7.1.2    7.3.2    7.3.2  node_modules/semver
tap                       14.10.6  14.10.7  14.10.7  node_modules/tap
tcompare                    3.0.4    3.0.4    5.0.2  node_modules/tcompare
treeverse                   1.0.2    1.0.3    1.0.3  node_modules/treeverse
```

Instead of:
```
Package                   Current   Wanted   Latest  Location
@npmcli/run-script          1.2.1    1.3.1    1.3.1  @npmcli/arborist
minify-registry-metadata    2.1.0    2.2.0    2.2.0  @npmcli/arborist
npm-package-arg             8.0.0    8.0.1    8.0.1  @npmcli/arborist
pacote                     11.1.0   11.1.7   11.1.7  @npmcli/arborist
semver                      7.1.2    7.3.2    7.3.2  @npmcli/arborist
tap                       14.10.6  14.10.7  14.10.7  @npmcli/arborist
tcompare                    3.0.4    3.0.4    5.0.2  @npmcli/arborist
treeverse                   1.0.2    1.0.3    1.0.3  @npmcli/arborist
```

## Rationale and Alternatives
Since `npm update` will go ahead and update everything at any level, maybe there's no need to know in detail which nested dependencies are outdated and we could just show a message that certain top-level dependency has outdated deps.

We could also remove all-together the functionality if people are not paying much attention to outdated nested deps, Yarn only displays top-level outdated packages.

## Unresolved Questions and Bikeshedding
- What should we do with deduped packages?
- Are there better ways we could display packages "wanted" values?
