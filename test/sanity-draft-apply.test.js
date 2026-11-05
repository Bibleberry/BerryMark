import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { compileBerryMark } from '../src/compiler.js'
import { planBerryMarkImport } from '../src/import-planner.js'
import { resolveBerryMarkOnlineImport } from '../src/online-import-planner.js'
import { candidateSha256, projectCandidateImportContent, projectSanityDraftImportContent } from '../src/import-fingerprint.js'
import { buildBerryMarkDraftCreateDocument, runBerryMarkDraftApply } from '../src/sanity-draft-apply.js'

const schemaSnapshot = JSON.parse(readFileSync(new URL('./bibleberry-schema-v0.1.snapshot.json', import.meta.url), 'utf8'))
const rejoiceSource = readFileSync(new URL('../examples/rejoice-always/rejoice-always.berry.md', import.meta.url), 'utf8')
const allBlocksSource = readFileSync(new URL('../examples/compiler-all-blocks.berry.md', import.meta.url), 'utf8')
const eligibleAllBlocksSource = allBlocksSource
  .replace('Text Status: provided\nPassage: Rights-safe synthetic passage written only for this fixture.\nUsage Rights Confirmed: true\nPractice Status: configured', 'Text Status: referenceOnly\nUsage Rights Confirmed: false\nPractice Status: notConfigured')
const target = { projectId: '80016lrq', dataset: 'berrymark-development', authorizedDataset: 'berrymark-development', apiVersion: '2026-11-01' }
const token = 'synthetic-restricted-write-token'
const operator = 'aaron.test-operator'
const importedAt = '2026-11-05T12:00:00Z'
const publishedSeries = { _id: 'series-published-id', _rev: 'series-rev', title: 'Development', slug: 'bm-test-series' }
const complete = (documents = []) => ({ status: 'complete', documents })
const failed = (code = 'BM_IMPORT_LOOKUP_FAILED') => ({ status: 'failed', documents: [], error: { severity: 'error', code, message: 'Safe synthetic lookup failure' } })
const clone = value => JSON.parse(JSON.stringify(value))

function eligibleSource(source) {
  return source
    .replace('series: null', 'series: bibleberry-development-tests')
    .replace('sequence: null', 'sequence: 2')
}

function existingDraft(source = rejoiceSource, sourceFilename = 'existing.berry.md') {
  const compilation = compileBerryMark(source, { filename: sourceFilename })
  const offline = planBerryMarkImport({ compilation, source, schemaSnapshot })
  const challenges = complete()
  const online = resolveBerryMarkOnlineImport({
    offlineReport: offline,
    lookupResults: { series: { status: 'not-required', documents: [] }, challenges, sequence: { status: 'not-required', documents: [] }, candidateSequence: null }
  })
  return buildBerryMarkDraftCreateDocument({ compilation, onlineReport: online, operator, importedAt, schemaSnapshot })
}

function fakeTransport({ documents = [], series, sequence, mutation, readback } = {}) {
  const calls = { lookup: 0, create: 0, read: 0 }
  let createdDocument
  return {
    calls,
    get createdDocument() { return createdDocument },
    transport: {
      lookup: async input => {
        calls.lookup += 1
        return {
          series: series ?? complete(input.seriesSlug ? [publishedSeries] : []),
          challenges: complete(clone(documents)),
          sequence: sequence ?? complete(),
          candidateSequence: input.sequence
        }
      },
      createIfNotExists: async ({ document }) => {
        calls.create += 1
        createdDocument = clone(document)
        if (mutation) return mutation(document)
        return { status: 'complete', created: true }
      },
      readDraft: async () => {
        calls.read += 1
        if (readback) return readback(createdDocument)
        return { status: 'complete', document: { ...clone(createdDocument), _rev: 'synthetic-rev', _updatedAt: importedAt } }
      }
    }
  }
}

async function run(source = rejoiceSource, options = {}) {
  const fake = options.fake ?? fakeTransport(options)
  const report = await runBerryMarkDraftApply({
    source,
    sourceFilename: options.sourceFilename ?? 'synthetic/admin-test.berry.md',
    schemaSnapshot,
    apply: options.apply ?? true,
    target: Object.hasOwn(options, 'target') ? options.target : target,
    token: Object.hasOwn(options, 'token') ? options.token : token,
    operator: options.operator ?? operator,
    now: () => importedAt,
    transport: fake.transport
  })
  return { report, fake }
}

test('dry-run is the default, performs no target/credential/network/write work, and emits no sidecar text', async () => {
  const fake = fakeTransport()
  const { report } = await run(rejoiceSource, { apply: false, target: undefined, token: undefined, fake })
  assert.equal(report.mode, 'dry-run')
  assert.equal(report.proposedAction, 'unknown')
  assert.equal(report.writesAttempted, 0)
  assert.equal(report.apply.status, 'not-attempted')
  assert.equal(fake.calls.lookup + fake.calls.create + fake.calls.read, 0)
  assert.equal(JSON.stringify(report).includes('Gratitude opens the day'), false)
  assert.equal(report.editorialSummary.sidecarContentIncluded, false)
  assert.equal(Object.hasOwn(report, 'unresolvedEditorialDecisions'), false)
})

test('missing write credential and every unsafe or unauthorized target stop before lookup', async () => {
  const cases = [
    { token: undefined },
    { target: { ...target, dataset: 'production', authorizedDataset: 'production' } },
    { target: { ...target, authorizedDataset: 'another-development' } },
    { target: { ...target, projectId: 'another-project' } },
    { target: { ...target, apiVersion: '2025-01-01' } },
    { target: undefined }
  ]
  for (const options of cases) {
    const fake = fakeTransport()
    const { report } = await run(rejoiceSource, { ...options, fake })
    assert.equal(report.writesAttempted, 0)
    assert.equal(fake.calls.lookup + fake.calls.create + fake.calls.read, 0)
    assert.ok(report.errors.some(item => ['BM_IMPORT_AUTH_REQUIRED', 'BM_IMPORT_TARGET_NOT_AUTHORIZED'].includes(item.code)))
  }
})

test('fresh source compilation rejects invalid input and provided-text rights before any lookup', async () => {
  const invalid = readFileSync(new URL('../examples/invalid-duplicate-ids.berry.md', import.meta.url), 'utf8')
  for (const source of [invalid, allBlocksSource]) {
    const { report, fake } = await run(source)
    assert.equal(report.writesAttempted, 0)
    assert.equal(fake.calls.lookup + fake.calls.create + fake.calls.read, 0)
    assert.equal(report.apply.status, 'blocked-local-preflight')
    assert.equal(report.importEligible, false)
  }
})

test('failed or malformed required lookups fail closed without a mutation', async () => {
  for (const options of [
    { series: failed('BM_IMPORT_LOOKUP_TIMEOUT') },
    { documents: [], sequence: failed() },
    { documents: [], series: { status: 'complete' } }
  ]) {
    const source = options.sequence || options.series ? eligibleAllBlocksSource : rejoiceSource
    const { report, fake } = await run(source, options)
    assert.equal(report.proposedAction, 'unknown')
    assert.equal(report.importEligible, false)
    assert.equal(report.writesAttempted, 0)
    assert.equal(fake.calls.create + fake.calls.read, 0)
  }
})

test('published, duplicate, manual, and sequence identities all prevent creation', async () => {
  const draft = existingDraft()
  const identity = draft.importProvenance.canonicalId
  const scenarios = [
    { documents: [{ _id: identity, _type: 'challenge' }], code: 'BM_IMPORT_ID_CONFLICT' },
    { documents: [{ _id: 'drafts.manual-challenge', _type: 'challenge', slug: draft.slug.current }], code: 'BM_IMPORT_DUPLICATE_SLUG' },
    { documents: [{ ...draft, importProvenance: undefined }], code: 'BM_IMPORT_ID_CONFLICT' }
  ]
  for (const scenario of scenarios) {
    const { report, fake } = await run(rejoiceSource, scenario)
    assert.equal(report.proposedAction, 'reject')
    assert.ok(report.conflicts.some(item => item.code === scenario.code))
    assert.equal(report.writesAttempted, 0)
    assert.equal(fake.calls.create, 0)
  }
  const collision = await run(eligibleAllBlocksSource, { sequence: complete([{ _id: 'another-challenge', sequence: 1 }]) })
  assert.equal(collision.report.proposedAction, 'reject')
  assert.ok(collision.report.conflicts.some(item => item.code === 'BM_IMPORT_SEQUENCE_COLLISION'))
  assert.equal(collision.fake.calls.create, 0)
})

test('same-source repeat is a zero-write no-op only with independent stored-content fingerprint evidence', async () => {
  const draft = existingDraft(rejoiceSource, 'synthetic/admin-test.berry.md')
  const { report, fake } = await run(rejoiceSource, { documents: [draft] })
  assert.equal(report.proposedAction, 'none')
  assert.equal(report.appliedAction, 'none')
  assert.equal(report.apply.status, 'verified-noop')
  assert.equal(report.apply.readbackVerified, true)
  assert.equal(report.writesAttempted, 0)
  assert.equal(fake.calls.create + fake.calls.read, 0)
})

test('edited or malformed stored content cannot become a same-source no-op or create', async () => {
  const draft = existingDraft(rejoiceSource, 'synthetic/admin-test.berry.md')
  const edited = clone(draft)
  edited.title = 'Human edit after import'
  const malformed = clone(draft)
  malformed.screens[0].blocks[0].unexpected = true
  for (const documents of [[edited], [malformed]]) {
    const { report, fake } = await run(rejoiceSource, { documents })
    assert.equal(report.proposedAction, 'unknown')
    assert.equal(report.writesAttempted, 0)
    assert.equal(fake.calls.create + fake.calls.read, 0)
  }
})

test('approved drafts and revised manuscripts never enter an update pathway', async () => {
  const approved = existingDraft(rejoiceSource, 'synthetic/admin-test.berry.md')
  approved.editorialReview.adaptationReviewed = true
  approved.editorialReview.reviewedBy = 'human-reviewer'
  approved.editorialReview.reviewedAt = importedAt
  const sameSource = await run(rejoiceSource, { documents: [approved] })
  assert.equal(sameSource.report.proposedAction, 'unknown')
  assert.equal(sameSource.report.writesAttempted, 0)
  assert.equal(sameSource.fake.calls.create, 0)

  const previous = existingDraft(rejoiceSource, 'synthetic/admin-test.berry.md')
  previous.importProvenance.sourceSha256 = '0'.repeat(64)
  const revised = await run(`${rejoiceSource}\n`, { documents: [previous] })
  assert.equal(revised.report.proposedAction, 'reject')
  assert.equal(revised.report.writesAttempted, 0)
  assert.equal(revised.fake.calls.create, 0)
  assert.equal(revised.report.apply.updateAttempted, false)
})

test('first create preserves CB1–CB9, nested keys/order, conservative review, publishing metadata, and complete provenance', async () => {
  const { report, fake } = await run(eligibleAllBlocksSource)
  assert.equal(report.apply.status, 'created-and-verified', JSON.stringify(report.errors))
  assert.equal(report.appliedAction, 'create')
  assert.equal(report.writesAttempted, 1)
  assert.equal(fake.calls.lookup + fake.calls.create + fake.calls.read, 3)
  const document = fake.createdDocument
  const compilation = compileBerryMark(eligibleAllBlocksSource, { filename: 'synthetic/admin-test.berry.md' })
  assert.deepEqual(projectCandidateImportContent(compilation, schemaSnapshot), projectSanityDraftImportContent(document))
  assert.deepEqual(document.screens, compilation.sanityCandidate.screens)
  assert.equal(new Set(document.screens[0].blocks.map(block => block._type)).size, 9)
  assert.equal(document.editorialReview.adaptationReviewed, false)
  for (const block of document.screens[0].blocks.filter(item => ['comparisonBlock', 'visualCardsBlock', 'connectedSequenceBlock', 'reflectionBlock', 'optionalStudyBlock'].includes(item._type))) {
    assert.equal(block.reviewStatus, 'proposed')
  }
  assert.deepEqual(document.series, { _type: 'reference', _ref: 'series-published-id', _weak: true })
  assert.equal(document.sequence, 1)
  assert.equal(document.releaseAt, '2026-11-04T12:00:00Z')
  assert.equal(document.importProvenance.sourceSha256, compilation.reviewReport.source.sha256)
  assert.equal(document.importProvenance.candidateSha256, candidateSha256(compilation, schemaSnapshot))
  assert.equal(document.importProvenance.lastImportedContentSha256, document.importProvenance.candidateSha256)
  assert.equal(document.importProvenance.lastImportAction, 'create')
  assert.equal(document.importProvenance.importedBy, operator)
  assert.equal(document.importProvenance.importedAt, importedAt)
  assert.equal(Object.hasOwn(document.importProvenance, 'previousSourceSha256'), false)
  assert.equal(JSON.stringify(report).includes('BM-TEST rich heading'), false)
  assert.equal(JSON.stringify(report).includes(token), false)
})

test('create race uses createIfNotExists semantics and verifies a concurrent identical draft without overwriting', async () => {
  const concurrentOperator = 'concurrent.operator'
  const fake = fakeTransport({
    mutation: () => ({ status: 'complete', created: false }),
    readback: document => ({
      status: 'complete',
      document: {
        ...clone(document),
        importProvenance: { ...clone(document.importProvenance), importedBy: concurrentOperator, importedAt: '2026-11-05T12:00:01Z' }
      }
    })
  })
  const { report } = await run(rejoiceSource, { fake })
  assert.equal(report.apply.status, 'concurrent-create-verified-noop')
  assert.equal(report.apply.raceHandledWithoutOverwrite, true)
  assert.equal(report.appliedAction, 'none')
  assert.equal(fake.calls.create, 1)
})

test('mutation failure, readback failure, and readback mismatch are reported truthfully without retry or repair writes', async () => {
  const scenarios = [
    { mutation: () => failed('BM_IMPORT_PERMISSION_DENIED'), status: 'mutation-failed', code: 'BM_IMPORT_PERMISSION_DENIED', reads: 0 },
    { readback: () => failed('BM_IMPORT_READBACK_FAILED'), status: 'readback-failed', code: 'BM_IMPORT_READBACK_FAILED', reads: 1 },
    { readback: document => ({ status: 'complete', document: { ...clone(document), title: 'Unexpected readback' } }), status: 'readback-mismatch', code: 'BM_IMPORT_READBACK_MISMATCH', reads: 1 }
  ]
  for (const scenario of scenarios) {
    const { report, fake } = await run(rejoiceSource, scenario)
    assert.equal(report.apply.status, scenario.status)
    assert.equal(report.writesAttempted, 1)
    assert.equal(fake.calls.create, 1)
    assert.equal(fake.calls.read, scenario.reads)
    assert.ok(report.errors.some(item => item.code === scenario.code))
    assert.equal(report.apply.updateAttempted, false)
    assert.equal(report.apply.deleteAttempted, false)
  }
})

const cliPath = fileURLToPath(new URL('../src/sanity-draft-apply-cli.js', import.meta.url))
const rejoicePath = fileURLToPath(new URL('../examples/rejoice-always/rejoice-always.berry.md', import.meta.url))

test('administrative CLI defaults to dry-run without credentials and rejects implicit apply', () => {
  const env = { ...process.env }
  for (const key of Object.keys(env).filter(key => key.startsWith('BERRYMARK_SANITY_'))) delete env[key]
  const dry = spawnSync(process.execPath, [cliPath, rejoicePath], { encoding: 'utf8', env })
  assert.equal(dry.status, 0, dry.stderr)
  const report = JSON.parse(dry.stdout)
  assert.equal(report.mode, 'dry-run')
  assert.equal(report.writesAttempted, 0)
  const missingApplyArguments = spawnSync(process.execPath, [cliPath, rejoicePath, '--apply'], { encoding: 'utf8', env })
  assert.equal(missingApplyArguments.status, 2)
  assert.equal(missingApplyArguments.stdout, '')
})

test('CLI apply requires separate write credential and explicit matching development dataset', () => {
  const env = { ...process.env }
  for (const key of Object.keys(env).filter(key => key.startsWith('BERRYMARK_SANITY_'))) delete env[key]
  const missing = spawnSync(process.execPath, [cliPath, rejoicePath, '--apply', '--operator', operator], { encoding: 'utf8', env })
  assert.equal(missing.status, 1, missing.stderr)
  assert.equal(JSON.parse(missing.stdout).errors[0].code, 'BM_IMPORT_TARGET_NOT_AUTHORIZED')
  const configured = {
    ...env,
    BERRYMARK_SANITY_WRITE_PROJECT_ID: target.projectId,
    BERRYMARK_SANITY_WRITE_DATASET: target.dataset,
    BERRYMARK_SANITY_AUTHORIZED_WRITE_DATASET: target.dataset,
    BERRYMARK_SANITY_WRITE_API_VERSION: target.apiVersion
  }
  const noToken = spawnSync(process.execPath, [cliPath, rejoicePath, '--apply', '--operator', operator], { encoding: 'utf8', env: configured })
  assert.equal(noToken.status, 1, noToken.stderr)
  assert.equal(JSON.parse(noToken.stdout).errors[0].code, 'BM_IMPORT_AUTH_REQUIRED')
  const reused = spawnSync(process.execPath, [cliPath, rejoicePath, '--apply', '--operator', operator], {
    encoding: 'utf8',
    env: { ...configured, BERRYMARK_SANITY_WRITE_TOKEN: token, BERRYMARK_SANITY_READ_TOKEN: token }
  })
  assert.equal(reused.status, 2)
  assert.equal(reused.stdout, '')
  assert.equal(reused.stderr.includes(token), false)
})
