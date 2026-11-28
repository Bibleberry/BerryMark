import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { compileBerryMark } from '../src/compiler.js'
import { openBerryMarkDocument } from '../src/studio/document-engine.js'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))

test('synthetic Studio demonstration constructs, validates, compiles, and reopens all nine blocks', () => {
  const output = execFileSync(process.execPath, ['examples/studio-document-engine-demo.js'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  })
  const demonstration = JSON.parse(output)
  const filename = 'examples/studio-document-engine-demo.berry.md'
  const document = openBerryMarkDocument(demonstration.source, { filename })
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
  assert.equal(document.serialize(), demonstration.source)
  assert.deepEqual(document.listScreens()[0].blocks.map(block => block.type), [
    'CB1', 'CB2', 'CB3', 'CB4', 'CB5', 'CB6', 'CB7', 'CB8', 'CB9'
  ])
  assert.equal(demonstration.compilation.ok, true)
  assert.deepEqual(compileBerryMark(document.serialize(), { filename }), demonstration.compilation)
  assert.equal(
    openBerryMarkDocument(document.serialize(), { filename, reviewState: demonstration.reviewState }).serialize(),
    demonstration.source
  )
})
