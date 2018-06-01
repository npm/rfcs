# Creating a npm audit xml report

## Summary

It should be possibile to execute `npm audit --owasp` and getting an OWASP Dependency Check XML.

## Motivation

Because nsp has been acquired by npm, Inc. and `npm audit` is more less a replacement for this https://www.npmjs.com/package/nsp project, the owasp nsp reporter (https://www.npmjs.com/package/@ninjaneers/nsp-reporter-owasp) is also dead.
Instead of relying on 2 "dead" projects for generating an owasp, npm should give a possibility to generate a owasp report.
So we have good foundation for displaying vulnerabilities in SonarQube.

## Detailed Explanation

Add a possibility to create an OWASP Dependency Check XML (https://www.owasp.org/index.php/OWASP_Dependency_Check) to reuse this xml for SonarQube with this plugin https://github.com/stevespringett/dependency-check-sonar-plugin.
This should be done by executing `npm audit --owasp`.

## Rationale and Alternatives

Instead of implementing an OWASP Dependency Check XML generation it should be possbile to add support for custom audit reporters. So third party reporters can do this job.

A tool that can process the json format report from `npm audit --json`. That's a valid alternative but why has `npm audit` a json representation and not owasp report for a direct use in a security plugin?

## Implementation

`npm audit --json` is already creating a json report for dependencies. So it should be possible to use a xml generator with this XML Schema Definition https://jeremylong.github.io/DependencyCheck/dependency-check.1.7.xsd instead of using a json generator.

A new file named owasp.js should be created in https://github.com/npm/npm-audit-report/blob/latest/reporters/ and this could use a xml builder like `var builder = require('xmlbuilder');`

## Unresolved Questions and Bikeshedding

none
