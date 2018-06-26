# Custom devDependencies

## Summary

I would like to define different sets of devDependencies, so I can install different sets of dependencies for different types of builds (unit testing / e2e / production). Aside from 
dependencies and devDependencies you would be able to define a custom set of packages to install for development. 

## Motivation

I want to build two different test containers, one for Karma, one for Cypress. I am installing Cypress now when I install my devDependencies, even if 
I want to do Karma tests. Cypress takes a long time to install, so it's really increasing my build times. Maybe I could create different versions of 
my package.json and copy the correct one, but that seems prone to errors. 

## Detailed Explanation

package.json can have multiple dependencies:

```
{
	"version": "0.0.0",
	"license": "MIT",
	"angular-cli": {},
	"scripts": {
		// scripts
	},
	"private": true,
	"dependencies": {
		"default": {
			"some-packages": "^0.0.1"
		},
		"dev": {
			"@angular/cli": "^6.0.5"
		},
		"cypress": {
			"cypress": "^3.0.1"
		}
		"karma": {
			"jasmine-core": "^2.99.0",
			"other-unit-test-packages": "^2.99.0",
		}
	}
}
```

There can be an argument in the npm install command to install different sets of devDependencies, where devDependencies itself would be default:

- `npm install` will install default and dev dependencies
- `npm install --prod` will install default packages only
- `npm install --dependencies=cypress` would install default, dev and Cypress packages
- `npm install --prod --dependencies would install default and Cypress packages
- `npm install --dependencies=karma` would install default, dev and karma packages (so not the wonderful but bulky Cypress packages)

## Rationale and Alternatives

- Different package.json files for each configuration, so in this case package.json, package.cypress.json and package.karma.json. Npm would have to install packages in each of those
file or the developer would have to do this manually. Also, there has to be an argument for `npm install` in which you can define which package.json you would like to use, or the developer can manually rename files. 
- Just accept those build times.
- Use another testing tool that's not bulky. (I tried the normal way to test Angular. It's hell on earth)

## Implementation

{{Give a high-level overview of implementaion requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

{{This section is optional if there are no actual prior examples in other tools}}

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
