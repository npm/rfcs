# Add `funding` support to `package.json`

## Summary

This RFC identifies an initial means of tooling to describe & notify consumers of a package's monetary support information. `npm` has been [vocal about our commitment](https://blog.npmjs.org/post/187382017885/supporting-open-source-maintainers) to providing a means for package maintainers to more sustainably support their work & this reflects an initial step toward that goal. 

## Motivation

Package maintainers want to clearly indentify how their software is currently, or could be in the future, supported monetarily.

## Detailed Explanation

* See [Prior Art](#prior-art)
* Provide a means to **reference** existing funding opportunities in `package.json`
* Provide a means to **define the type** of funding opportunities in `package.json`
* Provide a means to **notify** package consumers of funding opportunites with the cli
* Provide a means to **view** dependency's funding opportunites with the cli
* Provide a means to **view** a package's funding opportunites

##  Rationale & Alternatives
* **Rationale:** 
  * This is a straightforward and easily implemented solution to take the first step toward supporting Open Source Package Maintainence sustainability
  * Building this functionality into the package management layer is the only reliable way to push funding notifications to the vast majority of developers who already use npm
* **Alternatives:** 
  * Continue to rely on third-party, opt-in, tools & platforms that only support a fraction of the desired audience
  * Continue debating a larger, more complex schema /w correspondingly more complex tooling

## Implementation

* Add a `funding` field to `package.json`
  * supports a string or an object with a specified `type` & `url` field
  * `url` is required for `npm fund` to execute
  * `type` is an optional field that can be inferred by the `url`
  * Note: if `funding` is defined as a string, that value will be mapped to `url` & a `type` may be inferred
  * Note: it is not advised to add arbitrary key/values to `funding` as additional fields may be added in the future 
* Add notification at the end of output of package installation that references the number of packages with `funding` defined 
  * ex. `23 packages are looking for funding. Run "npm fund" to find out more.`
* Add `--no-fund` flag to opt-out of the funding notification when installing
* Add `npm fund <pkg>` subcommand: 
  * if a package is specified, npm will attempt to open the `url` defined in `funding` using the `--browser` config param (similar to `npm repo <pkg>`)
  * if no package is specified, `npm` will print out a tree of all the `funding` references defined in the current project's installed dependencies
* Add a visual representation & link for the `funding` `type` & `url` fields of a package on `npmjs.com`

**Examples of `funding` usage in `package.json`:**
```
{
  ...
  "funding": {
    "type": "patreon",
    "url": "https://www.patreon.com/my-account"
  },
  ...
}
```
```
{
  ...
  "funding": {
    "type": "foundation",
    "url": "https://openjsf.org/"
  },
  ...
}
```
```
{
  ...
  "funding": {
    "type": "corporation",
    "url": "https://microsoft.com/"
  },
  ...
}
```

**Example of `npm fund <pkg>`:**
```
$ npm fund example-package 
# opens a browser with correpsonding `url` value: https://www.patreon.com/example-package 
```
```
$ npm fund 
└─ example-dependency@1.0.0
   ├─ type: patreon 
   └─ url: https://www.patreon.com/example-dependency
└─ example-dependency-two@1.0.0
   ├─ type: opencollective
   └─ url: https://opencollective.com/example-dependency-two
└─ example-dependency-three@1.0.0, example-dependency-four@1.0.0, example-dependency-five@1.0.0
   ├─ type: individual
   └─ url: https://sindresorhus.com/donate
```

## Prior Art

* [Open Collective](https://github.com/opencollective/opencollective)
* [GitHub Sponsors](https://github.com/sponsors)
* [License Zero](https://licensezero.com/)
* [GitCoin](https://gitcoin.co/products)
* [Feross: `thanks`](https://github.com/feross/thanks)
* [Feross: `funding`](https://github.com/feross/funding)
* [Indieweb: payment](https://indieweb.org/payment)
* [microformats: `rel-payment`](http://microformats.org/wiki/rel-payment)
* [Shields.io: Funding](https://shields.io/category/funding)
* [ThanksApp: Donate Spec](https://github.com/ThanksApp/donate-spec)
* [Bevry: `sponsored`](https://github.com/bevry-archive/sponsored)
* [OGAG: `civic.json`](http://open.dc.gov/civic.json/)

#### Other Work & Conversations

1. <i id="r1"></i>[PM WG: "Document support levels" Draft](https://github.com/nodejs/package-maintenance/blob/master/docs/drafts/PACKAGE-SUPPORT.md)
2. <i id="r2"></i>[PM WG: "Document support levels" Blog post to announce](https://github.com/nodejs/package-maintenance/issues/228)
3. <i id="r3"></i>[PM WG: "Document support levels" Blog post to validate](https://github.com/nodejs/package-maintenance/issues/244)
4. <i id="r4"></i>[PM WG: `support` field `license` Issue](https://github.com/nodejs/package-maintenance/issues/218)
5. <i id="r5"></i>[PM WG: "Future direction of `support` field" Issue](https://github.com/nodejs/package-maintenance/issues/241)
6. <i id="r6"></i>[npm: `sustainability` PR](https://github.com/npm/cli/pull/187)
7. <i id="r7"></i>[npm: `support` PR](https://github.com/npm/cli/pull/246)
8. <i id="r8"></i>[`thanks`: "Read URL from `package.json`" Issue](https://github.com/feross/thanks/issues/2)
9. <i id="r9"></i>[`funding`: "Collaborate with the PM WG" Issue](https://github.com/feross/funding/issues/15)
10. <i id="r10"></i>[Differences between: "author", "contributors", "maintainers" & "owner"](https://github.com/npm/www/issues/133#issuecomment-284906561)
