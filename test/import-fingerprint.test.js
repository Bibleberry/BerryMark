import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compileBerryMark } from '../src/compiler.js'
import {
  IMPORT_CONTENT_FINGERPRINT_VERSION,
  candidateSha256,
  lastImportedContentSha256,
  projectCandidateImportContent,
  projectSanityDraftImportContent
} from '../src/import-fingerprint.js'

const schemaSnapshot = JSON.parse(readFileSync(new URL('./bibleberry-schema-v0.1.snapshot.json', import.meta.url), 'utf8'))
const allBlocksSource = readFileSync(new URL('../examples/compiler-all-blocks.berry.md', import.meta.url), 'utf8')
const rejoiceSource = readFileSync(new URL('../examples/rejoice-always/rejoice-always.berry.md', import.meta.url), 'utf8')
const allBlocks = JSON.parse(readFileSync(new URL('../examples/compiler-all-blocks.compiled.json', import.meta.url), 'utf8'))
const rejoice = JSON.parse(readFileSync(new URL('../examples/rejoice-always/rejoice-always.compiled.json', import.meta.url), 'utf8'))
const clone = value => JSON.parse(JSON.stringify(value))

function storedDocument(compilation) {
  return {
    ...clone(compilation.sanityCandidate),
    _id: 'drafts.synthetic',
    _rev: 'revision-one',
    _createdAt: '2026-01-01T00:00:00Z',
    _updatedAt: '2026-01-01T00:00:00Z',
    series: { _type: 'reference', _ref: 'series-id' },
    sequence: 10,
    releaseAt: '2026-02-01T00:00:00Z',
    importProvenance: {
      sourceSystem: 'berrymark',
      sourceSha256: 'source-digest',
      lastImportedContentSha256: 'previous-content-digest'
    }
  }
}

function reorderObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reorderObjectKeys)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).reverse().map(([key, nested]) => [key, reorderObjectKeys(nested)]))
}

test('fingerprint version and projections are deterministic and normalize object keys only', () => {
  const first = projectCandidateImportContent(allBlocks, schemaSnapshot)
  const reordered = clone(allBlocks)
  reordered.sanityCandidate = reorderObjectKeys(reordered.sanityCandidate)
  assert.equal(IMPORT_CONTENT_FINGERPRINT_VERSION, 'berrymark-import-content-v1')
  assert.deepEqual(projectCandidateImportContent(reordered, schemaSnapshot), first)
  assert.equal(candidateSha256(allBlocks, schemaSnapshot), candidateSha256(allBlocks, schemaSnapshot))
  assert.equal(candidateSha256(reordered, schemaSnapshot), candidateSha256(allBlocks, schemaSnapshot))
})

test('all CB1–CB9 content, keys, and primary/nested Scripture are projected', () => {
  const content = projectCandidateImportContent(allBlocks, schemaSnapshot)
  const blockTypes = content.screens.flatMap(screen => screen.blocks.map(block => block._type))
  assert.deepEqual(new Set(blockTypes), new Set([
    'richTextBlock', 'scriptureBlock', 'statementBlock', 'comparisonBlock',
    'visualCardsBlock', 'connectedSequenceBlock', 'reflectionBlock',
    'optionalStudyBlock', 'prayerBlock'
  ]))
  assert.equal(content.primaryScripture.reference, 'John 11:35')
  assert.equal(content.screens[0].blocks.find(block => block._type === 'scriptureBlock').scripture.reference, 'John 11:35')
  assert.equal(content.screens[0].blocks.find(block => block._type === 'optionalStudyBlock').scriptures.length, 2)
  assert.equal(content.editorialReview.adaptationReviewed, false)
  assert.equal(content.editorialReview.sourceTitle, 'BM-TEST Compiler Fixture')
  assert.equal(content.screens[0]._key, 'compiler-fixture-screen')
  assert.ok(content.screens[0].blocks.every(block => typeof block._key === 'string'))
})

test('equivalent Sanity content has the same digest, excluding publishing and Sanity metadata', () => {
  const draft = storedDocument(allBlocks)
  assert.deepEqual(projectSanityDraftImportContent(draft), projectCandidateImportContent(allBlocks, schemaSnapshot))
  assert.equal(lastImportedContentSha256(draft), candidateSha256(allBlocks, schemaSnapshot))
  const changedMetadata = {
    ...draft,
    _id: 'drafts.other',
    _rev: 'revision-two',
    _createdAt: '2027-01-01T00:00:00Z',
    _updatedAt: '2027-01-02T00:00:00Z',
    series: { _type: 'reference', _ref: 'another-series' },
    sequence: 999,
    releaseAt: '2030-01-01T00:00:00Z',
    anUnrelatedServerField: { arbitrary: true }
  }
  assert.equal(lastImportedContentSha256(changedMetadata), lastImportedContentSha256(draft))
})

test('review attribution and notes are excluded while conservative review state is included', () => {
  const draft = storedDocument(allBlocks)
  draft.editorialReview.reviewedBy = 'human-reviewer'
  draft.editorialReview.reviewedAt = '2026-02-02T00:00:00Z'
  draft.editorialReview.reviewNotes = 'Human-authored notes'
  assert.equal(lastImportedContentSha256(draft), candidateSha256(allBlocks, schemaSnapshot))
  draft.editorialReview.adaptationReviewed = true
  assert.notEqual(lastImportedContentSha256(draft), candidateSha256(allBlocks, schemaSnapshot))
})

test('missing and null optional fields have distinct canonical fingerprints', () => {
  const withoutSummary = storedDocument(rejoice)
  const explicitNull = { ...withoutSummary, summary: null }
  assert.notEqual(lastImportedContentSha256(withoutSummary), lastImportedContentSha256(explicitNull))
  assert.equal(Object.hasOwn(projectSanityDraftImportContent(withoutSummary), 'summary'), false)
  assert.equal(projectSanityDraftImportContent(explicitNull).summary, null)
})

test('reordering ordered content changes the digest', () => {
  const draft = storedDocument(allBlocks)
  const original = lastImportedContentSha256(draft)
  const reorderedBlocks = clone(draft)
  reorderedBlocks.screens[0].blocks.reverse()
  assert.notEqual(lastImportedContentSha256(reorderedBlocks), original)
  const reorderedCompanions = clone(draft)
  reorderedCompanions.companionLinks.reverse()
  assert.notEqual(lastImportedContentSha256(reorderedCompanions), original)
})

test('source title and reader-facing body edits change the candidate fingerprint', () => {
  const baseline = compileBerryMark(allBlocksSource)
  const titleEdit = compileBerryMark(allBlocksSource.replace('BM-TEST Complete Compiler Fixture', 'BM-TEST Edited Compiler Fixture'))
  const bodyEdit = compileBerryMark(allBlocksSource.replace('Unicode 🌿 中文', 'Unicode 🌿 中文 edited'))
  assert.equal(baseline.ok, true)
  assert.equal(titleEdit.ok, true)
  assert.equal(bodyEdit.ok, true)
  assert.notEqual(candidateSha256(baseline, schemaSnapshot), candidateSha256(titleEdit, schemaSnapshot))
  assert.notEqual(candidateSha256(baseline, schemaSnapshot), candidateSha256(bodyEdit, schemaSnapshot))
})

test('candidate and stored-document fingerprints regress on both committed manuscripts', () => {
  for (const compilation of [allBlocks, rejoice]) {
    assert.equal(
      lastImportedContentSha256(storedDocument(compilation)),
      candidateSha256(compilation, schemaSnapshot)
    )
  }
  assert.equal(rejoice.reviewReport.counts.screens, 7)
  assert.equal(rejoice.reviewReport.counts.nestedScriptures, 4)
})

test('unknown importer-owned subfields reject instead of disappearing from a projection', () => {
  const draft = storedDocument(allBlocks)
  draft.screens[0].blocks[0].body[0].injected = 'not importer-owned'
  assert.throws(() => projectSanityDraftImportContent(draft), /Unknown importer-owned field/)
  const changedCandidate = clone(allBlocks)
  changedCandidate.sanityCandidate.screens[0].blocks[0].body[0].injected = 'not importer-owned'
  assert.throws(() => candidateSha256(changedCandidate, schemaSnapshot), /invalid compiler candidate/)
})

test('candidate and Sanity metadata sidecars do not enter the content projection', () => {
  const withSidecarEdit = clone(allBlocks)
  withSidecarEdit.reviewReport.editorialItems[0].text = 'Changed external review annotation'
  assert.equal(candidateSha256(withSidecarEdit, schemaSnapshot), candidateSha256(allBlocks, schemaSnapshot))
  const document = storedDocument(allBlocks)
  document.importProvenance = { sourceSystem: 'elsewhere', unrelated: true }
  assert.equal(lastImportedContentSha256(document), candidateSha256(allBlocks, schemaSnapshot))
})

test('non-JSON values are rejected before stable serialization can collapse them', () => {
  const draft = storedDocument(allBlocks)
  draft.title = Number.NaN
  assert.throws(() => lastImportedContentSha256(draft), /not JSON-compatible/)
})
