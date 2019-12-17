# npm install output scares people

## Summary

`npm install` shows too much low level information which is unhelpful to most developers.

## Motivation

There is no way to tell if a `npm install` has worked or not. Many of my students are confused at the output as it looks like something has gone wrong when everything runs just fine.

## Detailed Explanation

Just npm install something and look at the output. This was from 100% success:

![](https://p198.p4.n0.cdn.getcloudapp.com/items/o0uQv6kn/Screen+Shot+2019-12-16+at+3.14.40+PM.png?v=2764c0b9e95ca3ba47a8765e4a13ea1a)

## Rationale and Alternatives

Some people have suggested --silent as a good solution, but that will hide good errors as well, no?

## Implementation

If everything worked, then don't show a bunch of scary things on the screen.

## Prior Art

yarn, pnpm

