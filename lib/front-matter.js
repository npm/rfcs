'use strict'

const YAML = require('yaml')

const DELIM = '---'

const KEY_ORDER = [
  'title',
  'number',
  'status',
  'created',
  'accepted_at',
  'implemented_at',
  'withdrawn_at',
  'implementation',
]

function parse (text) {
  if (typeof text !== 'string') {
    throw new TypeError('parse() expects a string')
  }
  const normalized = text.replace(/^\uFEFF/, '')
  const lines = normalized.split('\n')
  if (lines[0]?.trim() !== DELIM) {
    return { data: null, body: normalized }
  }
  let end = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === DELIM) {
      end = i
      break
    }
  }
  if (end === -1) {
    return { data: null, body: normalized }
  }
  const yamlText = lines.slice(1, end).join('\n')
  const body = lines.slice(end + 1).join('\n')
  let data
  try {
    data = YAML.parse(yamlText) ?? {}
  } catch (err) {
    const e = new Error(`Invalid YAML front-matter: ${err.message}`)
    e.cause = err
    throw e
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Front-matter must be a YAML mapping')
  }
  return { data, body }
}

function stringify (data, body = '') {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('stringify() expects a plain object as data')
  }
  const ordered = {}
  for (const key of KEY_ORDER) {
    if (key in data) {
      ordered[key] = data[key]
    }
  }
  for (const key of Object.keys(data)) {
    if (!(key in ordered)) {
      ordered[key] = data[key]
    }
  }
  const yamlText = YAML.stringify(ordered, {
    nullStr: 'null',
    lineWidth: 0,
  }).replace(/\n$/, '')
  const trailingBody = body.startsWith('\n') ? body : `\n${body}`
  return `${DELIM}\n${yamlText}\n${DELIM}${trailingBody}`
}

function update (text, patch) {
  const { data, body } = parse(text)
  const merged = { ...(data ?? {}), ...patch }
  return stringify(merged, body)
}

module.exports = {
  DELIM,
  KEY_ORDER,
  parse,
  stringify,
  update,
}
