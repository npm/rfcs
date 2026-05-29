#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const rfc = require('../lib/rfc.js')
const transition = require('../lib/transition.js')
const indexGen = require('../lib/index-gen.js')

const repoRoot = path.resolve(__dirname, '..')
const args = parseArgs(process.argv.slice(2))

const status = args.status
if (!['implemented', 'withdrawn'].includes(status)) {
  fail('usage: rfc-transition --number=NNNN --status=implemented|withdrawn [--implementation=npm/cli#1234] [--today=YYYY-MM-DD]')
}

let target
if (args.file) {
  target = path.resolve(repoRoot, args.file)
} else if (args.number) {
  const wanted = Number(args.number)
  const match = rfc.listRfcs(repoRoot).find(e => e.parsed?.number === wanted)
  if (!match) {
    fail(`rfc-transition: no RFC found with number ${rfc.paddedNumber(wanted)}`)
  }
  target = match.absPath
} else {
  fail('rfc-transition: provide either --number or --file')
}

if (!fs.existsSync(target)) {
  fail(`rfc-transition: file not found: ${path.relative(repoRoot, target)}`)
}

const result = transition.transition(repoRoot, target, {
  status,
  today: args.today,
  implementation: args.implementation,
})

indexGen.write(repoRoot)

console.log(`rfc-transition: ${result.fromFolder}/ -> ${result.toFolder}/  (status: ${result.status})`)
console.log(`  from: ${result.from}`)
console.log(`  to:   ${result.to}`)
if (status === 'withdrawn') {
  console.log(`  note: prepended Withdrawal Amendment scaffold if missing; please edit before merging`)
}
// Stable machine-readable summary line (workflows parse this).
console.log(`rfc-transition: result status=${result.status} path=${result.to}`)

function parseArgs (argv) {
  const out = {}
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/)
    if (m) {
      out[m[1]] = m[2] ?? true
    }
  }
  return out
}

function fail (msg) {
  console.error(msg)
  process.exit(1)
}
