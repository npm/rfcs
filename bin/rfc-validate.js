#!/usr/bin/env node
'use strict'

const path = require('node:path')
const validate = require('../lib/validate.js')

const repoRoot = path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const fileArgs = args.filter(a => !a.startsWith('--'))
const flags = new Set(args.filter(a => a.startsWith('--')))

const { errors: fileErrors, warnings: fileWarnings } = fileArgs.length
  ? collectForFiles(fileArgs)
  : validate.validateRepo(repoRoot)

for (const w of fileWarnings) {
  console.warn(`warning: ${w}`)
}
for (const e of fileErrors) {
  console.error(`error: ${e}`)
}

if (fileErrors.length) {
  console.error(`\nrfc-validate: ${fileErrors.length} error(s), ${fileWarnings.length} warning(s)`)
  process.exit(1)
}

if (flags.has('--quiet')) {
  process.exit(0)
}
console.log(`rfc-validate: OK (${fileWarnings.length} warning(s))`)

function collectForFiles (files) {
  const errors = []
  const warnings = []
  for (const f of files) {
    const abs = path.resolve(repoRoot, f)
    const result = validate.validateFile(abs, { repoRoot })
    errors.push(...result.errors)
    warnings.push(...result.warnings)
  }
  return { errors, warnings }
}
