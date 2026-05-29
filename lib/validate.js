'use strict'

const fs = require('node:fs')
const path = require('node:path')

const rfc = require('./rfc.js')
const frontMatter = require('./front-matter.js')

const REQUIRED_KEYS = [
  'title',
  'number',
  'status',
  'created',
  'accepted_at',
  'implemented_at',
  'withdrawn_at',
  'implementation',
]

const REQUIRED_SECTIONS = {
  proposed: ['Summary', 'Motivation', 'Detailed Explanation', 'Rationale and Alternatives'],
  accepted: ['Summary', 'Motivation', 'Detailed Explanation', 'Rationale and Alternatives', 'Implementation'],
  implemented: ['Summary', 'Motivation', 'Detailed Explanation', 'Rationale and Alternatives', 'Implementation'],
  withdrawn: ['Summary', 'Motivation', 'Detailed Explanation', 'Rationale and Alternatives'],
}

const PLACEHOLDER_RE = /\{\{[^}]+\}\}/

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validateFile (absPath, { repoRoot } = {}) {
  const errors = []
  const warnings = []
  const relPath = repoRoot ? path.relative(repoRoot, absPath) : absPath
  const basename = path.basename(absPath)
  const folder = path.basename(path.dirname(absPath))

  if (!rfc.STATUS_FOLDERS.includes(folder)) {
    errors.push(`${relPath}: file is not in a recognized RFC folder (accepted/, implemented/, withdrawn/)`)
    return { errors, warnings, relPath }
  }

  if (basename === rfc.TEMPLATE_BASENAME) {
    return validateTemplate(absPath, { repoRoot, folder, relPath })
  }

  const parsedName = rfc.parseFilename(basename)
  if (!parsedName) {
    errors.push(`${relPath}: filename must match NNNN-kebab-name.md (e.g. 0050-some-name.md)`)
    return { errors, warnings, relPath }
  }

  const text = fs.readFileSync(absPath, 'utf8')
  let parsed
  try {
    parsed = frontMatter.parse(text)
  } catch (err) {
    errors.push(`${relPath}: ${err.message}`)
    return { errors, warnings, relPath }
  }

  const { data, body } = parsed
  const isProposal = parsedName.number === 0

  if (!data) {
    if (isProposal) {
      warnings.push(`${relPath}: missing YAML front-matter. The ratify bot will synthesize it from your \`# Title\` heading on merge. To preview/customize, copy the block from \`accepted/0000-template.md\`.`)
      return { errors, warnings, relPath }
    }
    errors.push(`${relPath}: missing YAML front-matter (file must start with a \`---\` block)`)
    return { errors, warnings, relPath }
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in data)) {
      errors.push(`${relPath}: front-matter missing required key \`${key}\``)
    }
  }

  if (typeof data.title !== 'string' || data.title.trim() === '' || /\{\{/.test(data.title)) {
    errors.push(`${relPath}: \`title\` must be a non-empty string with no \`{{…}}\` placeholders`)
  }

  if (!rfc.STATUSES.includes(data.status)) {
    errors.push(`${relPath}: \`status\` must be one of ${rfc.STATUSES.join(', ')} (got ${JSON.stringify(data.status)})`)
  }

  const expectedFolder = data.status ? rfc.folderForStatus(data.status) : null
  if (expectedFolder && expectedFolder !== folder) {
    errors.push(`${relPath}: status \`${data.status}\` should live in \`${expectedFolder}/\` but file is in \`${folder}/\``)
  }

  if (data.status === 'proposed') {
    if (data.number !== null && data.number !== 0) {
      errors.push(`${relPath}: proposed RFC must have \`number: null\` (or 0); filename should be 0000-*.md`)
    }
    if (parsedName.number !== 0) {
      errors.push(`${relPath}: proposed RFC filename must start with 0000- (got ${rfc.paddedNumber(parsedName.number)}-)`)
    }
  } else {
    if (!Number.isInteger(data.number) || data.number <= 0) {
      errors.push(`${relPath}: ratified RFC must have a positive integer \`number\` (got ${JSON.stringify(data.number)})`)
    } else if (data.number !== parsedName.number) {
      errors.push(`${relPath}: front-matter \`number: ${data.number}\` does not match filename number ${rfc.paddedNumber(parsedName.number)}`)
    }
  }

  for (const key of ['created', 'accepted_at', 'implemented_at', 'withdrawn_at']) {
    const v = data[key]
    if (v === null || v === undefined) {
      continue
    }
    if (typeof v !== 'string' || !ISO_DATE_RE.test(v)) {
      errors.push(`${relPath}: \`${key}\` must be null or an ISO date (YYYY-MM-DD); got ${JSON.stringify(v)}`)
    }
  }

  if (data.status === 'accepted' && !data.accepted_at) {
    warnings.push(`${relPath}: status is \`accepted\` but \`accepted_at\` is unset`)
  }
  if (data.status === 'implemented' && !data.implemented_at) {
    warnings.push(`${relPath}: status is \`implemented\` but \`implemented_at\` is unset`)
  }
  if (data.status === 'withdrawn' && !data.withdrawn_at) {
    warnings.push(`${relPath}: status is \`withdrawn\` but \`withdrawn_at\` is unset`)
  }

  const placeholder = body.match(PLACEHOLDER_RE)
  if (placeholder) {
    const msg = `${relPath}: body still contains template placeholder ${JSON.stringify(placeholder[0])} — fill it in or remove the section`
    if (data.status === 'proposed') {
      errors.push(msg)
    } else {
      warnings.push(msg)
    }
  }

  const requiredSections = REQUIRED_SECTIONS[data.status] ?? REQUIRED_SECTIONS.accepted
  const headings = extractHeadings(body)
  for (const section of requiredSections) {
    if (!headings.includes(section)) {
      const msg = `${relPath}: missing required section \`## ${section}\``
      if (data.status === 'proposed') {
        errors.push(msg)
      } else {
        warnings.push(msg)
      }
    }
  }

  if (data.status === 'withdrawn') {
    if (!/^# Withdrawal Amendment/m.test(body)) {
      warnings.push(`${relPath}: withdrawn RFC missing \`# Withdrawal Amendment\` section — the transition bot adds a scaffold, but legacy files may need backfill`)
    }
  }

  return { errors, warnings, relPath }
}

function validateTemplate (absPath, { folder, relPath }) {
  const errors = []
  const warnings = []
  const text = fs.readFileSync(absPath, 'utf8')
  let parsed
  try {
    parsed = frontMatter.parse(text)
  } catch (err) {
    errors.push(`${relPath}: ${err.message}`)
    return { errors, warnings, relPath }
  }
  const { data } = parsed
  if (!data) {
    errors.push(`${relPath}: template must include front-matter so authors start with the right shape`)
    return { errors, warnings, relPath }
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in data)) {
      errors.push(`${relPath}: template front-matter missing required key \`${key}\``)
    }
  }
  const expectedStatus = folder === 'withdrawn' ? 'withdrawn' : 'proposed'
  if (data.status !== expectedStatus) {
    errors.push(`${relPath}: template \`status\` should be \`${expectedStatus}\` (got ${JSON.stringify(data.status)})`)
  }
  return { errors, warnings, relPath }
}

function extractHeadings (body) {
  const headings = []
  for (const line of body.split('\n')) {
    const m = line.match(/^##\s+(.+?)\s*$/)
    if (m) {
      headings.push(m[1].trim())
    }
  }
  return headings
}

function validateRepo (repoRoot) {
  const allErrors = []
  const allWarnings = []
  const seenNumbers = new Map()

  for (const rfcEntry of rfc.listRfcs(repoRoot, { includeTemplates: true })) {
    const result = validateFile(rfcEntry.absPath, { repoRoot })
    allErrors.push(...result.errors)
    allWarnings.push(...result.warnings)

    if (rfcEntry.basename === rfc.TEMPLATE_BASENAME) {
      continue
    }
    if (!rfcEntry.parsed || rfcEntry.parsed.number === 0) {
      continue
    }
    const n = rfcEntry.parsed.number
    if (seenNumbers.has(n)) {
      allErrors.push(
        `duplicate RFC number ${rfc.paddedNumber(n)}: ${seenNumbers.get(n)} and ${rfcEntry.relPath}`
      )
    } else {
      seenNumbers.set(n, rfcEntry.relPath)
    }
  }

  return { errors: allErrors, warnings: allWarnings }
}

module.exports = {
  REQUIRED_KEYS,
  REQUIRED_SECTIONS,
  validateFile,
  validateRepo,
}
