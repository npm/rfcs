# Don't change EUID/perms when running as root

## Summary

When running scripts as `root` on Unix systems, npm will no longer change
the effective UID of the script to another user id.  Ownership of all files
that are created will have the same UID and GID as the owner of the nearest
existing folder where the file is created.

## Motivation

Running npm as root is fraught.  Files produced are sometimes owned by
root, sometimes not.  Install scripts appear to fail most of the time, as
they're run by nobody in directories that nobody can't write to.

The motivation for changing the uid and gid of package.json scripts dates
back to assumptions about the npm threat model which have turned out to be
somewhat misguided.  Attacks tend to target local installs and runtime
malware injection, which is far more valuable for an attacker and not
dependent on script permissions.  Global installations (which often require
root) have become less common, especially with the introduction of `npx`
and the use of `npm run` scripts to perform build tasks.

Furthermore, the default user for running scripts is `nobody`.  npm accepts
a string for this configuration value, and then uses the
[`uid-number`](http://npm.im/uid-number) module to look up the numeric
uid and gid value.  This module is slow, and fails awkwardly when the user
by that name does not exist, as is often the case on Docker.  When
`uid-number` fails, the user must use the `--unsafe-perm` flag.  Since
there is little that is "unsafe" about this, the name of the flag causes
unnecessary concern and upset.

Thus, npm users gain little (if anything) in security from the current
behavior, often have to disable it anyway, and it causes friction.

## Detailed Explanation

### Root versus Administrator

#### Root on MacOS and Linux

On Unix-like systems, access to modify system installations is
traditionally limited to user id `0` (traditionally named `root`).  Modern
systems allow more complicated scenarios through the user of access control
lists, but they are out of scope for this discussion.

Modern best practices are that access to the `root` user is achieved
through a command called `sudo` which authenticates the current user and
can limit which commands may be run.  It also provides logging.  When
running commands with `sudo`, information about who the real user running
the command is preserved.

You can also access `root` by logging in as the user or by using the `su`
command.  `su` differs from `sudo` in that you authenticate for it using
`root`'s credentials, not your own, and information about who you are is
not preserved.  While `su` can be used to run individual commands, it's
more often used to open a shell as `root` from which commands to be run.

From Node.js, we can determine if the user is running as `root` by
examining the current uid.  We can determine if the user is using `sudo` by
examining the environment.

#### Administrator on Windows

On Windows systems the equivalent is to run things as `Administrator`.
Like `sudo`, you allow this using your credentials, not the credentials of
a separate administrator account.  Like `su`, ordinary practice with the
terminal is to open up a new terminal window with elevated permissions and
run commands from there.

Currently the only way for a Node.js program to determine it is running
with Administrator privileges is to run a Windows command that requires
them and see if it fails.  This is too slow to do on every installation and
as such npm does not change its behavior per install.

The remainder of this document does not apply to Windows.

### Summary of Changes

Remove MOST special behavior around root and sudo.  When `npm` is run as
root, either as the actual user or via sudo it will run its scripts as
root.

Ownership of files and folders that npm creates as root will be chowned to
the owner of the nearest pre-existing containing folder.

When running scripts, npm will no longer call `uid-number` to get the
numeric UID and GID of the configured user, and will not pass a UID or GID
to `npm-lifecycle`.  The `uid-number` module will be deprecated.

## Implementation

The [`infer-owner`](http://npm.im/infer-owner) module will be used where
appropriate, or similar logic in [`gentle-fs`](http://npm.im/gentle-fs),
cacache, pacote, or the npm CLI.

Prior to creating any file or directory (`target`):

1. Note the current uid and gid via `process.getuid()` and
   `process.getgid()`.
2. Call `inferOwner(target)` to get the owner of the nearest existing
   folder.
3. Create the target.
4. If the inferred uid or gid does not match the current uid or gid, and
   the current owner's uid is `0`, then call [recursive
   `chown`](http://npm.im/chownr) on the created target to set the uid and
   gid to the inferred uid and gid.  (Note that this means calling chownr on
   the _created_ folder rather than the target itself in the case of
   recursively created directories.)

Implementation of script changes is much simpler.  npm will stop passing a
uid and gid argument to npm-lifecycle, meaning that scripts will always run
as the current user.

### Timeline

- File ownership inferrence: started in npm v6.10.0, completed in npm
  v6.11.0.
- Script uid and gid will no longer be set to the `user` config in npm v7,
  as this is a breaking change.

### Configuration

We use the `.npmrc` in the configured home directory.

Under `sudo`, the user's home directory is not changed to the user they are
running as. As such, the user's `.npmrc` will be used and their existing
cache directory will be used.

Otherwise running as root, root's own home directory and thus `.npmrc` and
cache are used.

### Cache Permissions

Files created in the cache will use the same user and group as the top
level cache folder, or, if that does not exist, the folder that contains
it.

It is important that we maintain this behavior as `npm` running under sudo
will be working from the user's `.npmrc`.

### Config Files

Configuration files created by npm (ie, `/usr/local/etc/npmrc` and
`~/.npmrc`) will have the same owner as the folder where they reside.

For user-level configs, this will typically be the user executing the
command, since the file is in their home directory.  For global configs, in
a default setup this will leave the file owned by root.

### Installation

#### Local Installation

Files created in `node_modules` will use the same user and group as the
containing `node_modules` folder, or if that does not exist, the parent
folder, up to the project root.  In most scenarios, this will mean that the
locally installed packages are owned by the user, not by root.

#### Global Installation

Global installs will use the same logic as local installs.  In a default
setup, where `root` is the owner of `/usr/local`, installed files will be
owned by root.

#### Lifecycle Scripts

Lifecycle scripts will be run as root.

## Prior Art

All of the standard Unix userland writes files as root when running as root.
