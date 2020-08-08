# Open source pay it forward framework

## Summary

System in which open source creators can get compensation for their work from the companies using their libraries.

## Motivation

Open source creator are poor people. They need to eat as well. A good example recently was the Hapi project which was going to stop development because maintaining the package takes too much time and not enough funds were available to make it the full time job of the maintainer. https://github.com/hapijs/hapi/issues/4111

We would like to nudge companies to compensate open source creator for their work.

Expected outcome: happier creator, better maintained packages.

### Stakeholders
* open source **consumer**: Companies using open source libraries
* **Accountants**: divy up money to creators
* **package registry**: NPM
* Open source **creators** (lodash maker, angular, react, …)

#### Consumer
* Consumer pays monthly contribution to accountants
* Chooses amount
* Link accountant that manages your open source monetary contributions
    * Through link anyone can fetch the amount the consumer contributes montly. To preserve privacy the amount returned by this call can be capped to eg: 50$. If the consumer pays more than this amount, then the call will return eg 50+.
    * This link can be provided to npm through a secure environment variable
* Flag to specify if you want npm to check commercial license compliance (1)
* Consumers can choose which accountant they want to use (lowest fee, best service, …)

#### Creator 
* Can include funding information into their package.json file of their libraries (already available)
* Can set enable flag: minimal contribution for commercial use: 2€/maand (pay it forward)
* Creators can choose to change their libraries license to the OSPIF license (see Unresolved Questions section)
* Multiple maintainers of a package handle the split of the received funds amongst themselves

#### Accountants
* Divy up the received funds and pay them to the creators
* Calculate percentage of the amount for each creator based on KPI’s (usage, effort, update frequency, number of maintainers, code quality, …)
    * Exact KPI’s can be determined by the accountant
* Takes small % of of money transfers to pay hosting (eg 1.5%)
* Can act as a proxy to npm repository to have insight in usage of packages or npm can provide api to fetch usages.

#### NPM / Yarn CLI
* Verify monthly contribution is above usage requirement specified by creator if the consumer enabled a flag (op-in) see (1)


## Detailed Explanation

* Add a flag: check-contribution-complience
    This flag will make npm check if all installed packages have their minimum montly contribution requiremenht met by the accountant link in the package.json for the maintainer.
* Provide accountant functionality to consumers so this whole system can get started.


## Rationale and Alternatives

1. Currently there is the funding property in package.json: https://docs.npmjs.com/configuring-npm/package-json.html#funding
    But this does not really give any incentive to companies to go pay the creators.
    The nice thing about the OSPIF system is that they only need to setup payment info once with the accountant, so it is less cumbersome.
    Also creators can require a contribution in the license of their package, so companies need to comply with that if they want to use the libray.
  
2. The creator can change the license to be non commercial, but this is a very restrictive. 
    If the company wants to use this library they would need to contact the creator and buy a license which creates a lot of friction. 
    By specifying the montly amount that has to flow back to the opensource community the creator makes clear what the cost is ahead of time.

3. No funding at all: This option is almost what we have now. 
    But now creators are thorn between the choice of working on the package in their free time and working to make a living. 
    This creates stress and the maintance of the packages suffers.

## Implementation

We're submitting this proposal without filling in this section just to get some feedback. Do you see anything that can be improved or caveats in our thinking. Or costs that wont be met by the current compensations.

{{Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

Somewhat similar to patreon, but lower friction since the payment info only has to be provided once and then you support all opensource creators from which you use libraries.

## Unresolved Questions and Bikeshedding

Create opensource pay it forward license OSPIF license
    This license requires users to pay a certain amount back to the open source community through the OSPIF system

Provide a spec for an accountant. 
   Initially we see npm being the registry and the accountant. 
   But this system should allow for multiple accountants. Each accountant can then use their own KPI's to divy up the money to the open source creators.

