# Running npm as root redesign

## Summary

This document specifies npm's behavior when running as root, both via sudo
and through an ordinary login.

## Motivation

Running npm as root is fraught.  Files produced are sometimes owned by root,
sometimes not.  Install scripts appear to fail most of the time, as they're
run by nobody in directories that nobody can't write to.

## Detailed Explanation

### Root versus Administrator

#### Root on MacOS and Linux

On Unix-like systems, access to modify system installations is traditionally
limited to user id `0` (traditionally named `root`).  Modern systems allow
more complicated scenarios through the user of access control lists, but
they are out of scope for this discussion.

Modern best practices are that access to the `root` user is achieved through
a command called `sudo` which authenticates the current user and can limit
which commands may be run. It also provides logging. When running commands
with `sudo`, information about who the real user running the command is preserved.

You can also access `root` by logging in as the user or by using the `su`
command.  `su` differs from `sudo` in that you authenticate for it using
`root`'s credentials, not your own, and information about who you are is not
preserved.  While `su` can be used to run individual commands, it's more
often used to open a shell as `root` from which commands to be run.

From Node.js, we can determine if the user is running as `root` by examining
the current uid.  We can determine if the user is using `sudo` by examining
the environment.

#### Administrator on Windows

On Windows systems the equivelant is to run things as `Administrator`.  Like
`sudo`, you allow this using your credentials, not the credentials of a
separate administrator account.  Like `su`, ordinary practice with the
terminal is to open up a new terminal window with elevated permissions and
run commands from there.

Currently the only way for a Node.js program to determine it is
running with Administrator privileges is to run a Windows command that
requires them and see if it fails.  This is too slow to do on every
installation and as such npm does not change its behavior per install.

The remainder of this document does not apply to Windows.

### Summary of Changes

Remove all special behavior around root and sudo.  When `npm` is run as
root, either as the actual user or via sudo it will write its files and run
its scripts as root.  It will use the config and cache in root's home
directory.

## Implementation

### Configuration

The `.npmrc` in root's home directory is used.

When running under sudo, configuration from the user's `.npmrc` is used, but
the values from root's is preferred.

### Cache Directory

Unless configured otherwise, the cache directory is one in root's home directory.

### Cache Permissions

Files created in the cache will use the same user and group as the top level
cache folder, or, if that does not exist, the folder that contains it.

### Installation

#### Local Installation

Local installation with `sudo` into a directory not owned by root
requires `--force` to complete.

Installed files and directories are owned by root.

#### Global Installation

Installed files and directories are owned by root.

#### Lifecycle Scripts

Lifecycle scripts will be run as root.

## Prior Art

All of the standard Unix userland writes files as root when running as root.

## Unresolved Questions

Should npm running as root make any attempt to read the user's auth
information?  Not doing this means you'd have to separately `sudo npm login`
if you wanted to install private packages as root.  On the other hand, KISS
principles suggest that we should not try to be magic here. In particular, we
_don't_ want other user-level config, like cache directories.

