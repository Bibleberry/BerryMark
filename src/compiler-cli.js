#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { parseBerryMark } from './parser.js'
import { compileValidatedBerryMark } from './compiler.js'

const [filename] = process.argv.slice(2)
if (!filename || process.argv.length !== 3) {
  console.error('Usage: node src/compiler-cli.js <source.berry.md>')
  process.exitCode = 2
} else {
  try {
    const source = await readFile(filename, 'utf8')
    const validation = parseBerryMark(source, { filename })
    const compilation = compileValidatedBerryMark(validation, { source })
    console.log(JSON.stringify(compilation, null, 2))
    if (!compilation.ok) process.exitCode = 1
  } catch (error) {
    console.error(`Cannot read BerryMark source: ${error.message}`)
    process.exitCode = 2
  }
}
