#!/usr/bin/env node
'use strict'

const path = require('node:path')
const indexGen = require('../lib/index-gen.js')

const repoRoot = path.resolve(__dirname, '..')
const outPath = indexGen.write(repoRoot)
console.log(`rfc-index: wrote ${path.relative(repoRoot, outPath)}`)
