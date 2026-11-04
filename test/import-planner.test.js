import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { planBerryMarkImport } from '../src/import-planner.js'

const schemaSnapshot = JSON.parse(readFileSync(new URL('./bibleberry-schema-v0.1.snapshot.json', import.meta.url), 'utf8'))
const source = readFileSync(new URL('../examples/compiler-all-blocks.berry.md', import.meta.url), 'utf8')
const artifact = JSON.parse(readFileSync(new URL('../examples/compiler-all-blocks.compiled.json', import.meta.url), 'utf8'))
const rejoiceSource = readFileSync(new URL('../examples/rejoice-always/rejoice-always.berry.md', import.meta.url), 'utf8')
const rejoiceArtifact = JSON.parse(readFileSync(new URL('../examples/rejoice-always/rejoice-always.compiled.json', import.meta.url), 'utf8'))
const clone = value => JSON.parse(JSON.stringify(value))
const plan = (compilation = artifact, exactSource, snapshot = schemaSnapshot) => planBerryMarkImport({ compilation, source: exactSource, schemaSnapshot: snapshot })
const cliPath = fileURLToPath(new URL('../src/import-plan-cli.js', import.meta.url))
const artifactPath = fileURLToPath(new URL('../examples/compiler-all-blocks.compiled.json', import.meta.url))
const sourcePath = fileURLToPath(new URL('../examples/compiler-all-blocks.berry.md', import.meta.url))
const rejoiceArtifactPath = fileURLToPath(new URL('../examples/rejoice-always/rejoice-always.compiled.json', import.meta.url))
const runCli = args => spawnSync(process.execPath, [cliPath, ...args], { encoding: 'utf8' })

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


test('review-report tampering fails source verification even when internally plausible', () => {
  const changed = clone(artifact)
  changed.reviewReport.source.revision = 'different-revision'
  const report = plan(changed, source)
  assert.equal(report.structuralValid, true, JSON.stringify(report.errors))
  assert.equal(report.sourceVerification.verified, false)
  assert.equal(report.proposedAction, 'reject')
  assert.ok(report.errors.some(item => item.code === 'BM_IMPORT_ARTIFACT_MISMATCH'))
})

test('false readiness flags are contradictory and rejected', () => {
  for (const field of ['importReady', 'publicationReady']) {
    const changed = clone(artifact)
    changed.reviewReport[field] = true
    const report = plan(changed)
    assert.equal(report.structuralValid, false)
    assert.equal(report.proposedAction, 'reject')
  }
})

test('unknown candidate and report fields are rejected at schema boundaries', () => {
  const candidateChange = clone(artifact)
  candidateChange.sanityCandidate.unrecognized = true
  assert.equal(plan(candidateChange).structuralValid, false)
  const reportChange = clone(artifact)
  reportChange.reviewReport.unrecognized = true
  assert.equal(plan(reportChange).structuralValid, false)
})

test('unsupported block types fail without partial-import claims', () => {
  const changed = clone(artifact)
  changed.sanityCandidate.screens[0].blocks[0]._type = 'unknownBlock'
  const report = plan(changed)
  assert.equal(report.structuralValid, false)
  assert.ok(report.errors.some(item => item.code === 'BM_IMPORT_UNSUPPORTED_BLOCK'))
})

test('all CB1–CB9 and nested demonstration inventories are accepted and counted', () => {
  const report = plan(artifact, source)
  assert.equal(report.structuralValid, true, JSON.stringify(report.errors))
  assert.deepEqual(artifact.reviewReport.counts, {
    screens: 1,
    contentBlocks: 9,
    optionalStudies: 1,
    nestedScriptures: 2,
    editorialAnnotations: 1
  })
  assert.equal(new Set(artifact.sanityCandidate.screens[0].blocks.map(block => block._type)).size, 9)
  assert.ok(report.readyFields.some(field => field.path === 'screens'))
})

test('duplicate and malformed structural keys are rejected', () => {
  const duplicate = clone(artifact)
  duplicate.sanityCandidate.screens[0].blocks[1]._key = duplicate.sanityCandidate.screens[0].blocks[0]._key
  assert.match(plan(duplicate).errors.map(item => item.message).join('\n'), /Duplicate sibling _key/)
  const malformed = clone(artifact)
  malformed.sanityCandidate.screens[0].blocks[0]._key = ''
  assert.equal(plan(malformed).structuralValid, false)
})

test('Rejoice Always source verification preserves absent publishing boundaries', () => {
  const report = plan(rejoiceArtifact, rejoiceSource)
  assert.equal(report.structuralValid, true, JSON.stringify(report.errors))
  assert.equal(report.sourceVerification.verified, true)
  assert.equal(report.importEligible, true)
  assert.equal(report.proposedAction, 'unknown')
  assert.deepEqual(report.missingRequiredMetadata.map(item => [item.path, item.state]), [
    ['series', 'null'], ['sequence', 'null'], ['releaseAt', 'null']
  ])
  assert.equal(report.proposedIdentity.canonicalId, 'berrymark-challenge-2026-11-02-rejoice-always')
})

test('Rejoice Always annotations remain actionable or informational with source history', () => {
  const report = plan(rejoiceArtifact, rejoiceSource)
  assert.equal(report.unresolvedEditorialDecisions.length, 11)
  assert.equal(report.informationalEditorialNotes.length, 6)
  for (const item of [...report.unresolvedEditorialDecisions, ...report.informationalEditorialNotes]) {
    assert.equal(item.status, 'unresolved')
    assert.equal(item.sourceLocation.filename, 'examples/rejoice-always/rejoice-always.berry.md')
    assert.ok(Number.isSafeInteger(item.sourceLocation.line))
    assert.ok(item.text.length > 0)
    assert.deepEqual(item.reviewHistory, [])
  }
})

test('an explicitly actionable editorial note retains its original category and review history', () => {
  const changed = clone(rejoiceArtifact)
  changed.reviewReport.editorialItems[0].classification = 'actionable'
  changed.reviewReport.editorialItems[0].reviewHistory = [{ action: 'classified', by: 'human-reviewer' }]
  const report = plan(changed, rejoiceSource)
  assert.equal(report.structuralValid, true, JSON.stringify(report.errors))
  assert.equal(report.sourceVerification.verified, true)
  assert.equal(report.unresolvedEditorialDecisions.length, 12)
  assert.equal(report.informationalEditorialNotes.length, 5)
  const reclassified = report.unresolvedEditorialDecisions.find(item => item.originalCategory === 'EDITORIAL NOTE')
  assert.equal(reclassified.classification, 'actionable')
  assert.deepEqual(reclassified.reviewHistory, [{ action: 'classified', by: 'human-reviewer' }])
})

test('reference-only Scripture is valid without passage text or rights evidence', () => {
  const report = plan(rejoiceArtifact, rejoiceSource)
  assert.equal(report.structuralValid, true)
  assert.equal(report.unresolvedLookups.some(item => item.type === 'scriptureRightsEvidence'), false)
  assert.equal(report.warnings.some(item => item.code === 'BM_IMPORT_RIGHTS_EVIDENCE_REQUIRED'), false)
})

test('provided passage text requires independent rights evidence despite the compiler Boolean', () => {
  const report = plan(artifact, source)
  const requirements = report.unresolvedLookups.filter(item => item.type === 'scriptureRightsEvidence')
  assert.equal(requirements.length, 1)
  assert.equal(requirements[0].reference, 'Synthetic 1:1')
  assert.equal(report.warnings.some(item => item.code === 'BM_IMPORT_RIGHTS_EVIDENCE_REQUIRED'), true)
  assert.equal(report.importEligible, false)
})


test('repeated reports are deterministic and do not mutate the artifact', () => {
  const before = clone(artifact)
  const first = plan(artifact, source)
  const second = plan(artifact, source)
  assert.deepEqual(first, second)
  assert.deepEqual(artifact, before)
  assert.equal(JSON.stringify(first), JSON.stringify(second))
})

test('offline identity and duplicate checks always remain unknown', () => {
  for (const report of [plan(artifact, source), plan(rejoiceArtifact, rejoiceSource), plan(artifact)]) {
    assert.equal(report.lookup.status, 'offline')
    assert.equal(report.proposedAction, 'unknown')
    assert.ok(report.lookup.dependencies.some(item => item.type === 'challengeIdentityAndSlug'))
    assert.equal(report.conflicts.length, 0)
  }
})

test('planner performs no network access and reports zero writes', () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = () => { calls += 1; throw new Error('network forbidden') }
  try {
    const report = plan(artifact, source)
    assert.equal(report.structuralValid, true)
    assert.equal(report.writesAttempted, 0)
    assert.equal(calls, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('schema snapshot revision discrepancies require an architectural decision', () => {
  const changedSnapshot = clone(schemaSnapshot)
  changedSnapshot.revision = 'different-revision'
  const report = plan(artifact, undefined, changedSnapshot)
  assert.equal(report.structuralValid, false)
  assert.ok(report.errors.some(item => item.code === 'BM_IMPORT_SCHEMA_INCOMPATIBLE'))
})

test('metadata-state and structural-count tampering are rejected artifact-only', () => {
  const stateChange = clone(artifact)
  delete stateChange.reviewReport.metadataStates['publishing.series']
  assert.equal(plan(stateChange).structuralValid, false)
  const countChange = clone(artifact)
  countChange.reviewReport.counts.contentBlocks += 1
  assert.equal(plan(countChange).structuralValid, false)
})

test('unsafe URLs and approval transfer attempts are rejected', () => {
  const unsafe = clone(artifact)
  unsafe.sanityCandidate.companionLinks[0].url = 'javascript:alert(1)'
  assert.equal(plan(unsafe).structuralValid, false)
  const approved = clone(artifact)
  approved.sanityCandidate.editorialReview.adaptationReviewed = true
  const report = plan(approved)
  assert.equal(report.structuralValid, false)
  assert.ok(report.errors.some(item => item.code === 'BM_IMPORT_REVIEW_TRANSFER_FORBIDDEN'))
})

test('unresolved companion URLs remain visible without inventing values', () => {
  const report = plan(artifact, source)
  assert.ok(report.warnings.some(item => item.code === 'BM_COMPANION_URL_UNRESOLVED'))
  assert.equal(artifact.sanityCandidate.companionLinks[1].url, undefined)
  assert.equal(report.provenanceChanges.sourceOrArtifactRepairPerformed, false)
})

test('CLI prints a complete source-verified JSON report and exits successfully', () => {
  const result = runCli([artifactPath, '--source', sourcePath])
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.mode, 'dry-run')
  assert.equal(report.sourceVerification.verified, true)
  assert.equal(report.writesAttempted, 0)
})

test('CLI supports artifact-only inspection without implying eligibility', () => {
  const result = runCli([artifactPath])
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.sourceVerification.state, 'artifact-only')
  assert.equal(report.importEligible, false)
})

test('CLI returns nonzero for source/artifact mismatches', () => {
  const result = runCli([rejoiceArtifactPath, '--source', sourcePath])
  assert.equal(result.status, 1, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.proposedAction, 'reject')
  assert.ok(report.errors.some(item => item.code === 'BM_IMPORT_ARTIFACT_MISMATCH'))
})

test('CLI returns nonzero with structured output for malformed JSON', () => {
  const directory = mkdtempSync(join(tmpdir(), 'berrymark-plan-'))
  try {
    const malformed = join(directory, 'malformed.json')
    writeFileSync(malformed, '{not json', 'utf8')
    const result = runCli([malformed])
    assert.equal(result.status, 2, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.structuralValid, false)
    assert.equal(report.proposedAction, 'reject')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('CLI rejects unknown arguments and has no apply mode', () => {
  const result = runCli([artifactPath, '--apply'])
  assert.equal(result.status, 2)
  assert.match(result.stderr, /Usage:/)
  assert.equal(result.stdout, '')
})
