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
      const { errors, warnings, editorial, info } = result.summary
      console.log(`BerryMark read-only validation: ${result.ok ? 'VALID WORKING DOCUMENT' : 'FAILED'} — ${result.document.screens.length} screen(s)`)
      console.log(`Diagnostics: ${errors} error(s), ${warnings} warning(s), ${editorial} editorial item(s), ${info} info/deferred`)
      for (const d of result.diagnostics) {
        const path = d.path ? ` ${d.path}` : ''
        const target = d.target ? ` [${d.target}]` : ''
        console.log(`${d.severity.toUpperCase()} ${d.code} ${filename}:${d.line}:${d.column}${path}${target} ${d.message}`)
      }
      console.log('Syntax and supported metadata only. This is NOT Sanity import, rights verification, editorial approval, or publication readiness.')
    }
    if (!result.ok) process.exitCode = 1
  } catch (error) {
    console.error(`Cannot read BerryMark source: ${error.message}`)
    process.exitCode = 2
  }
}
