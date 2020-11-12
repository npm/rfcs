# Powershell for Installed Binaries

AKA Terminate Terminate Batch Job

## Implemented

Landed on [cmd-shim](https://github.com/npm/cmd-shim/pull/34) in v2.1.0,
and in [npm/cli 6.11.0](https://github.com/npm/cli/releases/tag/v6.11.0).

## Summary

Today, installing binaries using npm creates an executable bash script and a .cmd file with the same name. Unfortunately, terminating cmd scripts with SIGINT causes a useless prompt for windows users - "Terminate batch job (Y/N)". Also, Powershell is the default shell for Windows. By creating .ps1 scripts in addition to bash and .cmd, powershell users will have a better command line experience.

## Motivation

Windows users have three main options when it comes to shells:

- cmd: essentially unchanged from early versions of Windows
- powershell: the default Windows shell, under active development
- unixy shell: for example git-bash, zsh via WSL

WSL is growing in popularity, but isn't super common. Many Windows users need to use or prefer using a native shell. And for those using Powershell, we can make their experience better by creating powershell binary wrappers.

## Detailed Explanation

When installing binaries (e.g. `npm install -g typescript`), NPM should create `tsc.ps1` in addition to `tsc.cmd` and the executable `tsc` bash script. Powershell will prioritize `foo.ps1` over `foo.cmd` when users type `foo` on the command line. cmd users will have to continue living with it. Users of git-bash or WSL shells will be unaffected.

## Rationale and Alternatives

The main alternative is to maintain the status quo, but this leaves an annoying SIGINT prompt in Windows's default shell.

Creating just .ps1 scripts isn't an option. cmd can't start treating .ps1 scripts as executables (at least not by default), and NPM can't drop support for cmd.

## Implementation

Here's an example of a functionally identical powershell wrapper:

```powershell
$myPath = Split-Path $myInvocation.MyCommand.Path -Parent
$node = Join-Path $myPath 'node.exe'
$binPath = Join-Path $myPath '[ path to node_module bin script, e.g. node_modules\typescript\bin\tsc]'
if (Test-Path $node)
{
    & $node $binPath $args
}
else
{
    node $binPath $args
}
```

The path to the bin script will have to be substituted into the right place.

## Prior Art

- [cmd-shim](https://www.npmjs.com/package/cmd-shim)
- [yarn PR](https://github.com/yarnpkg/yarn/pull/6093)

## Unresolved Questions and Bikeshedding

- impact of additional scripts on install times, node_modules size, etc.
- default powershell permissions: will powershell users need to toggle some settings so this works without permissions errors? Can the errors be worked around? (This PR will need testing on a fresh Windows install)
