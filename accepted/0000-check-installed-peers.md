# Add `check-installed` option to `peerDependenciesMeta`

## Summary

Currently `peerDependenciesMeta` (as far as I know) only adds the ability to basically turn off peer dependency warnings for your peer. I would like to add the ability to mark a dependency that may or not be installed (`optional` but that terminology is already used) but who's version should be checked if it is installed.

## Motivation

I have encountered several situations where a package can have optional peers depending on the use case of the package. If the peer is installed though it will be important to have the correct version. Examples include:

 * A config package that contains configs for various libraries. If the `eslint` config is used by the consuming package then the `eslint` peer needs to be installed but must be a minimum version for the config.
 * An async package that provides promise based and observable based versions of it's functions. If the PRomise based versions are used `rxjs` is not required. If the observable versions are used then the `rxjs` peer should be installed and the version should be within the specified range.

## Detailed Explanation

I expect that an additional config option would be added to `peerDependenciesMeta`:

```json
{
    "peerDependencies": {
        "rxjs": "^6.0.0"
    },
    "peerDependenciesMeta": {
        "rxjs": {
            "check-installed": true
        }
    }
}
```
(I am now married to the `check-installed` name but can't currently think of anything better)

If `check-installed` is specified then no warning would be printed if the peer is not installed. If it is installed warnings about incompatible versions would be printed.

## Rationale and Alternatives

 * **do not specify a peer** - Means that documentation must be relied on and if a new version of the dependency is installed that needs a different version of the peer there will be no warnings and the app will break.
 * **specify the peer normally** - means that all consumers of your package will have to install a dependency that they don't need to get rid of the peer warning
 * **specify an optional peer** - as far as I can see this is little different than the first option.

## Implementation

To be completed

## Prior Art

The only prior art I can think of is the existing `peerDependenciesMeta` configuration option that has already been discussed.

## Unresolved Questions and Bikeshedding

