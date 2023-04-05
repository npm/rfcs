# REDIRECT PACKAGE A TO PACKAGE B ON SPECIFICATION KEY IN PACKAGE.JSON

## Summary

The RFC recommentation allows for `redirecting` a `package A` to Package B while installation using a key in a `package.json` specification. This feature should install `Package B` when a installation of `Package A` is made from npm.


## Motivation

- Move systematically to another package.
- Stopping maintainence or stopping a package in favour of another package.
- Name reuse and Name change related branding or traction issues.


## Detailed Explanation

I have two packages ajs and bjs. Due to some reason I intend to merge both. Right now, I am installing ajs with npm install ajs and bjs with npm install bjs. But after the merge I wish to install bjs when ajs (npm i ajs) is installed.

Allow redirecting a package A to Package B while installation using a key in a package.json specification. This feature should allow for installong Package B when a installation of Package A is made from npm.

I am aware of manual installation of `npm i <alias>@npm:<package>`. It does not solve my purpose. I wish not to copy one repo `packagea` to another to maintain the sanity of the deprecated repository upgraded to another `packageb`. The only option I see is update the github url in the repository. But I doubt it solves the purpose. Any help is welcome.

So when `npm install packagea` is made it is install `packageb` if the `packagea` has a key for `redirect` or `redirectInstall` as a key specification something like below.

Package A's `package.json` specification:

```
{
    ...
    redirectInstall: packageb,
    ...
}
```


https://stackoverflow.com/questions/72554667/install-package-x-when-a-request-for-package-y-installation-is-made


- npm: 8.5.5
- Node.js: 16.15.0
- OS Name: Windows/Linux
- System Model Name: Dell Vostro OEM 3590 - i5 x64 Arch
- npm config: 

```ini
; copy and paste output from `npm config ls` here
; node bin location = C:\Users\ganes\OneDrive\Documents\binaries\node\node.exe
; cwd = C:\Users\ganes\OneDrive\Documents\projects\github\cgi-js
; HOME = C:\Users\ganes
; Run `npm config ls -l` to show all defaults.

C:\Users\ganes\OneDrive\Documents\projects\github\cgi-js>npm config ls -l
; "default" config from default values

_auth = (protected) 
access = null 
all = false
allow-same-version = false
also = null
audit = true
audit-level = null
auth-type = "legacy"
before = null
bin-links = true
browser = null
ca = null
cache = "C:\\Users\\ganes\\AppData\\Local\\npm-cache"
cache-max = null
cache-min = 0
cafile = null
call = ""
cert = null
ci-name = null
cidr = null
color = true
commit-hooks = true
depth = null
description = true
dev = false
diff = []
diff-dst-prefix = "b/"
diff-ignore-all-space = false
diff-name-only = false
diff-no-prefix = false
diff-src-prefix = "a/"
diff-text = false
diff-unified = 3
dry-run = false
editor = "notepad.exe"
engine-strict = false
fetch-retries = 2
fetch-retry-factor = 10
fetch-retry-maxtimeout = 60000
fetch-retry-mintimeout = 10000
fetch-timeout = 300000
force = false
foreground-scripts = false
format-package-lock = true
fund = true
git = "git"
git-tag-version = true
global = false
global-style = false
globalconfig = "C:\\Users\\ganes\\OneDrive\\Documents\\binaries\\node\\etc\\npmrc"
heading = "npm"
https-proxy = null
if-present = false
ignore-scripts = false
include = []
include-staged = false
include-workspace-root = false
init-author-email = ""
init-author-name = ""
init-author-url = ""
init-license = "ISC"
init-module = "C:\\Users\\ganes\\.npm-init.js"
init-version = "1.0.0"
init.author.email = ""
init.author.name = ""
init.author.url = ""
init.license = "ISC"
init.module = "C:\\Users\\ganes\\.npm-init.js"
init.version = "1.0.0"
json = false
key = null
legacy-bundling = false
legacy-peer-deps = false
link = false
local-address = null
location = "user"
lockfile-version = null
loglevel = "notice"
logs-max = 10
; long = false ; overridden by cli
maxsockets = 15
message = "%s"
metrics-registry = "https://registry.npmjs.org/"
node-options = null
node-version = "v16.15.0"
noproxy = [""]
npm-version = "8.5.5"
offline = false
omit = []
only = null
optional = null
otp = null
pack-destination = "."
package = []
package-lock = true
package-lock-only = false
parseable = false
prefer-offline = false
prefer-online = false
prefix = "C:\\Users\\ganes\\OneDrive\\Documents\\binaries\\node"
preid = ""
production = null
progress = true
proxy = null
read-only = false
rebuild-bundle = true
registry = "https://registry.npmjs.org/"
save = true
save-bundle = false
save-dev = false
save-exact = false
save-optional = false
save-peer = false
save-prefix = "^"
save-prod = false
scope = ""
script-shell = null
searchexclude = ""
searchlimit = 20
searchopts = ""
searchstaleness = 900
shell = "C:\\Windows\\system32\\cmd.exe"
shrinkwrap = true
sign-git-commit = false
sign-git-tag = false
sso-poll-frequency = 500
sso-type = "oauth"
strict-peer-deps = false
strict-ssl = true
tag = "latest"
tag-version-prefix = "v"
timing = false
tmp = "C:\\Users\\ganes\\AppData\\Local\\Temp"
umask = 0
unicode = true
update-notifier = true
usage = false
user-agent = "npm/{npm-version} node/{node-version} {platform} {arch} workspaces/{workspaces} {ci}"
userconfig = "C:\\Users\\ganes\\.npmrc"
version = false
versions = false
viewer = "browser"
which = null
workspace = []
workspaces = null
yes = null

; "cli" config from command line options

long = true
```


## Rationale and Alternatives

NA


## Implementation


Add documentation to redirect installation of one package(a.js) when installing another(b.js) package.


## Prior Art

NA


## Unresolved Questions and Bikeshedding

NA

