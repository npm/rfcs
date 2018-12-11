# Make npm standalone

## Summary

  Use a javascript bundler (e.g. [browserify](http://browserify.org/) ) to deploy npm a standalone - single file, instead of using [bundledDependencies](https://docs.npmjs.com/files/package.json#bundleddependencies).


## Motivation

  npm is the only package in the **whole world** to use bundledDendencies, mostly because browserify/javascript packers did not exists at the time it was created.  Using bundledDependencies was an answer to a chicken-and-egg probleme back at that time.

  Updating npm itself or downloading manually would be a lot simplier if the npm package itself contains only few files (and no subdirectories).

```
/package.json
/npm-cli.js
/npm-bundle.js
/CHANGELOG
/doc/ /man/ /html/ [maybe]

(with no dependencies)
```

Also, npm.tgz beeing one the the most downloaded file on earth. This will save a lot of network bandwith and save beavers.

## Detailed Explanation

I suggest we register in `npm/package.json` a "prepare script" that'll run browserify against npm `main` script. Also, i'll suggest to start deprecating bundledDepencencies at the same time.

## Rationale and Alternatives

We can continue to deploy npm the way it is until today, using bundledDepencencies.

## Implementation

```
  "scripts" :  {
    "build-bundle": "node ./scripts/build-browserify.js",
  }
```

## Prior Art

Today, the whole bundledDepencencies "thing" was created for npm sole purpose. It's a complicated design and predate javascript bundler (i.e. browserify). [yarn](https://yarnpkg.com/en/) itself is deployed through a [webpacked](https://github.com/yarnpkg/yarn/blob/master/package.json#L115) [standalone file](https://registry.npmjs.org/yarn/-/yarn-1.12.3.tgz).


## Unresolved Questions and Bikeshedding

This will be a joint effort, as using non bundle-able modules or designs (e.g. dynamic require) in npm will be deprecated, so we need to have a consensus about this design.
