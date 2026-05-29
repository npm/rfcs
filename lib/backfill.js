'use strict'

const fs = require('node:fs')

const rfc = require('./rfc.js')
const frontMatter = require('./front-matter.js')
const { WITHDRAWAL_AMENDMENT_SCAFFOLD } = require('./transition.js')

function plan (repoRoot) {
  const entries = []
  const seenNumbers = new Map()
  const conflicts = []

  for (const entry of rfc.listRfcs(repoRoot, { includeTemplates: true })) {
    const isTemplate = entry.basename === rfc.TEMPLATE_BASENAME
    const result = {
      relPath: entry.relPath,
      absPath: entry.absPath,
      folder: entry.folder,
      isTemplate,
      action: 'skip',
      reason: '',
      proposedFrontMatter: null,
      proposedBody: null,
    }

    let parsed
    try {
      const text = fs.readFileSync(entry.absPath, 'utf8')
      parsed = frontMatter.parse(text)
    } catch (err) {
      result.action = 'error'
      result.reason = `Failed to parse: ${err.message}`
      entries.push(result)
      continue
    }

    if (!isTemplate) {
      if (!entry.parsed) {
        result.action = 'error'
        result.reason = `filename does not match NNNN-kebab-name.md`
        entries.push(result)
        continue
      }
      const num = entry.parsed.number
      if (num !== 0) {
        if (seenNumbers.has(num)) {
          conflicts.push({ number: num, files: [seenNumbers.get(num), entry.relPath] })
        } else {
          seenNumbers.set(num, entry.relPath)
        }
      }
    }

    if (parsed.data) {
      result.action = 'skip'
      result.reason = 'already has front-matter'
      entries.push(result)
      continue
    }

    const number = isTemplate ? null : entry.parsed.number
    const title = isTemplate
      ? '{{TITLE: a human-readable title for this RFC!}}'
      : (rfc.extractTitle(parsed.body, { withdrawn: entry.folder === 'withdrawn' })
        ?? rfc.deriveTitleFromSlug(entry.parsed.slug))

    const status = isTemplate
      ? (entry.folder === 'withdrawn' ? 'withdrawn' : 'proposed')
      : rfc.statusFromFolder(entry.folder, number)

    const data = { ...rfc.DEFAULT_FRONT_MATTER, title, status }
    if (!isTemplate && number > 0) {
      data.number = number
    }

    let body = parsed.body
    if (!isTemplate && entry.folder === 'withdrawn' && !/^# Withdrawal Amendment/m.test(body)) {
      const trimmed = body.replace(/^\n+/, '')
      body = `\n${WITHDRAWAL_AMENDMENT_SCAFFOLD}\n${trimmed}`
    }

    result.action = 'write'
    result.proposedFrontMatter = data
    result.proposedBody = body
    entries.push(result)
  }

  return { entries, conflicts }
}

function apply (repoRoot, { dryRun = false } = {}) {
  const result = plan(repoRoot)
  const errors = result.entries.filter(e => e.action === 'error')
  if (errors.length > 0 || result.conflicts.length > 0) {
    return { ...result, applied: 0, dryRun }
  }
  if (dryRun) {
    return { ...result, applied: 0, dryRun }
  }
  let applied = 0
  for (const entry of result.entries) {
    if (entry.action !== 'write') {
      continue
    }
    rfc.writeRfc(entry.absPath, entry.proposedFrontMatter, entry.proposedBody)
    applied++
  }
  return { ...result, applied, dryRun }
}

module.exports = {
  plan,
  apply,
}
