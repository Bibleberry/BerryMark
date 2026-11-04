#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { planBerryMarkImport } from './import-planner.js'

const args = process.argv.slice(2)
const artifactPath = args[0]
let sourcePath

if (args.length === 3 && args[1] === '--source') sourcePath = args[2]
else if (args.length !== 1) {
  console.error('Usage: node src/import-plan-cli.js <compiled.json> [--source <source.berry.md>]')
  process.exitCode = 2
}

if (artifactPath && (args.length === 1 || sourcePath)) {
  try {
    const schemaSnapshot = JSON.parse(await readFile(new URL('../test/bibleberry-schema-v0.1.snapshot.json', import.meta.url), 'utf8'))
    const artifactText = await readFile(artifactPath, 'utf8')
    const source = sourcePath ? await readFile(sourcePath, 'utf8') : undefined
    let compilation
    try {
      compilation = JSON.parse(artifactText)
    } catch {
      compilation = null
    }
    const report = planBerryMarkImport({ compilation, source, schemaSnapshot })
    if (compilation === null) {
      report.errors[0].message = 'The compiled input is not a valid JSON compiler result'
      process.exitCode = 2
    } else if (report.proposedAction === 'reject') process.exitCode = 1
    console.log(JSON.stringify(report, null, 2))
  } catch (error) {
    console.error(`Cannot read offline planner input: ${error.message}`)
    process.exitCode = 2
  }
}
