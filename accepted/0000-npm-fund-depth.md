# npm fund depth

## Summary

This RFC introduces a `depth` flag to the `npm fund` command.

## Motivation

Adding this command solves the case of having funding information overload. Currently here is an example output of the `npm fund` command (only about 4 of the items listed are direct dependencies):

```
dynamoose % npm fund
dynamoose@2.2.0
├─┬ https://opencollective.com/typescript-eslint
│ └── @typescript-eslint/eslint-plugin@2.30.0, @typescript-eslint/parser@2.30.0, @typescript-eslint/experimental-utils@2.30.0, @typescript-eslint/typescript-estree@2.30.0
├─┬ https://opencollective.com/eslint
│ └── eslint@6.8.0
├─┬ https://opencollective.com/mochajs
│ └── mocha@7.1.2
├─┬ https://github.com/sponsors/mysticatea
│ └── regexpp@3.1.0
├─┬ https://github.com/sponsors/isaacs
│ └── glob@7.1.6, rimraf@3.0.2
├─┬ https://github.com/sponsors/sindresorhus
│ └── globals@12.4.0, ansi-escapes@4.3.1, figures@3.2.0, type-fest@0.11.0, p-limit@2.2.2, make-dir@3.0.2
├─┬ https://github.com/chalk/ansi-styles?sponsor=1
│ └── ansi-styles@4.2.1
├─┬ https://github.com/sponsors/jonschlinkert
│ └── picomatch@2.2.2
├─┬ https://github.com/sponsors/ljharb
│ └── object.getownpropertydescriptors@2.1.0, es-abstract@1.17.5, es-to-primitive@1.2.1, has-symbols@1.0.1, is-callable@1.1.5, is-regex@1.0.5, object-inspect@1.7.0, string.prototype.trimleft@2.1.2, string.prototype.trimright@2.1.2, is-date-object@1.0.2, is-symbol@1.0.3, string.prototype.trimstart@1.0.1, string.prototype.trimend@1.0.1, resolve@1.15.1
├─┬ https://github.com/avajs/find-cache-dir?sponsor=1
│ └── find-cache-dir@3.3.1
└─┬ https://opencollective.com/babel
  └── @babel/core@7.9.0
```

This is a lot of information for a relatively small project. Adding the `depth` flag would allow users to only see the funding information for direct dependencies, and reduce the information being shown, and therefore increasing the chances of funding.

This would also add more consistency with other npm commands such as `npm ls` which has a `depth` flag.

## Detailed Explanation

This RFC proposes to add a `depth` flag to `npm fund`. This would have the same behavior as the `depth` flag on `npm ls`. When you set the `depth` flag it would only show funding information for the depth passed in.

The existing `npm fund` command would have **no** change after this RFC is implemented. It just adds an additional `depth` flag to the existing command.

## Rationale and Alternatives

#### No change

Benefits:

- More packages are represented in the `npm fund` output. However with this RFC the default is still to view all packages, therefore this isn't much of a drawback.

Drawbacks:

- Funding bloat happens quickly. It's impossible to fund all dependencies, and users are more likely to fund direct dependencies since they know how they interact with them and utilize them directly.
- Lack of consistency with other npm commands such as `npm ls`.

#### Set depth to 0 by default without adding flag

Benefits:

- Less to type to get funding information about direct dependencies.

Drawbacks:

- Changes the behavior of the existing command that users expect.
- More difficult/impossible to get funding information for indirect dependencies.
- Lack of consistency with other npm commands such as `npm ls`.

## Implementation

Unsure at this time. Likely will need feedback from npm team here.

## Prior Art

`npm fund` is a command unique to npm. There are no other known examples of a similar command in other package manger CLIs.

## Unresolved Questions and Bikeshedding

None.
