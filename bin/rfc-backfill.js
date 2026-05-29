#!/usr/bin/env node
'use strict'

const path = require('node:path')

const backfill = require('../lib/backfill.js')
const indexGen = require('../lib/index-gen.js')

const repoRoot = path.resolve(__dirname, '..')
const args = new Set(process.argv.slice(2))

const dryRun = args.has('--check') || args.has('--dry-run')
const result = backfill.apply(repoRoot, { dryRun })

const errors = result.entries.filter(e => e.action === 'error')
for (const e of errors) {
  console.error(`error: ${e.relPath}: ${e.reason}`)
}
for (const c of result.conflicts) {
  console.error(`error: duplicate number ${String(c.number).padStart(4, '0')}: ${c.files.join(', ')}`)
}

let writeCount = 0
let skipCount = 0
for (const e of result.entries) {
  if (e.action === 'write') {
    writeCount++
    console.log(`${dryRun ? 'would write' : 'wrote'}: ${e.relPath} (title: ${JSON.stringify(e.proposedFrontMatter.title)})`)
  } else if (e.action === 'skip') {
    skipCount++
  }
}

if (errors.length || result.conflicts.length) {
  console.error(`\nrfc-backfill: aborted — ${errors.length} error(s), ${result.conflicts.length} conflict(s)`)
  process.exit(1)
}

if (!dryRun && writeCount > 0) {
  indexGen.write(repoRoot)
  console.log(`rfc-backfill: regenerated INDEX.md`)
}

console.log(`rfc-backfill: ${dryRun ? 'plan' : 'done'} — ${writeCount} written, ${skipCount} skipped`)
