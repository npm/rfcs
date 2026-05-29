'use strict'

const fs = require('node:fs')
const path = require('node:path')

const frontMatter = require('./front-matter.js')

const STATUSES = ['proposed', 'accepted', 'implemented', 'withdrawn']

const FOLDER_BY_STATUS = {
  proposed: 'accepted',
  accepted: 'accepted',
  implemented: 'implemented',
  withdrawn: 'withdrawn',
}

const STATUS_FOLDERS = ['accepted', 'implemented', 'withdrawn']

const TEMPLATE_BASENAME = '0000-template.md'
const RFC_FILENAME_RE = /^(\d{4})-([A-Za-z0-9][A-Za-z0-9_-]*)\.md$/

function isTemplate (file) {
  return path.basename(file) === TEMPLATE_BASENAME
}

function parseFilename (file) {
  const basename = path.basename(file)
  const match = basename.match(RFC_FILENAME_RE)
  if (!match) {
    return null
  }
  return {
    number: Number(match[1]),
    slug: match[2],
    basename,
  }
}

function listRfcs (repoRoot, { includeTemplates = false } = {}) {
  const out = []
  for (const folder of STATUS_FOLDERS) {
    const dir = path.join(repoRoot, folder)
    let entries
    try {
      entries = fs.readdirSync(dir)
    } catch (err) {
      if (err.code === 'ENOENT') {
        continue
      }
      throw err
    }
    for (const name of entries) {
      if (!name.endsWith('.md')) {
        continue
      }
      if (!includeTemplates && name === TEMPLATE_BASENAME) {
        continue
      }
      out.push({
        folder,
        basename: name,
        absPath: path.join(dir, name),
        relPath: path.posix.join(folder, name),
        parsed: parseFilename(name),
      })
    }
  }
  return out
}

function parseRfc (absPath) {
  const text = fs.readFileSync(absPath, 'utf8')
  const { data, body } = frontMatter.parse(text)
  return {
    absPath,
    relPath: path.relative(path.resolve(absPath, '..', '..'), absPath),
    data: data ?? {},
    body,
    text,
  }
}

function writeRfc (absPath, data, body) {
  const text = frontMatter.stringify(data, body)
  const ending = text.endsWith('\n') ? text : `${text}\n`
  fs.writeFileSync(absPath, ending)
}

function statusFromFolder (folder, number) {
  if (folder === 'accepted') {
    return number === 0 ? 'proposed' : 'accepted'
  }
  if (folder === 'implemented') {
    return 'implemented'
  }
  if (folder === 'withdrawn') {
    return 'withdrawn'
  }
  return null
}

function folderForStatus (status) {
  return FOLDER_BY_STATUS[status] ?? null
}

function assignedNumbers (repoRoot, { extraFiles = [] } = {}) {
  const numbers = new Set()
  for (const rfc of listRfcs(repoRoot)) {
    if (rfc.parsed && rfc.parsed.number !== 0) {
      numbers.add(rfc.parsed.number)
    }
  }
  for (const extra of extraFiles) {
    const parsed = parseFilename(extra)
    if (parsed && parsed.number !== 0) {
      numbers.add(parsed.number)
    }
  }
  return numbers
}

function nextNumber (repoRoot, { extraFiles = [], reserved = [] } = {}) {
  const taken = assignedNumbers(repoRoot, { extraFiles })
  for (const n of reserved) {
    taken.add(Number(n))
  }
  let max = 0
  for (const n of taken) {
    if (n > max) {
      max = n
    }
  }
  return max + 1
}

function paddedNumber (n) {
  return String(n).padStart(4, '0')
}

function todayIso (now = new Date()) {
  return now.toISOString().slice(0, 10)
}

const DEFAULT_FRONT_MATTER = Object.freeze({
  title: null,
  number: null,
  status: null,
  created: null,
  accepted_at: null,
  implemented_at: null,
  withdrawn_at: null,
  implementation: null,
})

function extractTitle (body, { withdrawn = false } = {}) {
  const lines = body.split('\n')
  let startIdx = 0
  if (withdrawn) {
    const amendIdx = lines.findIndex(l => /^#\s+Withdrawal Amendment\b/.test(l))
    if (amendIdx >= 0) {
      for (let j = amendIdx + 1; j < lines.length; j++) {
        if (/^#\s+/.test(lines[j])) {
          startIdx = j
          break
        }
      }
    }
  }
  for (let i = startIdx; i < lines.length; i++) {
    const m = lines[i].match(/^#\s+(.+?)\s*$/)
    if (m && !/^Withdrawal Amendment\b/i.test(m[1])) {
      return m[1].trim()
    }
  }
  return null
}

function deriveTitleFromSlug (slug) {
  return slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
}

function defaultsForFolder (folder, number) {
  const data = { ...DEFAULT_FRONT_MATTER }
  data.status = statusFromFolder(folder, number ?? 0)
  if (typeof number === 'number' && number > 0) {
    data.number = number
  }
  return data
}

module.exports = {
  STATUSES,
  STATUS_FOLDERS,
  FOLDER_BY_STATUS,
  TEMPLATE_BASENAME,
  RFC_FILENAME_RE,
  DEFAULT_FRONT_MATTER,
  isTemplate,
  parseFilename,
  listRfcs,
  parseRfc,
  writeRfc,
  statusFromFolder,
  folderForStatus,
  assignedNumbers,
  nextNumber,
  paddedNumber,
  todayIso,
  extractTitle,
  deriveTitleFromSlug,
  defaultsForFolder,
}
