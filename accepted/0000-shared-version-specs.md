# Shared Version Specifications

## Summary

Provide a mechanism for users to specify reusable version specifications for multiple dependencies. For example, many dependencies are published with the same version. In such cases, it would be handy for a user to specify the version in a single place and then reuse it across dependencies.

## Motivation

Developers sometimes intend for several packages to have the same version. These packages usually compose a framework or some other larger structure. A framework usually has a version, and each of its composing packages uses that version as their package version. For instance, JavaScript frameworks like "Angular" and "React" publish several packages with the same version. In such cases, it would be handy for a user to specify the version in a single place and then reuse it across dependencies.

Furthermore, tools like [Dependabot](https://github.com/dependabot) create Pull-Requests that update dependencies to the latest versions. In some environments, like Gradle, where sharing version specifications is supported, these tools can reason about versions and update several dependencies at once. However, for NPM, these tools cannot infer that framework packages should be upgraded together. Allowing for reusing versions specifications can enable these tools to reason which dependencies should be updated together.

## Detailed Explanation

This proposal includes adding a new field in `package.json` named `versions` to achieve the desired result. This entry maps a name to a version. We would then resolve package specs with the following format `versions:<name>` to the entry under `versions` with the name `<name>`.

### Example

Let us say that we have a framework, aptly named, framework. This framework has two packages, "@framework/core" and "@framework/common". The latest version of the framework is "~1.2.3", and we would like for both of these packages to use that version, then we could specify the version like so:

```json=
  ...
  "versions": {
      "framework": "~1.2.3"
  },
  "dependencies": {
      "@framework/core": "versions:framework",
      "@framework/common": "versions:framework",
      ...
  }
  ...
```

We could update both packages when a new version rolls out by updating the entry "framework" under "versions".

## Rationale and Alternatives

This section lists alternatives to the proposed solution and their implications. 

### Referring to other dependencies' versions

Instead of introducing the version field into `package.json`, one could introduce the ability for a dependency's version to be referred to by other dependencies. This could look something like the following:

```json=
  ...
  "dependencies": {
      "@framework/core": "~1.2.3",
      "@framework/common": "refer:@framework/core",
      ...
  }
  ...
```

The issue here is twofold: First, it can get messy with many dependencies across multiple dependency types ("dependencies," "devDependencies," "peer dependencies," and so on). Second, it might lead to circular dependencies. Consider the following example:

```json=
  ...
  "dependencies": {
      "A": "refer:B",
      "B": "refer:A",
      ...
  }
  ...
```

However, the implementation impact of this solution would be the same as with the proposed solution.

### Overrides

The resolution of packages in "overrides" can be changed to achieve the desired effect. Take, for instance, the following `package.json` example extract:

```json=
  ...
  "dependencies": {
      "@framework/core": "~1.2.3",
      "@framework/common": "*",
      ...
  },
  "overrides": {
      "@framework/core": "$@framework/core",
      "@framework/common": "$@framework/core"
  }
  ...
```

Updating framework packages with overrides would only require updating a single string. However, overriding would affect the entire tree, which may not be desired. Furthermore, as this is not the intended use of the override feature, using overrides for this purpose should not be considered.

### External tooling

Creating a third-party NPM package could solve this problem. Such a package would probably require a "versions" entry in `package.json`, mapping package names to other package names. Running the package would then do the following for each dependency in `package.json`:

> For every package A, listed in `versions`, find the version V by referring to `dependencies[versions[A]]`, then find and replace A's version dependencies with V.

Afterwhich `npm install` could be run, installing the correct version.

This solution can be implemented without any change to NPM's CLI. However, it would inevitably lead to several different implementations, which would limit the support from third-party actors like IDEs and update tools like Dependabot.

## Implementation

The identified points of interest for change are listed below.

### Changes in cli's [`dep-valid.js`](https://github.com/npm/cli/blob/a92665c92940b93e3e41eb8396257d684ee95c5f/workspaces/arborist/lib/dep-valid.js)

The first thing is that [`depValid`](https://github.com/npm/cli/blob/a92665c92940b93e3e41eb8396257d684ee95c5f/workspaces/arborist/lib/dep-valid.js#L12) needs to be provided with the `versions` field. Then the call to [`npa.resolve`](https://github.com/npm/cli/blob/a92665c92940b93e3e41eb8396257d684ee95c5f/workspaces/arborist/lib/dep-valid.js#L23) needs to include the `versions` field.

Finally, [`depValid`](https://github.com/npm/cli/blob/a92665c92940b93e3e41eb8396257d684ee95c5f/workspaces/arborist/lib/dep-valid.js#L63) needs to handle the case for shared versions. Handing of shared versions should be the same as aliases.

### Changes in npm-package-arg's [`npa.js`](https://github.com/npm/npm-package-arg/blob/fbaf2fd0b72a0f38e7c24260fd4504f4724c9466/npa.js)

It has been decided that aliases would only allow non-nested registry specs. Similar decisions need to be considered here as well. For simplicity, shared versions could be assigned any value except shared versions. That is, shared versions may not be nested. The reason for this is that this may cause circular dependencies.

The [resolve function in npa](https://github.com/npm/npm-package-arg/blob/main/npa.js#L53) should change to take into account shared versions.

## Prior Art

## Gradle

Gradle has the [`ext` properties](https://docs.gradle.org/current/dsl/org.gradle.api.plugins.ExtraPropertiesExtension.html) which are often used in specifying versions. Take for instance the following `build.gradle` example extract:

```groovy=
ext {
    framework = "1.2.3"
}

dependencies {
    implementation "com.framework:core:${project.framework}"
    implementation "com.framework:common:${project.framework}"
}
``` 

## Environments with YAML spec files

Since [Anchors](https://yaml.org/spec/1.0/index.html#id2563853) and [Aliases](https://yaml.org/spec/1.0/index.html#id2563922) are a part of the [YAML specification](https://yaml.org/spec/1.0/index.html) every environment using it can share version specifications. Take for instance the following `pubspec.yaml` example extract:

```yaml=
dependencies:
  framework-core: &framework ~1.2.3
  framework-common: *framework
```

Which would be equivalent to the following JSON:

```json=
{
    "dependencies": {
        "framework-core": "~1.2.3",
        "framework-common": "~1.2.3"
    }
}
```

Circular dependencies are not an issue for YAML since a node cannot be an anchor and an alias.

## Ruby's Gemfile and .gemspec files

Because Ruby's Gemfile and .gemspec files are Ruby scripts, specifying shared versions is simple. Take, for instance, the following `.gemspec` extract:

```ruby=
version = File.read(File.expand_path("RAILS_VERSION", __dir__)).strip

Gem::Specification.new do |s|
  s.platform    = Gem::Platform::RUBY
  s.name        = "rails"
  ...
  s.add_dependency "activesupport", version
  s.add_dependency "actionpack",    version
  s.add_dependency "actionview",    version
  ...
end
```

Here, multiple dependencies are added with the same version loaded from a file.

## Unresolved Questions and Bikeshedding

The following details need to be ratified:

* The name of this type of spec
* Whether or not versions should cascade from root to workspaces packages
* The types of allowed sub-spec types for shared versions
