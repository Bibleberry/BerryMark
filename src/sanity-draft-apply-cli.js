#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { basename, relative, resolve } from 'node:path'
import { runBerryMarkDraftApply } from './sanity-draft-apply.js'
import { resolveSanityDraftApplyConfig } from './sanity-draft-apply-transport.js'

function usage() {
  console.error('Usage: node src/sanity-draft-apply-cli.js <source.berry.md> [--apply --operator <operator-id>]')
  process.exitCode = 2
}

function parseArgs(args) {
  if (!args.length) return null
  const sourcePath = args[0]
  if (sourcePath.startsWith('--')) return null
  if (args.length === 1) return { sourcePath, apply: false }
  if (args.length === 4 && args[1] === '--apply' && args[2] === '--operator' && args[3] && !args[3].startsWith('--')) {
    return { sourcePath, apply: true, operator: args[3] }
  }
  return null
}

const options = parseArgs(process.argv.slice(2))
if (!options) {
  usage()
} else {
  try {
    const source = await readFile(options.sourcePath, 'utf8')
    const schemaSnapshot = JSON.parse(await readFile(new URL('../test/bibleberry-schema-v0.1.snapshot.json', import.meta.url), 'utf8'))
    const relativeName = relative(process.cwd(), resolve(options.sourcePath))
    const sourceFilename = relativeName && !relativeName.startsWith('..') ? relativeName : basename(options.sourcePath)
    const config = options.apply ? resolveSanityDraftApplyConfig() : {}
    const report = await runBerryMarkDraftApply({
      source,
      sourceFilename,
      schemaSnapshot,
      apply: options.apply,
      operator: options.operator,
      target: config.target,
      token: config.token
    })
    console.log(JSON.stringify(report, null, 2))
    if (report.proposedAction === 'reject' || report.apply.status === 'blocked-local-preflight' || report.apply.status === 'blocked-target' || report.apply.status === 'blocked-credential') process.exitCode = 1
    else if (options.apply && (report.proposedAction === 'unknown' || report.lookup.status === 'failed')) process.exitCode = 3
    else if (!['not-attempted', 'verified-noop', 'created-and-verified', 'concurrent-create-verified-noop'].includes(report.apply.status)) process.exitCode = 4
  } catch {
    console.error('Cannot read, configure, or verify the administrative draft apply input')
    process.exitCode = 2
  }
}
