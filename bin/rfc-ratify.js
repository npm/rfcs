#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const rfc = require('../lib/rfc.js')
const transition = require('../lib/transition.js')
const indexGen = require('../lib/index-gen.js')

const repoRoot = path.resolve(__dirname, '..')
const args = parseArgs(process.argv.slice(2))

if (!args.file && args._.length === 0) {
  fail('usage: rfc-ratify --file=<path-to-0000-*.md> [--number=N] [--today=YYYY-MM-DD]')
}

const target = path.resolve(repoRoot, args.file ?? args._[0])
if (!fs.existsSync(target)) {
  fail(`rfc-ratify: file not found: ${path.relative(repoRoot, target)}`)
}

const reserved = (args.reserved ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .map(Number)

const number = args.number
  ? Number(args.number)
  : rfc.nextNumber(repoRoot, { reserved })

const result = transition.ratify(repoRoot, target, {
  number,
  today: args.today,
})

indexGen.write(repoRoot)

console.log(`rfc-ratify: assigned #${rfc.paddedNumber(result.number)}`)
console.log(`  from: ${result.from}`)
console.log(`  to:   ${result.to}`)
if (result.synthesizedFrontMatter) {
  console.log(`  note: synthesized front-matter (file had none)`)
}
// Stable machine-readable summary line (workflows parse this).
console.log(`rfc-ratify: result number=${result.number} path=${result.to}`)

function parseArgs (argv) {
  const out = { _: [] }
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/)
    if (m) {
      out[m[1]] = m[2] ?? true
    } else {
      out._.push(a)
    }
  }
  return out
}

function fail (msg) {
  console.error(msg)
  process.exit(1)
}
