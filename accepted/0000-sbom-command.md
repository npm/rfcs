# SBOM Generation for npm Projects

## Summary

Update the npm CLI with a new command which will generate a Software Bill of Materials (SBOM) containing an inventory of the current project's dependencies. Users will have the option to generate an SBOM conforming to either the [Software Package Data Exchange (SPDX](https://spdx.github.io/spdx-spec/v2.3/)) or [CycloneDX](https://cyclonedx.org/specification/overview/) specifications.


## Motivation

Finding and remediating vulnerabilities in open source projects is a critical component of securing the software supply chain. However, this requires that enterprises understand what OSS components are used across their infrastructure and applications. When new vulnerabilities are discovered, they need a complete inventory of their software assets in order to properly assess their exposure. Knowing about the critical [Log4j](https://www.cisa.gov/news-events/cybersecurity-advisories/aa21-356a#main) vulnerability doesn’t do you any good unless you can also pinpoint where in your organization you’re running the vulnerable code.

SBOMs help to solve this problem by providing a standardized way to document the components that comprise a software application. A proper SBOM should tell you exactly which packages you have deployed and which versions of those packages you are using.

Beyond the security benefit there may be a regulatory requirement to provide SBOMs in some sectors. In response to some recent, high-visibility attacks, The White House has issued an [Executive Order](https://www.whitehouse.gov/briefing-room/presidential-actions/2021/05/12/executive-order-on-improving-the-nations-cybersecurity/) which specifically includes directives which would make SBOMs a requirement for any vendor selling to the federal government.

Adding SBOM generation to the tool which many developers are already using to manage their project dependencies eliminates any friction which may come from having to adopt/learn a separate tool. 


## Detailed Explanation

A new `sbom` command will be added to the npm CLI which will generate an SBOM for the current project. The SBOM will use the current project as the root and enumerate all of its dependencies (similar to the way `npm-ls` does) in one of the two supported SBOM formats. See the 
[Example SBOMs](#example-sboms) section for sample CycloneDX and SPDX SBOM documents.

Supported command options: 

`--sbom-format` - SBOM format to use for output. Valid values are “spdx” or “cyclonedx”. In the future, the set of valid values can be expanded to select differents versions of the supported output formats (e.g. "cyclonedx1.4" vs "cyclonedx1.5")

`--omit` - Dependency types to omit from generated SBOM. Valid values are “dev”, “optional”, and “peer” (can be set multiple times). By default, all development, optional, and peer dependencies will be included in the generated SBOM unless explicitly excluded.

`--package-lock-only` - Constructs the SBOM based on the tree described by the _package-lock.json_, rather than the contents of _node_modules_. Defaults to _false_. If the _node_modules_ folder is not present, this flag will be required in order to generate an SBOM.
 
`--workspace` - When used with a project utilizing [workspaces](https://docs.npmjs.com/cli/v9/using-npm/workspaces), generates an SBOM containing only the identified workspaces (the flag can be specified multiple times to capture multiple workspaces). The SBOM will be rooted in the base directory of the project but will only include the specified child workspace(s).

`--workspaces` - When used with a project utilizing [workspaces](https://docs.npmjs.com/cli/v9/using-npm/workspaces), generates an SBOM that includes ONLY the project's child workspaces. Any dependencies which are associated exclusively with the root project will be omitted.

If the user runs the `sbom` command without first installing the dependencies for the project (i.e. there is no _node_modules_ folder present) an error will be displayed. An SBOM can be generated solely based on the contents of the _package-lock.json_ but requires the user to explicitly specify the `--package-lock-only` flag.

Initially, we'll support the most widely used versions of the SPDX and CycloneDX specifications (likely v2.3 for SPDX and v1.4 for CycloneDX). Best effort will be made to support new versions as they gain adoption across the ecosystem.


## Rationale and Alternatives

There are a few existing tools which can be used to generate an SBOM from an npm project:

* <code>[@cyclonedex/cyclonedx-npm](https://www.npmjs.com/package/@cyclonedx/cyclonedx-npm)</code> - A CLI for generating a CycloneDX-style SBOM from an npm project. This project is written in TypeScript and actually invokes <code>npm-ls</code> in order to get dependency information for the project.
* <code>[spdx-sbom-generator](https://github.com/opensbom-generator/spdx-sbom-generator)</code> - A CLI for generating SPDX-style SBOMs for a number of different package managers (including npm). Currently, this tool only works with npm projects using <em>lockfileVersion</em> 1 so it’s not viable for a large number of projects (current <em>lockfileVersion</em> is 3)

While you can effectively generate the same output we’re proposing with this combination of tools, there is value in having this capability supported directly in npm. Beyond the obvious developer-experience benefit of having SBOM generation baked-in to the CLI, it gives us a future path to do things like automatic-signing of SBOMs or integration of SBOMs into the package publishing process.


## Implementation

The `npm-sbom` command is similar in function to `npm-ls` command and will likely utilize a similar implementation. We’ll use <code>[arborist](https://github.com/npm/cli/tree/latest/workspaces/arborist)</code> to construct the dependency tree and the <code>[treeverse](https://github.com/isaacs/treeverse)</code> library to traverse the tree and assemble the SBOM.


### Local (Linked) Dependencies

The generated SBOM will exclude any dependencies which are referenced via links on the local file system. A warning will be displayed for any linked dependency informing the user that it was omitted from the SBOM.


### Format Details 

Both of the SBOM formats present a flat list of dependencies (CycloneDX groups these under a key named `components` while SPDX groups them under a key named `packages`). The following sections describe how a dependency will be presented for the different SBOM formats.


#### CycloneDX

```json
{
  "type": "library",
  "name": "debug",
  "version": "4.3.4",
  "bom-ref": "debug@4.3.4",
  "purl": "pkg:npm/debug@4.3.4",
  "scope": "required",
  "externalReferences": [
    {
      "type": "distribution",
      "url": "https://registry.npmjs.org/debug/-/debug-4.3.4.tgz"
    }
  ],
  "properties": [
    {
      "name": "cdx:npm:package:path",
      "value": "node_modules/debug"
    }
  ],
  "hashes": [
    {
      "alg": "SHA-512",
      "content": "3d15851ee494dde0ed4093ef9cd63b..."
    }
  ]
}
```

The <code>[properties](https://cyclonedx.org/docs/1.4/json/#components_items_properties)</code> collection also provides for a standard property under the [npm taxonomy](https://github.com/CycloneDX/cyclonedx-property-taxonomy/blob/main/cdx/npm.md) for annotating development dependencies. For any package which was determined to be a development dependency of the root project, we would add the following to the <code>properties</code> collection: 

```json
{
  "name": "cdx:npm:package:development",
  "value": "true"
}
```

Similarly, there are named properties defined for identifying things like "bundled", "private", and "extraneous" dependencies. Dependencies will be annotated with this properties as appropriate.

The CycloneDX specification also provides [fields](https://cyclonedx.org/docs/1.4/json/#components) for capturing other package metadata like author, license, website, etc. Not all packages provide this information, but these fields will be populated when the information is available.

#### SPDX

```json
{
  "name": "debug",
  "SPDXID": "SPDXRef-Package-debug-4.3.4",
  "versionInfo": "4.3.4",
  "downloadLocation": "https://registry.npmjs.org/debug/-/debug-4.3.4.tgz",
  "filesAnalyzed": false,
  "externalRefs": [
    {
      "referenceCategory": "PACKAGE-MANAGER",
      "referernceType": "npm",
      "referenceLocator": "debug@4.3.4"
    },
    {
      "referenceCategory": "PACKAGE-MANAGER",
      "referernceType": "purl",
      "referenceLocator": "pkg:npm/debug@4.3.4"
    }
  ],
  "checksums": [
    {
      "algorithm": "SHA512",
      "checksumValue": "3d15851ee494dde0ed4093ef9cd63b..."
    }
  ]
}
```

The example record shown above conforms to version 2.3 of the SPDX [Package](https://spdx.github.io/spdx-spec/v2.3/package-information/) specification.

The <code>[downloadLocation](https://spdx.github.io/spdx-spec/v2.3/package-information/#77-package-download-location-field)</code> field will report the resolved location calculated by Arborist. This may point to a package registry, or a git URL for dependencies referenced directly from git. The top-level project will specify a value of <code>NOASSERTION</code> for the download location as this information is not available.

All packages will specify a `false` value for the <code>[filesAnaylzed](https://spdx.github.io/spdx-spec/v2.3/package-information/#78-files-analyzed-field)</code> field to signal that no assertions are being made about the files contained within a package.

The <code>[externalRefs](https://spdx.github.io/spdx-spec/v2.3/package-information/#721-external-reference-field)</code> field will contain two <code>[PACKAGE-MANAGER](https://spdx.github.io/spdx-spec/v2.3/external-repository-identifiers/#f3-package-manager)</code> references, one using the <code>[npm](https://spdx.github.io/spdx-spec/v2.3/external-repository-identifiers/#f32-npm)</code> reference type and the other using the <code>[purl](https://spdx.github.io/spdx-spec/v2.3/external-repository-identifiers/#f35-purl)</code> reference type.


## Unresolved Questions and Bikeshedding

* There’s a case to be made that SBOM generation should just be a flag on the existing `npm-ls` command – an SBOM is really just a different format of the output already generated by `npm-ls` (in fact, the CycloneDX tool described above parses the output from `npm-ls` in order to generate its SBOM). However, many of the arguments supported by `npm-ls` don’t really make sense in the context of SBOM generation (package spec filtering, depth, etc…) so it feels like a bit of an awkward fit. \
 \
Making it a distinct command allows us to add SBOM-specific features in the future like a `--sign` flag which could be used to generate a signed SBOM. \
 \
_Recommendation: Add a distinct command for generating an SBOM._
 
* Does `npm-sbom` command have a notion of a “default” SBOM format? Do we give preference to one of CycloneDX/SPDX or do we remain totally neutral (possibly at the expense of DX)? \
 \
_Recommendation: Default to SPDX if no format is specified._

* Both CycloneDX and SPDX support multiple document formats (JSON, XML, Protocol Buffers, etc). Should we support output of multiple formats, or do we stick w/ JSON? \
 \
_Recommendation: Stick with JSON-only for the first version of this feature._


## Example SBOMs

The sections below show what the different SBOM formats would look like for a basic npm project with a handful of dependencies.

The _package.json_ file below describes a “hello-world” application with two direct dependencies: the `debug` package and the `@tsconfig/node14` package (which is listed as a development dependency). The `debug` package itself has a dependency on the `ms` package.

```json
{
  "name": "hello-world",
  "version": "1.0.0",
  "license": "Apache-2.0",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/example/hello-world.git"
  },
  "dependencies": {
    "debug": "^4.3.0"
  },
  "devDependencies": {
    "@tsconfig/node14": "^14.1.0"
  }
}
```

The complete dependency tree for this project looks like this:

```
$ npm ls

hello-world@1.0.0 
├── @tsconfig/node14@14.1.0
└─┬ debug@4.3.4
  └── ms@2.1.2
```


### CycloneDX

The proposed CycloneDX SBOM generated for the project above would look like the following:

```json
{
  "$schema": "https://cyclonedx.org/schema/bom-1.4.schema.json",
  "bomFormat": "CycloneDX",
  "specVersion": "1.4",
  "serialNumber": "urn:uuid:f2fa9eae-72f1-430c-a9b3-986ffe05bc6e",
  "version": 1,
  "metadata": {
    "timestamp": "2023-08-10T00:19:08.697Z",
    "tools": [
      {
        "vendor": "npm",
        "name": "cli",
        "version": "9.8.1"
      }
    ],
    "component": {
      "bom-ref": "hello-world@1.0.0",
      "type": "application",
      "name": "hello-world",
      "version": "1.0.0",
      "purl": "pkg:npm/hello-world@1.0.0",
      "properties": [
        {
          "name": "cdx:npm:package:path",
          "value": ""
        }
      ]
    }
  },
  "components": [
    {
      "bom-ref": "@tsconfig/node14@1.0.3",
      "type": "library",
      "name": "@tsconfig/node14",
      "version": "1.0.3",
      "scope": "required",
      "purl": "pkg:npm/%40tsconfig/node14@1.0.3",
      "externalReferences": [
        {
          "type": "distribution",
          "url": "https://registry.npmjs.org/@tsconfig/node14/-/node14-1.0.3.tgz"
        }
      ],
      "properties": [
        {
          "name": "cdx:npm:package:path",
          "value": "node_modules/@tsconfig/node14"
        },
        {
          "name": "cdx:npm:package:development",
          "value": "true"
        }
      ],
      "hashes": [
        {
          "alg": "SHA-512",
          "content": "cac4fc9a1762c562..."
        }
      ]
    },
    {
      "bom-ref": "debug@4.3.4",
      "type": "library",
      "name": "debug",
      "version": "4.3.4",
      "scope": "required",
      "purl": "pkg:npm/debug@4.3.4",
      "externalReferences": [
        {
          "type": "distribution",
          "url": "https://registry.npmjs.org/debug/-/debug-4.3.4.tgz"
        }
      ],
      "properties": [
        {
          "name": "cdx:npm:package:path",
          "value": "node_modules/debug"
        }
      ],
      "hashes": [
        {
          "alg": "SHA-512",
          "content": "3d15851ee494dde0..."
        }
      ]
    },
    {
      "bom-ref": "ms@2.1.2",
      "type": "library",
      "name": "ms",
      "version": "2.1.2",
      "scope": "required",
      "purl": "pkg:npm/ms@2.1.2",
      "externalReferences": [
        {
          "type": "distribution",
          "url": "https://registry.npmjs.org/ms/-/ms-2.1.2.tgz"
        }
      ],
      "properties": [
        {
          "name": "cdx:npm:package:path",
          "value": "node_modules/ms"
        }
      ],
      "hashes": [
        {
          "alg": "SHA-512",
          "content": "b0690fc7e56332d9..."
        }
      ]
    }
  ],
  "dependencies": [
    {
      "ref": "hello-world@1.0.0",
      "dependsOn": [
        "debug@4.3.4",
        "@tsconfig/node14@1.0.3"
      ]
    },
    {
      "ref": "@tsconfig/node14@1.0.3",
      "dependsOn": []
    },
    {
      "ref": "debug@4.3.4",
      "dependsOn": [
        "ms@2.1.2"
      ]
    },
    {
      "ref": "ms@2.1.2",
      "dependsOn": []
    }
  ]
}
```

### SPDX

The proposed SPDX SBOM generated for the project above would look like the following:

```json
{
  "spdxVersion": "SPDX-2.3",
  "dataLicense": "CC0-1.0",
  "SPDXID": "SPDXRef-DOCUMENT",
  "name": "hello-world@1.0.0",
  "documentNamespace": "http://spdx.org/spdxdocs/hello-world-1.0.0-<uuid>",
  "creationInfo": {
    "created": "2023-08-09T22:31:28.107Z",
    "creators": [
      "Tool: npm/cli-9.8.1"
    ]
  },
  "documentDescribes": [
    "SPDXRef-Package-hello-world-1.0.0"
  ],
  "packages": [
    {
      "name": "hello-world",
      "SPDXID": "SPDXRef-Package-hello-world-1.0.0",
      "versionInfo": "1.0.0",
      "downloadLocation": "NOASSERTION",
      "filesAnalyzed": false,
      "externalRefs": [
        {
          "referenceCategory": "PACKAGE-MANAGER",
          "referenceType": "npm",
          "referenceLocator": "hello-world@1.0.0"
        },
        {
          "referenceCategory": "PACKAGE-MANAGER",
          "referenceType": "purl",
          "referenceLocator": "pkg:npm/hello-world@1.0.0"
        }
      ]
    },
    {
      "name": "@tsconfig/node14",
      "SPDXID": "SPDXRef-Package-tsconfig.node14-1.0.3",
      "versionInfo": "1.0.3",
      "downloadLocation": "https://registry.npmjs.org/@tsconfig/node14/...",
      "filesAnalyzed": false,
      "externalRefs": [
        {
          "referenceCategory": "PACKAGE-MANAGER",
          "referenceType": "npm",
          "referenceLocator": "@tsconfig/node14@1.0.3"
        },
        {
          "referenceCategory": "PACKAGE-MANAGER",
          "referenceType": "purl",
          "referenceLocator": "pkg:npm/%40tsconfig/node14@1.0.3"
        }
      ],
      "checksums": [
        {
          "algorithm": "SHA512",
          "checksumValue": "cac4fc9a1762c562..."
        }
      ]
    },
    {
      "name": "debug",
      "SPDXID": "SPDXRef-Package-debug-4.3.4",
      "versionInfo": "4.3.4",
      "downloadLocation": "https://registry.npmjs.org/debug/-/debug-4.3.4.tgz",
      "filesAnalyzed": false,
      "externalRefs": [
        {
          "referenceCategory": "PACKAGE-MANAGER",
          "referenceType": "npm",
          "referenceLocator": "debug@4.3.4"
        },
        {
          "referenceCategory": "PACKAGE-MANAGER",
          "referenceType": "purl",
          "referenceLocator": "pkg:npm/debug@4.3.4"
        }
      ],
      "checksums": [
        {
          "algorithm": "SHA512",
          "checksumValue": "3d15851ee494dde0..."
        }
      ]
    },
    {
      "name": "ms",
      "SPDXID": "SPDXRef-Package-ms-2.1.2",
      "versionInfo": "2.1.2",
      "downloadLocation": "https://registry.npmjs.org/ms/-/ms-2.1.2.tgz",
      "filesAnalyzed": false,
      "externalRefs": [
        {
          "referenceCategory": "PACKAGE-MANAGER",
          "referenceType": "npm",
          "referenceLocator": "ms@2.1.2"
        },
        {
          "referenceCategory": "PACKAGE-MANAGER",
          "referenceType": "purl",
          "referenceLocator": "pkg:npm/ms@2.1.2"
        }
      ],
      "checksums": [
        {
          "algorithm": "SHA512",
          "checksumValue": "b0690fc7e56332d9..."
        }
      ]
    }
  ],
  "relationships": [
    {
      "spdxElementId": "SPDXRef-DOCUMENT",
      "relatedSpdxElement": "SPDXRef-Package-hello-world-1.0.0",
      "relationshipType": "DESCRIBES"
    },
    {
      "spdxElementId": "SPDXRef-Package-hello-world-1.0.0",
      "relatedSpdxElement": "SPDXRef-Package-debug-4.3.4",
      "relationshipType": "DEPENDS_ON"
    },
    {
      "spdxElementId": "SPDXRef-Package-hello-world-1.0.0",
      "relatedSpdxElement": "SPDXRef-Package-tsconfig.node14-1.0.3",
      "relationshipType": "DEV_DEPENDENCY_OF"
    },
    {
      "spdxElementId": "SPDXRef-Package-debug-4.3.4",
      "relatedSpdxElement": "SPDXRef-Package-ms-2.1.2",
      "relationshipType": "DEPENDS_ON"
    }
  ]
}
```

## References

* [NTIA Software Bill of Materials](https://ntia.gov/page/software-bill-materials)
* [Types of Sofware Bill of Materials (SBOM) Documents](https://www.cisa.gov/sites/default/files/2023-04/sbom-types-document-508c.pdf)
* [OSSF - SBOM Everywhere SIG](https://github.com/ossf/sbom-everywhere)
* [Authoritative Guide to SBOM](https://cyclonedx.org/guides/sbom/OWASP_CycloneDX-SBOM-Guide-en.pdf)
* [SPDX Spec v2.3](https://spdx.github.io/spdx-spec/v2.3/)
