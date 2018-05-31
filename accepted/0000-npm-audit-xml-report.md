# Creating a npm audit xml report

## Summary

It should be possibile to execute `npm audit --xml` and getting an OWASP Dependency Check XML.

## Motivation

No need to install https://www.npmjs.com/package/nsp and https://www.npmjs.com/package/@ninjaneers/nsp-reporter-owasp as a devDependency.

## Detailed Explanation

Add a possibility to create an OWASP Dependency Check XML (https://www.owasp.org/index.php/OWASP_Dependency_Check) to reuse this xml for SonarQube with this plugin https://github.com/stevespringett/dependency-check-sonar-plugin.
This should be done by executing `npm audit --xml`.

## Rationale and Alternatives

Instead of implementing an OWASP Dependency Check XML generation it should be possbile to add support for custom audit reporters. So third party reporters can do this job.

## Implementation

`npm audit --xml` has to use this XML Schema Definition https://jeremylong.github.io/DependencyCheck/dependency-check.1.7.xsd to generate vulnerable dependencies in a xml file.
This is similar to `npm audit --json`.

## Unresolved Questions and Bikeshedding

None
