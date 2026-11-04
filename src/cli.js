#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { parseBerryMark, formatStructuralPreview } from './parser.js'

const [command, filename] = process.argv.slice(2)
if (!['check', 'preview', 'json'].includes(command) || !filename) {
  console.error('Usage: node src/cli.js <check|preview|json> <source.berry.md>')
  process.exitCode = 2
} else {
  try {
    const source = await readFile(filename, 'utf8')
    const result = parseBerryMark(source, { filename })
    if (command === 'json') console.log(JSON.stringify(result, null, 2))
    else if (command === 'preview') console.log(formatStructuralPreview(result))
    else {
      console.log(`BerryMark experimental syntax check: ${result.ok ? 'OK' : 'FAILED'} — ${result.document.screens.length} screen(s), ${result.diagnostics.length} error(s)`)
      for (const d of result.diagnostics) console.log(`${filename}:${d.line}:${d.column} ${d.code} ${d.message}`)
      console.log('This is NOT YAML validation, Sanity import, or publication approval.')
    }
    if (!result.ok) process.exitCode = 1
  } catch (error) {
    console.error(`Cannot read BerryMark source: ${error.message}`)
    process.exitCode = 2
  }
}
