import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sha256 } from '../src/keys.js'
import { openBerryMarkDocument } from '../src/studio/document-engine.js'
import {
  recoverReviewCompanion,
  saveReviewBoundDocument
} from '../src/studio/browser/review-state-file.js'

const fixture = await readFile(new URL('../examples/compiler-all-blocks.berry.md', import.meta.url), 'utf8')

async function fileHarness(run) {
  const directory = await mkdtemp(join(tmpdir(), 'berrymark-studio-save-'))
  const manuscriptPath = join(directory, 'working.berry.md')
  const reviewPath = join(directory, 'working.berry.md.review.json')
  const store = {
    async readReviewState() {
      try {
        return await readFile(reviewPath, 'utf8')
      } catch (error) {
        if (error.code === 'ENOENT') error.name = 'NotFoundError'
        throw error
      }
    },
    async writeReviewState(text) {
      const temporary = `${reviewPath}.${process.pid}.tmp`
      await writeFile(temporary, text, 'utf8')
      const { rename } = await import('node:fs/promises')
      await rename(temporary, reviewPath)
    },
    async writeManuscript(text) {
      const temporary = `${manuscriptPath}.${process.pid}.tmp`
      await writeFile(temporary, text, 'utf8')
      const { rename } = await import('node:fs/promises')
      await rename(temporary, manuscriptPath)
    }
  }
  await run({ directory, manuscriptPath, reviewPath, store })
}

async function save(store, document, previousSourceSha256 = null, allowCompanionReset = false) {
  const source = document.serialize()
  await saveReviewBoundDocument({
    store,
    source,
    sourceSha256: sha256(source),
    reviewState: document.serializeReviewState(),
    previousSourceSha256,
    manuscriptName: 'working.berry.md',
    allowCompanionReset
  })
  return source
}

test('approved → edit → pending → save → reopen → approved retains stale review history through real filesystem persistence', async () => {
  await fileHarness(async ({ store, manuscriptPath, reviewPath }) => {
    const original = openBerryMarkDocument(fixture)
    const document = openBerryMarkDocument(fixture)
    document.setMetadata('editorial.approvalStatus', 'approved')
    document.setMetadata('editorial.approvedBy', 'Alexis Waid')
    document.setMetadata('editorial.approvedAt', '2026-11-20T12:00:00Z')
    const approvedSource = document.serialize()
    await save(store, document, null, true)

    document.updateBlock('compiler-rich-teaching', { body: 'Edited after approval and before pending.' })
    document.setMetadata('editorial.approvalStatus', 'pending')
    const pendingSource = await save(store, document, sha256(approvedSource))
    const companionText = await readFile(reviewPath, 'utf8')
    const recovered = recoverReviewCompanion(sha256(pendingSource), companionText)
    assert.equal(recovered.status, 'matched')

    const reopened = openBerryMarkDocument(await readFile(manuscriptPath, 'utf8'), { reviewState: recovered.reviewState })
    assert.equal(reopened.getMetadata('editorial.approvalStatus'), 'pending')
    assert.equal(reopened.reviewDiagnostics[0].code, 'BM_STUDIO_APPROVAL_STALE')
    reopened.setMetadata('editorial.approvalStatus', 'approved')
    assert.equal(reopened.reviewDiagnostics[0].code, 'BM_STUDIO_APPROVAL_STALE')
    const finalSource = await save(store, reopened, sha256(pendingSource))
    const finalRecovery = recoverReviewCompanion(sha256(finalSource), await readFile(reviewPath, 'utf8'))
    const finalDocument = openBerryMarkDocument(finalSource, { reviewState: finalRecovery.reviewState })
    assert.equal(finalDocument.getMetadata('editorial.approvalStatus'), 'approved')
    assert.equal(finalDocument.reviewDiagnostics[0].code, 'BM_STUDIO_APPROVAL_STALE')
    assert.notEqual(original.serialize(), finalSource)
  })
})

test('unchanged source, BOM, CRLF, and absent final newline survive the application persistence layer exactly', async () => {
  await fileHarness(async ({ store, manuscriptPath }) => {
    for (const source of [fixture, `\uFEFF${fixture.replace(/\n/g, '\r\n')}`, fixture.replace(/\n$/, '')]) {
      const document = openBerryMarkDocument(source)
      await save(store, document, null, true)
      assert.equal(await readFile(manuscriptPath, 'utf8'), source)
    }
  })
})

test('an interrupted manuscript write recovers the previous source and review state without reporting success', async () => {
  await fileHarness(async ({ store, manuscriptPath, reviewPath }) => {
    const initial = openBerryMarkDocument(fixture)
    await save(store, initial, null, true)
    const edited = openBerryMarkDocument(fixture)
    edited.setMetadata('challenge.title', 'Interrupted before manuscript write')
    const failing = {
      ...store,
      async writeManuscript() { throw new Error('simulated interruption') }
    }
    await assert.rejects(save(failing, edited, sha256(fixture)), error => error.code === 'BM_STUDIO_SAVE_MANUSCRIPT_FAILED' && error.phase === 'write-manuscript')
    assert.equal(await readFile(manuscriptPath, 'utf8'), fixture)
    const recovery = recoverReviewCompanion(sha256(fixture), await readFile(reviewPath, 'utf8'))
    assert.equal(recovery.status, 'recovered-previous')
    assert.equal(recovery.requiresResetConfirmation, false)
    const reopened = openBerryMarkDocument(fixture, { reviewState: recovery.reviewState })
    assert.equal(reopened.serialize(), fixture)
  })
})

test('an interrupted final review write recovers the new manuscript and its target review state', async () => {
  await fileHarness(async ({ store, manuscriptPath, reviewPath }) => {
    const initial = openBerryMarkDocument(fixture)
    await save(store, initial, null, true)
    const edited = openBerryMarkDocument(fixture)
    edited.setMetadata('challenge.title', 'Recovered after manuscript write')
    const source = edited.serialize()
    let reviewWrites = 0
    const failing = {
      ...store,
      async writeReviewState(text) {
        reviewWrites += 1
        if (reviewWrites === 2) throw new Error('simulated finalization failure')
        return store.writeReviewState(text)
      }
    }
    await assert.rejects(save(failing, edited, sha256(fixture)), error => error.code === 'BM_STUDIO_SAVE_FINALIZE_FAILED' && error.phase === 'finalize-review')
    assert.equal(await readFile(manuscriptPath, 'utf8'), source)
    const recovery = recoverReviewCompanion(sha256(source), await readFile(reviewPath, 'utf8'))
    assert.equal(recovery.status, 'recovered-target')
    const reopened = openBerryMarkDocument(source, { reviewState: recovery.reviewState })
    assert.equal(reopened.getMetadata('challenge.title'), 'Recovered after manuscript write')
  })
})

test('missing, malformed, and mismatched review information never fabricates history and requires explicit reset confirmation', async () => {
  const digest = sha256(fixture)
  for (const [text, status] of [[null, 'missing'], ['{bad', 'malformed'], ['{}', 'malformed']]) {
    const result = recoverReviewCompanion(digest, text)
    assert.equal(result.status, status)
    assert.equal(result.reviewState, null)
    assert.equal(result.requiresResetConfirmation, true)
  }
  await fileHarness(async ({ store }) => {
    const document = openBerryMarkDocument(fixture)
    await assert.rejects(save(store, document, digest), error => error.code === 'BM_STUDIO_REVIEW_RESET_CONFIRMATION')
  })
  const mismatched = recoverReviewCompanion(digest, JSON.stringify({
    format: 'berrymark-studio-review-file-v1',
    sourceSha256: '0'.repeat(64),
    reviewState: { version: 'berrymark-studio-review-v1', sourceSha256: '0'.repeat(64), approvalStale: true }
  }))
  assert.equal(mismatched.status, 'mismatched')
  assert.equal(mismatched.reviewState, null)
})
