# npm diff ignore CR at EOL

## Summary

An option to ignore Carriage Return (CR) at the end of lines when performing npm diff.

## Motivation

To improve `npm diff` on packages developed on different platforms. Currently 
there are scenarios where every line is shown as changed if you are comparing
to a package that was developed on a different platform than yours.

## Detailed Explanation

If you build a compiled package, e.g. with typescript `tsc` on windows, the 
output is produced with CRLF (Carriage Return, Line Feed) line endings. 
If you then build the same application on UNIX, the output is produced with
LF line endings, as expected. 

The problem arises when you want to see if your newly produced package has
any changes compared to another package, if that package was produced
on another platform.

If the package you are comparing to is built on Windows, while you are
working in UNIX, every produced file will be different because of the different
file endings.

This problem is avoided in some cases when the files you are comparing are
tracked by git, depending on your git `autocrlf` configuration. The 
scenarios where I've noticed this is when the files we are comparing are built
locally and `.gitignore`d.

I'm suggesting the flag `--diff-ignore-cr-at-eol`. This is quite a mouthful,
but would be consistent with 
[`git diff --ignore-cr-at-eol`](https://github.com/git/git/commit/e9282f02b2f21118f3383608718e38efc3d967e1)
introduced in
[`git v2.16`](https://git-scm.com/docs/git-diff/2.16.6). 

## Rationale and Alternatives

* Packages have their lineendings normalized when downloaded/installed from
  the registry. 

  Similiar to `git config core.autocrlf`, npm could also normalize line
  endings when installing on a Windows machine. By doing this, 
  `npm diff` would always be comparing files that are normalized for windows.

  However this would be a big change with plenty of potential pitfall. It'd
  also become problematic if a Windows user had configured git to keep files
  with LF line endings and tried to compare to a package that npm would then
  normalize to CRLF, again causing diffs...

## Implementation

A change to `libnpmdiff` to add a new option `diffIgnoreCRAtEOL` similiarly
to the 
[`diffIgnoreAllSpace` option](https://github.com/npm/cli/blob/892b66eba9f21dbfbc250572d437141e39a6de24/workspaces/libnpmdiff/lib/format-diff.js#L76). 
However, as far as I can tell,
[npmjs.com/diff](https://npmjs.com/diff)/[kpdecker/jsdiff](https://github.com/kpdecker/jsdiff/)
does not have any option to do something like this. One option is to submit a
PR to add this.

Add the `--diff-ignore-cr-at-eol` configuration support to the npm cli and
make sure `./lib/commands/diff.js` handles it as expected to `libnpmdiff`.

## Prior Art

* As mentioned previously 
  [`git diff --ignore-cr-at-eol`](https://github.com/git/git/commit/e9282f02b2f21118f3383608718e38efc3d967e1)

* Gnu diffutils 
  [`diff --strip-trailing-cr`](https://www.gnu.org/software/diffutils/manual/html_node/diff-Options.html#diff-Options)
