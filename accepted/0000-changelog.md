# Changelog

## Summary

This RFC introduces a `"changelog"` field in `package.json` and a `changes` command in `npm`.

## Motivation

The location where a project documents changes varies to an extreme extent, for every single package you want to upgrade you have to hunt this down separately. Depending on the package the changelog can be: a CHANGELOG.md file on GitHub, HISTORY.md file on GitHub, a releases page on the project's website, the releases page on GitHub if the project documents releases there, a section at the bottom of the README, the commits list on whatever vcs hosting the project uses if the project doesn't maintain a changelog, or something else. You have to hunt for this location every time you want to update your dependencies and do it individually for each package you want to update.

There are also multiple 3rd party commands for doing interactive upgrades (`npm-check`, `yarn outdated`, `yarn upgrade-interactive`) which list the package's homepage when listing a package that has changes. These commands would be much more useful if they were able to list a changelog url instead of a homepage url. Then the url for the package you see while picking packages to upgrade can be a link directly to the page that tells you what has changed in between your version of the package and the newer version(s).

If you are not using these commands it is still highly beneficial to be able to check the changelog of packages by opening it with a `npm changes` command.

For this reason I firmly believe it would be beneficial to the ecosystem if packages were to document what the link to their current changelog the way they document the link to their homepage and documentation.

## Detailed Explanation

`package.json` will have a new `"changelog"` field. This field expects a URL like the url used in `"homepage"`. A package is expected to point this field to the public url wherever they maintain the most recent version of their changelog.

`npm` will have a new `changes` command. When run this command functions similar to `npm docs`. It accepts a list of package names and when executed will open a url in the browser. The url opened in the browser will come from the `"changelog"` field in the package's `package.json` instead of the `"homepage"` field. If the package does not define a `"changelog"` the command will open the same url `npm docs` would for the package.

`npm info` should probably also return the value of the changelog field as it does for `homepage`, `bugs`, and `repository`.

## Rationale and Alternatives

It was considered whether the 3rd party tools like `npm-check` could just start handling the `changelog` field without documentation. However unless this is documented as part of `package.json` it is very unlikely that the `changelog` field will gain widespread use. And without widespread use of the field we will not actually solve the issue of finding changelogs for each package you are updating.

Automatic detection could also be a possibility. Looking for CHANGELOG* and HISTORY* files in the repo on GitHub, checking for whether text is used in the Releases tab. However this kind of detection won't find changelogs hosted on project websites and the urls for non-GitHub repo sources (BitBucket, GitLab, etc) if npm doesn't add handling for each one individually. And ultimately the location of the changelog should be up to the package to define.

## Implementation

The documentation for `package.json` will need to be updated to document the `changelog` field.

Implementation of the `changes` will likely be very simple.

- The majority of the implementation will just be a duplication of the code used in `npm docs`: https://github.com/npm/npm/blob/latest/lib/docs.js
- The primary difference will be the adding of handling for the `"changelog"` field:

  ```js
  var url = d.changelog
  if (!url) url = d.homepage
  if (!url) url = 'https://www.npmjs.org/package/' + d.name
  ```
- The code responsible for `npm info` https://github.com/npm/npm/blob/master/lib/view.js will need updating to output the changelog field.
  This may be as simple as `changelog: manifest.changelog` or `changelog: manifest.changelog && (manifest.changelog.url || manifest.changelog)` being added to the `const info = {...}` in `prettyView`.
  As well as a log statement after the log statement for `site`.

## Unresolved Questions and Bikeshedding

- `changelog` or `changes`? Which should the package.json field use? And which should the command use?
- Should `npm init` ask for a changelog url?
