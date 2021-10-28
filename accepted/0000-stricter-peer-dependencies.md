# {{TITLE: a human-readable title for this RFC!}}

## Summary

This RFC suggests that npm would offer more guarantee to developers using peerDependencies. Some scenarios involving peer dependencies currently don't work or only work by luck.

## Motivation

Real world example:

```

dependency tree:

workspace A
    +--------> webpack-cli@*
    |              +- - - - - -> webpack@4||5 (peer dependency)
    +--------> webpack@^5.0.0

workspace B
    +--------> webpack@^4.0.0

workspace C
    +--------> webpack@^4.0.0

```

Currently npm, reifies this dependency tree with the following way:

```

+---> node_modules
|          +--------> webpack-cli@3.3.0
|          +--------> webpack@4.46.0
+---> A
|     +------> node_modules
|                   +------> webpack@5.60.0
+---> B
|
+---> C

```

When the owner of the workspace A calls webpack-cli (from within the A workspace), webpack-cli will use webpack version 4.

This is not what the owner of workspace A expects, webpack-cli should use the webpack version defined by workspace A which is version 5.

The following reification would solve this problem:

```

+---> node_modules
|          +--------> webpack@4.46.0
+---> A
|     +------> node_modules
|                   +------> webpack@5.60.0
|                   +--------> webpack-cli@3.3.0
+---> B
|
+---> C

```

## Detailed Explanation

{{Describe the expected changes in detail, }}

## Rationale and Alternatives

{{Discuss 2-3 different alternative solutions that were considered. This is required, even if it seems like a stretch. Then explain why this is the best choice out of available ones.}}

## Implementation

{{Give a high-level overview of implementation requirements and concerns. Be specific about areas of code that need to change, and what their potential effects are. Discuss which repositories and sub-components will be affected, and what its overall code effect might be.}}

{{THIS SECTION IS REQUIRED FOR RATIFICATION -- you can skip it if you don't know the technical details when first submitting the proposal, but it must be there before it's accepted}}

## Prior Art

{{This section is optional if there are no actual prior examples in other tools}}

{{Discuss existing examples of this change in other tools, and how they've addressed various concerns discussed above, and what the effect of those decisions has been}}

## Unresolved Questions and Bikeshedding

{{Write about any arbitrary decisions that need to be made (syntax, colors, formatting, minor UX decisions), and any questions for the proposal that have not been answered.}}

{{THIS SECTION SHOULD BE REMOVED BEFORE RATIFICATION}}
