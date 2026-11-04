import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compileBerryMark } from '../src/compiler.js'

for (const [sourcePath, resultPath] of [
  ['../examples/compiler-all-blocks.berry.md', '../examples/compiler-all-blocks.compiled.json'],
  ['../examples/rejoice-always/rejoice-always.berry.md', '../examples/rejoice-always/rejoice-always.compiled.json']
]) {
  test(`${sourcePath} reproduces its committed inspectable compiler result`, () => {
    const source = readFileSync(new URL(sourcePath, import.meta.url), 'utf8')
    const expected = JSON.parse(readFileSync(new URL(resultPath, import.meta.url), 'utf8'))
    const filename = sourcePath.replace('../', '')
    const actual = compileBerryMark(source, { filename })
    assert.deepEqual(actual, expected)
  })
}
