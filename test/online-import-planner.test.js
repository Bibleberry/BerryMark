import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compileBerryMark } from '../src/compiler.js'
import { planBerryMarkImport } from '../src/import-planner.js'
import { resolveBerryMarkOnlineImport } from '../src/online-import-planner.js'

const schemaSnapshot = JSON.parse(readFileSync(new URL('./bibleberry-schema-v0.1.snapshot.json', import.meta.url), 'utf8'))
const rejoiceSource = readFileSync(new URL('../examples/rejoice-always/rejoice-always.berry.md', import.meta.url), 'utf8')
const source = rejoiceSource
  .replace('series: null', 'series: bibleberry-development-tests')
  .replace('sequence: null', 'sequence: 2')
const compilation = compileBerryMark(source, { filename: 'scenario.berry.md' })
const offlineReport = planBerryMarkImport({ compilation, source, schemaSnapshot })
const clone = value => JSON.parse(JSON.stringify(value))
const publishedSeries = { _id: 'series-published-id', _rev: 'series-rev', title: 'Bibleberry Development Tests', slug: 'bibleberry-development-tests' }
const complete = (documents = []) => ({ status: 'complete', documents })
const failed = (code = 'BM_IMPORT_LOOKUP_FAILED') => ({ status: 'failed', error: { code, message: 'Safe synthetic lookup failure' } })
const lookup = (overrides = {}) => ({
  series: complete([publishedSeries]),
  challenges: complete(),
  sequence: complete(),
  candidateSequence: 2,
  ...overrides
})
const resolve = (lookupResults = lookup(), offline = offlineReport, expectedPreviousSourceSha256) => resolveBerryMarkOnlineImport({ offlineReport: offline, lookupResults, expectedPreviousSourceSha256 })

function provenanceDraft(overrides = {}) {
  return {
    _id: offlineReport.proposedIdentity.draftId,
    _rev: 'draft-rev',
    slug: offlineReport.proposedIdentity.slug,
    editorialReview: { adaptationReviewed: false },
    blockReviewStates: [{ _type: 'comparisonBlock', reviewStatus: 'proposed' }],
    importProvenance: {
      sourceSystem: 'berrymark',
      canonicalId: offlineReport.proposedIdentity.canonicalId,
      sourceSha256: offlineReport.source.sha256,
      lastImportedContentSha256: 'imported-content-hash'
    },
    ...overrides
  }
}

test('offline scenario fixture remains source-verified and locally eligible', () => {
  assert.equal(offlineReport.structuralValid, true, JSON.stringify(offlineReport.errors))
  assert.equal(offlineReport.sourceVerification.verified, true)
  assert.equal(offlineReport.importEligible, true)
  assert.equal(offlineReport.proposedAction, 'unknown')
})

test('Scenario A resolves exactly one published series by its real document ID', () => {
  const report = resolve()
  assert.equal(report.proposedAction, 'create', JSON.stringify(report.errors))
  assert.equal(report.onlineResolution.series._id, 'series-published-id')
  assert.equal(report.lookup.series.state, 'published')
  assert.equal(report.writesAttempted, 0)
})

test('Scenario B distinguishes a draft-only series without resolving a published reference', () => {
  const report = resolve(lookup({ series: complete([{ ...publishedSeries, _id: 'drafts.series-published-id' }]) }))
  assert.equal(report.lookup.series.state, 'draft-only')
  assert.equal(report.onlineResolution.series, null)
  assert.equal(report.proposedAction, 'create')
  assert.ok(report.warnings.some(item => item.code === 'BM_IMPORT_SERIES_DRAFT_ONLY'))
})

test('a missing series stays visibly unresolved under the incomplete-draft policy', () => {
  const report = resolve(lookup({ series: complete(), sequence: { status: 'not-required', documents: [] } }))
  assert.equal(report.lookup.series.state, 'missing')
  assert.equal(report.proposedAction, 'create')
  assert.ok(report.unresolvedLookups.some(item => item.seriesState === 'missing'))
})

test('multiple or mixed series variants conflict without choosing an ID', () => {
  for (const documents of [
    [publishedSeries, { ...publishedSeries, _id: 'series-other' }],
    [publishedSeries, { ...publishedSeries, _id: 'drafts.series-published-id' }],
    [{ ...publishedSeries, _id: 'versions.release.series-published-id' }]
  ]) {
    const report = resolve(lookup({ series: complete(documents), sequence: { status: 'not-required', documents: [] } }))
    assert.equal(report.proposedAction, 'reject')
    assert.equal(report.onlineResolution.series, null)
    assert.ok(report.conflicts.some(item => item.code === 'BM_IMPORT_SERIES_CONFLICT'))
  }
})

test('a matching deterministic draft with verified unchanged provenance is a no-op', () => {
  const draft = provenanceDraft({ contentVerification: { status: 'verified-unchanged', currentContentSha256: 'imported-content-hash' } })
  const report = resolve(lookup({ challenges: complete([draft]) }))
  assert.equal(report.proposedAction, 'none', JSON.stringify(report.errors))
  assert.equal(report.importEligible, true)
  assert.equal(report.onlineResolution.contentVerification, 'verified-unchanged')
})

test('a failed required series lookup prevents an otherwise eligible no-op', () => {
  const draft = provenanceDraft({ contentVerification: { status: 'verified-unchanged', currentContentSha256: 'imported-content-hash' } })
  const report = resolve(lookup({
    series: failed('BM_IMPORT_LOOKUP_TIMEOUT'),
    challenges: complete([draft]),
    sequence: { status: 'not-required' }
  }))
  assert.equal(report.proposedAction, 'unknown')
  assert.equal(report.importEligible, false)
  assert.equal(report.lookup.status, 'failed')
  assert.ok(report.errors.some(item => item.code === 'BM_IMPORT_LOOKUP_TIMEOUT' && item.path === 'lookup.series'))
})

test('same-source deterministic draft without current-content evidence remains unknown', () => {
  const report = resolve(lookup({ challenges: complete([provenanceDraft()]) }))
  assert.equal(report.proposedAction, 'unknown')
  assert.equal(report.importEligible, false)
  assert.ok(report.unresolvedLookups.some(item => item.type === 'currentImportedContentVerification'))
})

test('published canonical identity always conflicts and is never updated', () => {
  const report = resolve(lookup({ challenges: complete([{ _id: offlineReport.proposedIdentity.canonicalId, slug: offlineReport.proposedIdentity.slug }]) }))
  assert.equal(report.proposedAction, 'reject')
  assert.ok(report.conflicts.some(item => item.code === 'BM_IMPORT_ID_CONFLICT'))
})

test('Scenario C rejects the same Rejoice Always slug under a manual draft ID', () => {
  const report = resolve(lookup({ challenges: complete([{ _id: 'drafts.manual-rejoice-always', slug: offlineReport.proposedIdentity.slug }]) }))
  assert.equal(report.proposedAction, 'reject')
  assert.ok(report.conflicts.some(item => item.code === 'BM_IMPORT_DUPLICATE_SLUG'))
  assert.equal(report.provenanceChanges.sanityMutationsAttempted, false)
})

test('an existing deterministic manual draft without BerryMark provenance conflicts', () => {
  const draft = provenanceDraft()
  delete draft.importProvenance
  const report = resolve(lookup({ challenges: complete([draft]) }))
  assert.equal(report.proposedAction, 'reject')
  assert.ok(report.conflicts.some(item => item.code === 'BM_IMPORT_ID_CONFLICT'))
})

test('sequence collisions reject create and identify the conflicting documents', () => {
  const report = resolve(lookup({ sequence: complete([{ _id: 'another-challenge', sequence: 2, seriesId: 'series-published-id' }]) }))
  assert.equal(report.proposedAction, 'reject')
  assert.ok(report.conflicts.some(item => item.code === 'BM_IMPORT_SEQUENCE_COLLISION' && item.documentIds[0] === 'another-challenge'))
})

test('failed sequence lookup cannot be interpreted as no collision', () => {
  const report = resolve(lookup({ sequence: failed() }))
  assert.equal(report.proposedAction, 'unknown')
  assert.equal(report.lookup.status, 'failed')
  assert.equal(report.importEligible, false)
})

test('revised source requires exact previous digest and unchanged unapproved content', () => {
  const draft = provenanceDraft({
    importProvenance: {
      sourceSystem: 'berrymark', canonicalId: offlineReport.proposedIdentity.canonicalId,
      sourceSha256: 'previous-source', lastImportedContentSha256: 'imported-content-hash'
    },
    contentVerification: { status: 'verified-unchanged', currentContentSha256: 'imported-content-hash' }
  })
  const report = resolve(lookup({ challenges: complete([draft]) }), offlineReport, 'previous-source')
  assert.equal(report.proposedAction, 'update', JSON.stringify(report.errors))
  const missing = resolve(lookup({ challenges: complete([draft]) }))
  assert.equal(missing.proposedAction, 'reject')
  assert.ok(missing.conflicts.some(item => item.code === 'BM_IMPORT_REVISION_CONFLICT'))
})

test('approved or reviewed drafts cannot be revised through the online plan', () => {
  const draft = provenanceDraft({
    importProvenance: { sourceSystem: 'berrymark', canonicalId: offlineReport.proposedIdentity.canonicalId, sourceSha256: 'previous-source', lastImportedContentSha256: 'hash' },
    editorialReview: { adaptationReviewed: true, reviewedAt: '2026-11-01T00:00:00Z' }
  })
  const report = resolve(lookup({ challenges: complete([draft]) }), offlineReport, 'previous-source')
  assert.equal(report.proposedAction, 'reject')
  assert.ok(report.conflicts.some(item => item.code === 'BM_IMPORT_APPROVED_DRAFT_CONFLICT'))
})

test('missing or incomplete editorial review evidence cannot permit update', () => {
  const draft = provenanceDraft({
    importProvenance: {
      sourceSystem: 'berrymark', canonicalId: offlineReport.proposedIdentity.canonicalId,
      sourceSha256: 'previous-source', lastImportedContentSha256: 'imported-content-hash'
    },
    contentVerification: { status: 'verified-unchanged', currentContentSha256: 'imported-content-hash' }
  })
  const missingEditorialReview = clone(draft)
  delete missingEditorialReview.editorialReview
  const incompleteReviewEvidence = [
    missingEditorialReview,
    { ...draft, editorialReview: {} },
    { ...draft, blockReviewStates: [{ _type: 'comparisonBlock' }] }
  ]
  for (const candidate of incompleteReviewEvidence) {
    const report = resolve(lookup({ challenges: complete([candidate]) }), offlineReport, 'previous-source')
    assert.equal(report.proposedAction, 'reject')
    assert.equal(report.importEligible, false)
    assert.ok(report.conflicts.some(item => item.code === 'BM_IMPORT_APPROVED_DRAFT_CONFLICT'))
  }
})

test('authentication failure and incomplete lookups return unknown, never create', () => {
  for (const lookupResults of [
    { series: failed('BM_IMPORT_AUTH_REQUIRED'), challenges: failed('BM_IMPORT_AUTH_REQUIRED'), sequence: { status: 'not-required' } },
    { series: complete([publishedSeries]), challenges: { status: 'complete' }, sequence: complete(), candidateSequence: 2 },
    lookup({ series: { status: 'not-required' } }),
    lookup({ sequence: { status: 'not-required' } }),
    null
  ]) {
    const report = resolve(lookupResults)
    assert.equal(report.proposedAction, 'unknown')
    assert.equal(report.importEligible, false)
    assert.equal(report.lookup.status, 'failed')
  }
})

test('malformed and duplicate-ID lookup records fail closed with safe diagnostics', () => {
  for (const challenges of [complete([{}]), complete([{ _id: 'same' }, { _id: 'same' }]), complete('not-an-array')]) {
    const report = resolve(lookup({ challenges }))
    assert.equal(report.proposedAction, 'unknown')
    assert.ok(report.errors.some(item => ['BM_IMPORT_MALFORMED_RESPONSE', 'BM_IMPORT_LOOKUP_INCOMPLETE'].includes(item.code)))
  }
})

test('online reports preserve the original offline evidence and editorial safeguards', () => {
  const before = clone(offlineReport)
  const report = resolve()
  assert.equal(report.sourceVerification.verified, true)
  assert.equal(report.unresolvedEditorialDecisions.length, offlineReport.unresolvedEditorialDecisions.length)
  assert.equal(report.informationalEditorialNotes.length, offlineReport.informationalEditorialNotes.length)
  assert.equal(report.provenanceChanges.approvalTransferred, false)
  assert.equal(report.provenanceChanges.freshWriteAuthorizationGranted, false)
  assert.deepEqual(offlineReport, before)
})

test('offline rejection and missing local eligibility stop before online classification', () => {
  const rejected = { ...clone(offlineReport), proposedAction: 'reject' }
  assert.equal(resolve(lookup(), rejected).lookup.status, 'not-run')
  const noRights = { ...clone(offlineReport), importEligible: false }
  const report = resolve(lookup(), noRights)
  assert.equal(report.lookup.status, 'not-run')
  assert.equal(report.proposedAction, 'unknown')
})

test('identical injected lookups produce byte-identical deterministic reports', () => {
  const input = lookup()
  const first = resolve(input)
  const second = resolve(clone(input))
  assert.deepEqual(first, second)
  assert.equal(JSON.stringify(first), JSON.stringify(second))
})

test('online resolver performs no network access or writes', () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => { throw new Error('Network forbidden in pure resolver') }
  try {
    const report = resolve()
    assert.equal(report.writesAttempted, 0)
    assert.equal(report.provenanceChanges.sanityMutationsAttempted, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})
