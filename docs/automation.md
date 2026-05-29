# RFC automation

Instructions for maintainers. Authors only need the [README](../README.md).

## Authoring (mention to authors)

1. Copy `accepted/0000-template.md` → `accepted/0000-your-rfc.md`.
2. Fill in `title` and the body. Leave the rest of the front-matter alone.
3. Open a PR.

The bot owns `number`, `status`, dates, filename, and `INDEX.md`.

## Validate (PR check)

Runs automatically on every PR that touches `accepted/`, `implemented/`,
or `withdrawn/`. Validates only the changed files. New proposals
(`accepted/0000-*.md`) are held to the full spec; non-`proposed` files
are lenient (warnings, not errors). No action needed.

## Ratify (after merging an RFC PR)

Automatic. When an `accepted/0000-*.md` is merged to `main`, the bot:

1. Assigns the next number (`max + 1`, skipping any reserved by open bot PRs)
2. Fills `status`, `accepted_at`, `created`
3. Renames the file to `accepted/NNNN-name.md`
4. Regenerates `INDEX.md`
5. Opens `bot/rfc-ratify-NNNN-name` for review

Review and merge the bot PR like any other.

If the push trigger didn't fire (e.g. the workflow itself was broken when the
RFC was merged), re-run manually: **Actions → RFC ratify → Run workflow**
with `file` = `accepted/0000-name.md`. Same outcome as the automatic path.

## Transition (implemented / withdrawn)

Manual: **Actions → RFC transition → Run workflow**.

Inputs:

- `rfc_number` — e.g. `50`
- `status` — `implemented` or `withdrawn`
- `implementation` — optional, e.g. `npm/cli#1234` (only for `implemented`)

The bot moves the file, sets the date, scaffolds the withdrawal amendment
if applicable, regenerates `INDEX.md`, and opens
`bot/rfc-transition-NNNN-status` for review. Edit the withdrawal scaffold
in that PR before merging.

## Local commands

```sh
npm run rfc:validate                    # validate all RFCs
npm run rfc:validate -- accepted/foo.md # validate one file
npm run rfc:index                       # regenerate INDEX.md
npm run rfc:backfill                    # one-shot: add front-matter to pre-automation files
```

CLI entrypoints in `bin/` accept the same args the workflows use; see the
top of each file.
