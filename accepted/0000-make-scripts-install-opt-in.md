# Transition to a model where install scripts must be explicitly allowed during the install process.

## Summary

Instead of by default always running the install scripts (`preinstall`, `install`, `postinstall`, and auto-detected `gyp` files) if they are present during the install process, provide flags to require users to explicitly allow them to run, either whoelsale as "one big swtich", or on a package by package (and optionally version by version) basis. Also provide matching `npm config` options to do the same globally and permanently instead of on every install.


## Motivation

Install scripts that can run just about anything by default pose some pretty serious security considerations, and these are inreasingly moving out of the theoretical realm and becoming actively exploited. See for example here: https://therecord.media/malware-found-in-coa-and-rc-two-npm-packages-with-23m-weekly-downloads/.

At the same time, we have developed better techniques for many of the most common use cases for install scripts in the many years since npm originally included then. In particular, [N-API](https://nodejs.org/api/n-api.html) offers a compelling alternative to binary packages that are built on the users' computer. However, even before this, many packages are choosing to just pre-build for multiple platforms ahead of time to handle most of the common installation targets and make the install process easier on the user in general.

From our calculations, only around 0.6% of packages on npm currently use this feature (see table below), meaning it should hopefully both be possible to transition many of these packages away from relying on script, while simultaneously making this transition as frictionless as possible for users.

|     | Count | Percentage |
| --- | --- | --- |
| Packages with preinstall script | 1,660 | 0.08% |
| Packages with install script | 2,077 | 0.1% |
| Packages with postinstall script | 6,989| 0.35% |
| Packages with gyp | 2,744 | 0.14% |
| Total Packages on npm | 1,996,434 | 100% |
| **Total Packages with scripts on npm** | 12,035 | **0.6%** |

## What Makes Install Scripts Special vs. Other Security Issues?

It's easy to dismiss the issue with install scripts due to the expectation that you will be running the code you download from npm anyways, but as it turns out this isn't necessarily the case, and the threat vector is considerably more subtle. Outlined below are a number of scenarios to consider that show how install scripts do in fact represent a separate security threat:


1. If you are using npm for purely frontend work, install scripts open up a completely unnecessary attack surface. It might be easy to forget here in node land, but many teams that use completely different languages for their backend work only fall precisely in this category. It doesn't make sense to be exposing Ruby or Python devs to install scripts, when otherwise the code they'd install would never run on their own systems and be confined completely to the browser sandbox.

2. Install scripts may run under different privileges than the node apps run in. Do a search for "--unsafe-perm" and you'll see that for better or worse this is a suggested "fix all" for various npm install woes, which thus exacerbates this problem.

3. Install scripts run in different environments than node apps. As mentioned above, install scripts may be uniquely positioned to be the only attack vector on build machines, that otherwise wouldn't run code at all (some companies for example separate build machines and CI machines, etc.) This is made worse by the fact that it is not uncommon to have builds and CI take place automatically in response to a pull request, and thus all it takes to infect the machine is issuing a pull request with the package.

4. Install scripts allow for "typo squatting" where you can register names close to popular packages such that if you accidentally type "npm install canvsa" the install script immediately kicks off before you can even realize and hit ctrl-c and its already spawned a process to start doing something malicious.

5. There is also the fact that install scripts can be easier to introduce precisely because its not code that needs to be imported and run to attack. As such, it is possible to sneak a package into the package-lock.json as part of a larger change, since github will often automatically hide package-lock diffs, and no one really takes the time to read them since they're not really meant to be human-readable. Compare this with was malicious code that needs to be run, where you have a higher chance of noticing it in a diff since the actual code is where people usually pay attention when reviewing code and they'd ask "why are we importing this library we didn't need before?". Again, it doesn't make it impossible, it's just much easier with scripts.

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

1. Having npm ship with a legacy list of "known safe" package versions. For example, every currently shipping version of canvas. That way, for important large packages, this is a "from now on" requirement. Alternatively, there could just be a transition period where npm just warns about script, and then afterward we make it actually refuse to run them without the proper flags.
2. I think the automatic node-gyp stuff should be under this umbrella as well. That is to say, node-gyp would only run when gypfiles are detected if the `allow-scripts` flag allows it, since you can also techncially put whatever you want in there I believe, and not doing this would simply mean that any malicious behavior would be transitioned there.
