# Withdrawal Amendment

- Current **npm cli** team is unlikely to implement this.
- **NOTE:** The **npm cli** team would be happy to land this change in case it comes from a community contribution, this withdrawn was based on the fact that this is not remotely closed to being in the roadmap of the current team.

## Relevant Resources

Withdrawn consensus achieved during the [Wednesday, June 16, 2021 OpenRFC meeting](https://github.com/npm/rfcs/issues/399)
- Meeting Notes: https://github.com/npm/rfcs/blob/515b8f310eb4605022c8b25849dfc9941f321885/meetings/2021-06-16.md
- Video Recording: https://youtu.be/N6cEmHKPRfo

# Creating a npm audit xml report

## Summary

It should be possible to execute `npm audit --owasp` and getting an OWASP Dependency Check XML.

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

### How to map npm audit information to OWASP Dependency Check XML?

I used `npm audit --json` to generate information and use pseudo code for illustration. Everything in round brackets have to be implemented additionally.

#### json from `npm audit --json`

```
actions
    action
    module
    target
    isMajor
    resolves
        id
        path
        dev
        optional
        bundled
advisories
    ID_VALUE
        findings
            version
            paths
            dev
            optional
            bundled
        id
        created
        updated
        deleted
        title
        found_by
            name
        reported_by
            name
        module_name
        cves
        vulnerable_versions
        patched_versions
        overview
        recommendation
        references
        access
        severity
        cwe
        metadata
            module_type
            exploitability
            affected_components
        url
muted
metadata
    vulnerabilities
        info
        low
        moderate
        high
        critical
    dependencies
    devDependencies
    optionalDependencies
    totalDependencies
runId
```

#### JSON to OWASP XML Mapping

```
analysis
    scanInfo
        engineVersion: NPM_VERSION
    projectInfo
        name: (name attribute from package.json)
        version: (version attribute from package.json)
        reportDate: (CURRENT_DATE)
        credits: (nsp or npm)
    dependencies
        dependency
            fileName: actions[i].module + '@' + actions[i].target,
            filePath: (LOCAL_FILE_PATH_TO_MAIN_JS_FROM_actions[i]-module) OR actions[i].module + '@' + actions[i].target,
            md5: (NEED ADDITIONAL INFORMATION)
            sha1: (NEED ADDITIONAL INFORMATION)
            description: (description attribute from actions[i].module package.json)
            license: (license attribute from actions[i].module package.json)
            identifiers
                identifier
                    name: actions[i].module
                    type (attribute): (nsp or npm)
            vulnerabilities
                vulnerability
                    name: actions[i].resolves[j].id => advisories[actions[i].resolves[j].id].cves[k]
                    cvssScore: (NEED ADDITIONAL INFORMATION)
                    cvssAccessVector: (NEED ADDITIONAL INFORMATION)
                    cvssAccessComplexity: LOW
                    cvssAuthenticationr: NONE
                    cvssConfidentialImpact: NONE
                    cvssIntegrityImpact: NONE
                    cvssAvailabilityImpact: PARTIAL
                    severity: actions[i].resolves[j].id => advisories[actions[i].resolves[j].id].severity
                    cwe: actions[i].resolves[j].id => advisories[actions[i].resolves[j].id].cwe
                    description: (description attribute from actions[i].resolves[j].id => advisories[actions[i].resolves[j].id] package.json) or actions[i].resolves[j].id => advisories[actions[i].resolves[j].id].overview + '||' + actions[i].resolves[j].id => advisories[actions[i].resolves[j].id].recommendation + ' vulnerable versions:'  + actions[i].resolves[j].id => advisories[actions[i].resolves[j].id].vulnerable_versions + ' patched_versions: ' + actions[i].resolves[j].id => advisories[actions[i].resolves[j].id].patched_versions
                    source (attribute): (nsp or npm)
                    references (optional)
                        reference
                            source: (NEED ADDITIONAL INFORMATION)
                            url: actions[i].resolves[j].id => advisories[actions[i].resolves[j].id].references[k].url
                            name: actions[i].resolves[j].id => advisories[actions[i].resolves[j].id].references[k].name
                    vulnerableSoftware
                        software: actions[i].resolves[j].id => advisories[actions[i].resolves[j].id].module_name '@' +  actions[i].resolves[j].id => advisories[actions[i].resolves[j].id].findings.version
            isVirtual (attribute): false
```

## Unresolved Questions and Bikeshedding

none
