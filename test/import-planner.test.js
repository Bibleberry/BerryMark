import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { planBerryMarkImport } from '../src/import-planner.js'

const schemaSnapshot = JSON.parse(readFileSync(new URL('./bibleberry-schema-v0.1.snapshot.json', import.meta.url), 'utf8'))
const source = readFileSync(new URL('../examples/compiler-all-blocks.berry.md', import.meta.url), 'utf8')
const artifact = JSON.parse(readFileSync(new URL('../examples/compiler-all-blocks.compiled.json', import.meta.url), 'utf8'))
const clone = value => JSON.parse(JSON.stringify(value))
const plan = (compilation = artifact, exactSource) => planBerryMarkImport({ compilation, source: exactSource, schemaSnapshot })

test('source-verified planning reproduces the artifact and proposes stable identity', () => {
  const report = plan(artifact, source)
  assert.equal(report.structuralValid, true, JSON.stringify(report.errors))
  assert.equal(report.sourceVerification.verified, true)
  assert.equal(report.sourceVerification.independentSourceComparisonPerformed, true)
  assert.equal(report.importEligible, false, 'supplied passage text still needs independent rights evidence')
  assert.equal(report.proposedAction, 'unknown')
  assert.equal(report.proposedIdentity.canonicalId, 'berrymark-challenge-bm-test-compiler-all-blocks')
  assert.equal(report.proposedIdentity.draftId, 'drafts.berrymark-challenge-bm-test-compiler-all-blocks')
  assert.equal(report.writesAttempted, 0)
})

test('artifact-only planning is structurally useful without source or write claims', () => {
  const report = plan()
  assert.equal(report.structuralValid, true, JSON.stringify(report.errors))
  assert.equal(report.sourceVerification.state, 'artifact-only')
  assert.equal(report.sourceVerification.independentSourceComparisonPerformed, false)
  assert.equal(report.sourceVerification.verified, false)
  assert.equal(report.importEligible, false)
  assert.equal(report.proposedAction, 'unknown')
  assert.match(report.sourceVerification.note, /not performed/)
})

test('source fingerprint mismatch rejects without source normalization', () => {
  const report = plan(artifact, `${source}\n`)
  assert.equal(report.structuralValid, true)
  assert.equal(report.sourceVerification.verified, false)
  assert.equal(report.importEligible, false)
  assert.equal(report.proposedAction, 'reject')
  assert.ok(report.errors.some(item => item.code === 'BM_IMPORT_ARTIFACT_MISMATCH'))
})

test('candidate tampering is rejected by source recompilation', () => {
  const changed = clone(artifact)
  changed.sanityCandidate.title = 'Tampered title'
  const report = plan(changed, source)
  assert.equal(report.structuralValid, false)
  assert.equal(report.proposedAction, 'reject')
  assert.ok(report.errors.length > 0)
})
