# Transition to a model where install scripts must be explicitly allowed during the install process.

## Summary

Instead of by default always running the install scripts (`preinstall`, `install`, `postinstall`, `prepublish`, `preprepare`, `prepare`, `postprepare`) if they are present during the install process, provide flags to require users to explicitly allow them to run, either whoelsale as "one big swtich", or on a package by package (and optionally version by version) basis. Also provide matching `npm config` options to do the same globally and permanently instead of on every install.

## Motivation

Install scripts that can run just about anything by default pose some pretty serious security considerations, and these are inreasingly moving out of the theoretical realm and becoming actively exploited. See for example here: https://therecord.media/malware-found-in-coa-and-rc-two-npm-packages-with-23m-weekly-downloads/.

At the same time, we have developed better techniques for many of the most common use cases for install scripts in the many years since npm originally included then. In particular, [N-API](https://nodejs.org/api/n-api.html) offers a compelling alternative to binary packages that are built on the users' computer. However, even before this, many packages are choosing to just pre-build for multiple platforms ahead of time to handle most of the common installation targets and make the install process easier on the user in general.

## Detailed Explanation

I propose the following flags and changes in behavior:

### npm install
1. By default, no scripts are run during the `npm install` lifecycle: https://docs.npmjs.com/cli/v7/using-npm/scripts#npm-install
2. The `--allow-scripts` flag is added to `npm install` which allows users to enable scripts for a specific package at a specific version, which is the only truly safe thing combination (especially given a `package-lock.json` file that is ensuring the integrity of the tarball in question):
    - `npm install --allow-scripts canvas@1.0.0`: Install the contents of `package.json`, only allowing `canvas` version 1.0.0 to run install scripts. Perhaps it should warn if no install scripts are present?
    - `npm install canvas@1.0.0 --allow-scripts canvas@1.0.0`: Installs `canvas@1.0.0` to the current `package.json`, and allows it to run install scripts. Perhaps it should warn if no install scripts are present?
    - `npm install canvas@1.0.0 --allow-scripts canvas@1.0.0 --allow-script ramda@2.0.0`: Installs `canvas@1.0.0` to the current `package.json`, and allows it to run install scripts, as well as allowing ramda@2.0.0 to run install scripts. Perhaps it should warn if no install scripts are present?
3. The `--disallow-scripts` option should also be added that does the opposite of `--allow-scripts`. This is necessary since later I will discuss global settings for allowing packages to use install scripts, and so this lets you ignore that setting if you so choose.
4. The `--allow-scripts-unsafe` option is added for more convenient, but more dangerous, handling of install scripts:
    - `npm install --allow-scripts-unsafe canvas`: Install the contents of `package.json`, allowing any version of `canvas` to run install scripts.
    - `npm install --allow-scripts-unsafe "canvas@1.0.0-2.0.0"`: Install the contents of `package.json`, allowing any version of `canvas` in the semver range 1.0.0 to 2.0.0 to run install scripts. While strictly safer than the unranged version above, it still runs the risk of new vulnerable packages being snuck in in that range. For example, if an account is compromised, and a patch version is published to every major version that is present. 
    - `npm install canvas --allow-scripts-unsafe canvas`:  Installs the latest version of canvas to the current `package.json`, and allows it to run install scripts.
    - `npm install canvas --allow-scripts-unsafe canvas --allow-unsafe-scripts ramda`:  Installs the latest version of canvas to the current `package.json`, and allows it to run install scripts for canvas and any version of ramda it encounters.

### npm config
We should add the ability to configure npm globally to allow packages to make use of scripts. This can be useful for packages you install a lot, or for packages you are working on:

1. `npm config set allow-scripts-canvas@1.0.0 true`: This will allow canvas version 1.0.0 to install scripts whenever `npm install` is used.
2. `npm config set allow-scripts-unsafe-canvas true`: This will allow any version of canvas to install scripts whenever `npm install` is used. It should also probably warn on each case.

## Rationale and Alternatives

The vast majority of packages do not use install scripts, and they provide an easy vector to immediately affect thousnads of users if you are able to take control of a package author's account. While not a perfect solution, this would dramatically reduce that capability, and is probably the correct default instead of allowing any 20-levels-deep subdependency to run any artbitrary script on your system.

## Implementation

I imagine this should hopefully not be harder than adding some if statements around the right lifecycle sections of install.

## Unresolved Questions and Bikeshedding

Two open questions for me:

1. Having npm ship with a grandfathered list of "known safe" package versions. For example, every currently shipping version of canvas. That way, for important large packages, this is a "from now on" requirement. Alternatively, there could just be a transition period where npm just warns about script, and then afterward we make it actually refuse to run them without the proper flags. 
2. I think the automatic node-gyp stuff should be under this umbrella as well. That is to say, node-gyp would only run when gypfiles are detected if the `allow-scripts` flag allows it, since you can also techncially put whatever you want in there I believe, and not doing this would simply mean that any malicious behavior would be transitioned there.
