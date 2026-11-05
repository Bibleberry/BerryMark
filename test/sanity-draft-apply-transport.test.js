import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertSanityDraftApplyTarget,
  createSanityDraftIfNotExists,
  lookupSanityDraftApplyState,
  readSanityDraftAfterApply
} from '../src/sanity-draft-apply-transport.js'

const target = { projectId: '80016lrq', dataset: 'berrymark-development', authorizedDataset: 'berrymark-development', apiVersion: '2026-11-01' }
const token = 'synthetic-write-token-not-a-credential'
const draftId = 'drafts.berrymark-challenge-synthetic-test'
const document = { _id: draftId, _type: 'challenge', title: 'Synthetic test', slug: { _type: 'slug', current: 'synthetic-test' } }
const response = (body, status = 200) => ({ status, headers: { get: () => null }, text: async () => typeof body === 'string' ? body : JSON.stringify(body) })
const identity = { slug: 'synthetic-test', canonicalId: 'berrymark-challenge-synthetic-test', draftId, seriesSlug: 'development-series', sequence: 2, target, token }

function recorder(bodies) {
  const calls = []
  let index = 0
  return {
    calls,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options })
      return response(bodies[index++] ?? { result: [] })
    }
  }
}

test('apply preflight uses fixed raw-perspective reads against only the authorized development target', async () => {
  const { calls, fetchImpl } = recorder([
    { result: [{ _id: 'series-id', slug: 'development-series' }] },
    { result: [] },
    { result: [] }
  ])
  const result = await lookupSanityDraftApplyState({ ...identity, fetchImpl })
  assert.equal(result.series.status, 'complete')
  assert.equal(result.challenges.status, 'complete')
  assert.equal(result.sequence.status, 'complete')
  assert.equal(calls.length, 3)
  for (const call of calls) {
    const url = new URL(call.url)
    assert.equal(url.hostname, '80016lrq.api.sanity.io')
    assert.equal(url.pathname, '/v2026-11-01/data/query/berrymark-development')
    assert.equal(url.searchParams.get('perspective'), 'raw')
    assert.equal(call.options.method, 'GET')
    assert.equal(call.options.body, undefined)
    assert.equal(call.options.headers.Authorization, `Bearer ${token}`)
  }
  assert.match(new URL(calls[1].url).searchParams.get('query'), /primaryScripture,screens,companionLinks,editorialReview,importProvenance/)
})

test('missing token and unsafe targets perform no fetch in every transport operation', async () => {
  const lookup = await lookupSanityDraftApplyState({ ...identity, token: undefined, fetchImpl: () => { throw new Error('must not fetch') } })
  assert.equal(lookup.series.status, 'failed')
  assert.equal(lookup.challenges.status, 'failed')
  assert.equal(lookup.challenges.error.code, 'BM_IMPORT_AUTH_REQUIRED')
  for (const operation of [
    () => createSanityDraftIfNotExists({ document, target, token: undefined, fetchImpl: () => { throw new Error('must not fetch') } }),
    () => readSanityDraftAfterApply({ draftId, target, token: undefined, fetchImpl: () => { throw new Error('must not fetch') } })
  ]) {
    const result = await operation()
    assert.equal(result.status, 'failed')
    assert.equal(result.error.code, 'BM_IMPORT_AUTH_REQUIRED')
  }
  for (const unsafe of [
    { ...target, dataset: 'production', authorizedDataset: 'production' },
    { ...target, authorizedDataset: 'different' },
    { ...target, projectId: 'other' },
    { ...target, apiVersion: 'other' }
  ]) {
    assert.throws(() => assertSanityDraftApplyTarget(unsafe))
    await assert.rejects(() => createSanityDraftIfNotExists({ document, target: unsafe, token, fetchImpl: () => { throw new Error('must not fetch') } }))
  }
})

test('the only mutation request asks for result IDs and creates the exact deterministic draft', async () => {
  const { calls, fetchImpl } = recorder([{ transactionId: 'synthetic-transaction', results: [{ id: draftId, operation: 'create' }] }])
  const result = await createSanityDraftIfNotExists({ document, target, token, fetchImpl })
  assert.deepEqual(result, { status: 'complete', created: true })
  assert.equal(calls.length, 1)
  const call = calls[0]
  const url = new URL(call.url)
  assert.equal(url.pathname, '/v2026-11-01/data/mutate/berrymark-development')
  assert.equal(call.options.method, 'POST')
  assert.equal(url.searchParams.get('returnIds'), 'true')
  assert.deepEqual(JSON.parse(call.options.body), { mutations: [{ createIfNotExists: document }] })
  assert.equal(call.options.body.includes('patch'), false)
  assert.equal(call.options.body.includes('delete'), false)
  assert.equal(call.options.body.includes('publish'), false)
})

test('an empty createIfNotExists result supports readback-verified race handling; a reported update fails closed', async () => {
  const noCreate = await createSanityDraftIfNotExists({
    document, target, token, fetchImpl: async () => response({ transactionId: 'synthetic', results: [] })
  })
  assert.deepEqual(noCreate, { status: 'complete', created: false })
  const update = await createSanityDraftIfNotExists({
    document, target, token, fetchImpl: async () => response({ transactionId: 'synthetic', results: [{ id: draftId, operation: 'update' }] })
  })
  assert.equal(update.status, 'unverified')
  assert.equal(update.error.code, 'BM_IMPORT_CREATE_ONLY_VIOLATION')
})

test('mutation rejects non-draft IDs and marks unexpected or unverifiable result IDs and operations unverified', async () => {
  for (const _id of ['berrymark-challenge-synthetic-test', 'drafts.berrymark-challenge-INVALID', `drafts.berrymark-challenge-${'a'.repeat(97)}`]) {
    await assert.rejects(() => createSanityDraftIfNotExists({ document: { ...document, _id }, target, token }))
  }
  const result = await createSanityDraftIfNotExists({
    document, target, token, fetchImpl: async () => response({ results: [{ id: 'another-id', operation: 'create' }] })
  })
  assert.equal(result.status, 'unverified')
  assert.equal(result.error.code, 'BM_IMPORT_MUTATION_UNVERIFIED')
  for (const body of [
    { transactionId: 'synthetic', results: [{ documentId: draftId, operation: 'create' }] },
    { transactionId: 'synthetic', results: [{ id: draftId, operation: 'delete' }] },
    { transactionId: 'synthetic', results: [{ id: draftId, operation: 'create' }, { id: draftId, operation: 'create' }] },
    { results: [{ id: draftId, operation: 'create' }] },
    'not-json'
  ]) {
    const unverifiable = await createSanityDraftIfNotExists({ document, target, token, fetchImpl: async () => response(body) })
    assert.equal(unverifiable.status, 'unverified')
    assert.equal(unverifiable.error.code, 'BM_IMPORT_MUTATION_UNVERIFIED')
  }
})

test('readback accepts exactly the requested raw draft and rejects absence or ambiguous identities', async () => {
  const success = await readSanityDraftAfterApply({ draftId, target, token, fetchImpl: async () => response({ result: [document] }) })
  assert.equal(success.status, 'complete')
  assert.equal(success.document._id, draftId)
  for (const result of [[], [document, document], [{ ...document, _id: 'another-id' }]]) {
    const readback = await readSanityDraftAfterApply({ draftId, target, token, fetchImpl: async () => response({ result }) })
    assert.equal(readback.status, 'failed')
    assert.ok(['BM_IMPORT_READBACK_FAILED', 'BM_IMPORT_MALFORMED_RESPONSE'].includes(readback.error.code))
  }
})

test('oversized mutation requests fail before any network call', async () => {
  let calls = 0
  const result = await createSanityDraftIfNotExists({
    document: { ...document, title: 'x'.repeat(250_000) },
    target,
    token,
    fetchImpl: async () => { calls += 1 }
  })
  assert.equal(calls, 0)
  assert.equal(result.status, 'failed')
  assert.equal(result.error.code, 'BM_IMPORT_REQUEST_TOO_LARGE')
})

test('HTTP, timeout, malformed JSON, and oversized responses remain safe structured failures', async () => {
  for (const [responseValue, code] of [
    [response({}, 401), 'BM_IMPORT_AUTH_FAILED'],
    [response({}, 403), 'BM_IMPORT_PERMISSION_DENIED'],
    [response({}, 409), 'BM_IMPORT_ID_CONFLICT']
  ]) {
    const result = await createSanityDraftIfNotExists({ document, target, token, fetchImpl: async () => responseValue })
    assert.equal(result.status, 'failed')
    assert.equal(result.error.code, code)
    assert.equal(JSON.stringify(result).includes(token), false)
    assert.equal(JSON.stringify(result).includes('Authorization'), false)
  }
  const malformed = await createSanityDraftIfNotExists({
    document, target, token, fetchImpl: async () => response('{not-json')
  })
  assert.equal(malformed.status, 'unverified')
  assert.equal(malformed.error.code, 'BM_IMPORT_MUTATION_UNVERIFIED')
  const oversized = await createSanityDraftIfNotExists({
    document, target, token,
    fetchImpl: async () => ({ status: 200, headers: { get: () => '250001' }, text: async () => { throw new Error('must not read') } })
  })
  assert.equal(oversized.status, 'unverified')
  assert.equal(oversized.error.code, 'BM_IMPORT_MUTATION_UNVERIFIED')
  const timeout = await createSanityDraftIfNotExists({
    document, target, token,
    fetchImpl: async () => { throw Object.assign(new Error(`Bearer ${token}`), { name: 'TimeoutError' }) }
  })
  assert.equal(timeout.status, 'unverified')
  assert.equal(timeout.error.code, 'BM_IMPORT_MUTATION_UNVERIFIED')
  assert.equal(JSON.stringify(timeout).includes(token), false)
})
