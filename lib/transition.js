'use strict'

const fs = require('node:fs')
const path = require('node:path')

const rfc = require('./rfc.js')

const WITHDRAWAL_AMENDMENT_SCAFFOLD = [
  '# Withdrawal Amendment',
  '',
  '<!-- Provide as much detail as possible as to why the originally drafted',
  'proposal no longer should be considered for implementation. -->',
  '',
  '## Relevant Resources',
  '',
  '<!-- Optional: link relevant discussions, meeting notes, or follow-up RFCs. -->',
  '',
].join('\n')

function ratify (repoRoot, absPath, {
  number,
  today = rfc.todayIso(),
} = {}) {
  const basename = path.basename(absPath)
  const folder = path.basename(path.dirname(absPath))
  if (folder !== 'accepted') {
    throw new Error(`ratify(): expected file in accepted/, got ${folder}/${basename}`)
  }
  const parsedName = rfc.parseFilename(basename)
  if (!parsedName || parsedName.number !== 0) {
    throw new Error(`ratify(): expected filename like 0000-name.md, got ${basename}`)
  }
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`ratify(): \`number\` must be a positive integer, got ${number}`)
  }

  const parsed = rfc.parseRfc(absPath)
  const existing = parsed.data ?? {}
  const synthesized = !existing || Object.keys(existing).length === 0

  const data = { ...rfc.DEFAULT_FRONT_MATTER, ...existing }
  if (!data.title) {
    data.title = rfc.extractTitle(parsed.body) ?? rfc.deriveTitleFromSlug(parsedName.slug)
  }
  data.number = number
  data.status = 'accepted'
  data.accepted_at = today
  if (!data.created) {
    data.created = today
  }

  const newBasename = `${rfc.paddedNumber(number)}-${parsedName.slug}.md`
  const newAbsPath = path.join(path.dirname(absPath), newBasename)
  const newRelPath = path.posix.join('accepted', newBasename)

  rfc.writeRfc(absPath, data, parsed.body)
  if (newAbsPath !== absPath) {
    fs.renameSync(absPath, newAbsPath)
  }

  return {
    action: 'ratify',
    from: path.relative(repoRoot, absPath),
    to: path.relative(repoRoot, newAbsPath),
    relPath: newRelPath,
    number,
    synthesizedFrontMatter: synthesized,
    data,
  }
}

function transition (repoRoot, absPath, {
  status,
  today = rfc.todayIso(),
  implementation,
} = {}) {
  if (!['implemented', 'withdrawn'].includes(status)) {
    throw new Error(`transition(): status must be implemented or withdrawn, got ${status}`)
  }
  const basename = path.basename(absPath)
  const fromFolder = path.basename(path.dirname(absPath))
  const targetFolder = rfc.folderForStatus(status)
  const parsedName = rfc.parseFilename(basename)
  if (!parsedName || parsedName.number === 0) {
    throw new Error(`transition(): file must have an assigned number (NNNN-name.md), got ${basename}`)
  }

  const parsed = rfc.parseRfc(absPath)
  const existing = parsed.data ?? {}
  const data = { ...rfc.DEFAULT_FRONT_MATTER, ...existing }
  if (!data.title) {
    data.title = rfc.extractTitle(parsed.body, { withdrawn: status === 'withdrawn' })
      ?? rfc.deriveTitleFromSlug(parsedName.slug)
  }
  if (!data.number) {
    data.number = parsedName.number
  }
  data.status = status
  if (status === 'implemented') {
    data.implemented_at = today
    if (implementation) {
      data.implementation = implementation
    }
  } else if (status === 'withdrawn') {
    data.withdrawn_at = today
  }

  let body = parsed.body
  if (status === 'withdrawn' && !/^#\s+withdrawal amendment\b/im.test(body)) {
    const trimmed = body.replace(/^\n+/, '')
    body = `\n${WITHDRAWAL_AMENDMENT_SCAFFOLD}\n${trimmed}`
  }

  const newAbsPath = path.join(repoRoot, targetFolder, basename)
  const newRelPath = path.posix.join(targetFolder, basename)

  if (newAbsPath !== absPath) {
    fs.mkdirSync(path.dirname(newAbsPath), { recursive: true })
    rfc.writeRfc(absPath, data, body)
    fs.renameSync(absPath, newAbsPath)
  } else {
    rfc.writeRfc(newAbsPath, data, body)
  }

  return {
    action: 'transition',
    fromFolder,
    toFolder: targetFolder,
    from: path.relative(repoRoot, absPath),
    to: path.relative(repoRoot, newAbsPath),
    relPath: newRelPath,
    status,
    data,
  }
}

module.exports = {
  WITHDRAWAL_AMENDMENT_SCAFFOLD,
  ratify,
  transition,
}
