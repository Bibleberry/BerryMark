import { SANITY_TARGET } from './sanity-target.js'

export const SANITY_WRITE_TOKEN_ENV = 'BERRYMARK_SANITY_WRITE_TOKEN'
export const SANITY_WRITE_PROJECT_ID_ENV = 'BERRYMARK_SANITY_WRITE_PROJECT_ID'
export const SANITY_WRITE_DATASET_ENV = 'BERRYMARK_SANITY_WRITE_DATASET'
export const SANITY_AUTHORIZED_WRITE_DATASET_ENV = 'BERRYMARK_SANITY_AUTHORIZED_WRITE_DATASET'
export const SANITY_WRITE_API_VERSION_ENV = 'BERRYMARK_SANITY_WRITE_API_VERSION'

const MAX_RESPONSE_BYTES = 250_000
const MAX_REQUEST_BYTES = 250_000
const DRAFT_ID_PATTERN = /^drafts\.berrymark-challenge-([a-z0-9]+(?:-[a-z0-9]+)*)$/
const SERIES_QUERY = `*[_type == "challengeSeries" && slug.current == $slug]{
  _id,_rev,_updatedAt,title,"slug":slug.current
}`
const CHALLENGE_QUERY = `*[_type == "challenge" && (_id in [$canonicalId,$draftId] || slug.current == $slug)]{
  _id,_rev,_updatedAt,_type,title,slug,challengeType,series,sequence,releaseAt,summary,
  primaryScripture,screens,companionLinks,editorialReview,importProvenance,
  "blockReviewStates":screens[].blocks[]{_key,_type,reviewStatus}
}`
const SEQUENCE_QUERY = `*[_type == "challenge" && series._ref == $seriesId && sequence == $sequence]{
  _id,_rev,title,"slug":slug.current,sequence,"seriesId":series._ref
}`
const DRAFT_QUERY = `*[_type == "challenge" && _id == $draftId]{
  _id,_rev,_updatedAt,_type,title,slug,challengeType,series,sequence,releaseAt,summary,
  primaryScripture,screens,companionLinks,editorialReview,importProvenance
}`

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const failure = (code, message) => ({ status: 'failed', documents: [], error: { severity: 'error', code, message } })
const unverifiedMutation = (message, code = 'BM_IMPORT_MUTATION_UNVERIFIED') => ({
  status: 'unverified',
  error: { severity: 'error', code, message }
})
const validDraftId = value => {
  if (typeof value !== 'string') return false
  const match = DRAFT_ID_PATTERN.exec(value)
  return Boolean(match && match[1].length <= 96)
}

export function resolveSanityDraftApplyConfig(env = process.env) {
  const token = env[SANITY_WRITE_TOKEN_ENV]
  const readToken = env.BERRYMARK_SANITY_READ_TOKEN
  if (token && readToken && token === readToken) {
    throw new TypeError('The restricted write credential must be different from the read-only Viewer credential')
  }
  return {
    token,
    target: {
      projectId: env[SANITY_WRITE_PROJECT_ID_ENV],
      dataset: env[SANITY_WRITE_DATASET_ENV],
      authorizedDataset: env[SANITY_AUTHORIZED_WRITE_DATASET_ENV],
      apiVersion: env[SANITY_WRITE_API_VERSION_ENV]
    }
  }
}

export function assertSanityDraftApplyTarget(target) {
  if (!isRecord(target)) throw new TypeError('An explicit Sanity write target is required')
  if (target.projectId !== SANITY_TARGET.projectId || target.apiVersion !== SANITY_TARGET.apiVersion) {
    throw new TypeError('The Sanity write project and API version must match the approved Bibleberry configuration')
  }
  if (typeof target.dataset !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(target.dataset)) {
    throw new TypeError('The Sanity write dataset must be an explicit valid dataset name')
  }
  if (target.dataset === SANITY_TARGET.dataset) {
    throw new TypeError('The production dataset is never an authorized apply target')
  }
  if (target.authorizedDataset !== target.dataset) {
    throw new TypeError('The selected write dataset must exactly match the separately authorized development dataset')
  }
  return { projectId: target.projectId, dataset: target.dataset, apiVersion: target.apiVersion }
}

function endpoint(target, operation) {
  return `https://${target.projectId}.api.sanity.io/v${target.apiVersion}/data/${operation}/${target.dataset}`
}

async function request({ target, operation, method, query, parameters = {}, document, token, fetchImpl, timeoutMs }) {
  const url = new URL(endpoint(target, operation))
  let body
  if (query) {
    url.searchParams.set('query', query)
    url.searchParams.set('perspective', 'raw')
    for (const [key, value] of Object.entries(parameters)) url.searchParams.set(`$${key}`, JSON.stringify(value))
  } else {
    body = JSON.stringify({ mutations: [{ createIfNotExists: document }] })
    if (Buffer.byteLength(body, 'utf8') > MAX_REQUEST_BYTES) {
      return failure('BM_IMPORT_REQUEST_TOO_LARGE', 'The draft creation request exceeded the administrative size limit')
    }
    if (operation === 'mutate') url.searchParams.set('returnIds', 'true')
  }

  try {
    const response = await fetchImpl(url, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body } : {}),
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (response.status === 401) return failure('BM_IMPORT_AUTH_FAILED', 'Sanity rejected the restricted apply credential')
    if (response.status === 403) return failure('BM_IMPORT_PERMISSION_DENIED', 'Sanity credential lacks permission for the administrative apply operation')
    if (response.status === 409) return failure('BM_IMPORT_ID_CONFLICT', 'Sanity reported a create-only identity conflict')
    if (response.status >= 500) {
      return operation === 'mutate'
        ? unverifiedMutation(`Sanity may have applied the mutation before returning HTTP ${response.status}; read back the draft and investigate before taking further action`)
        : failure('BM_IMPORT_APPLY_FAILED', `Sanity administrative request returned HTTP ${response.status}`)
    }
    if (response.status < 200 || response.status >= 300) return failure('BM_IMPORT_APPLY_FAILED', `Sanity administrative request returned HTTP ${response.status}`)
    const length = Number(response.headers?.get?.('content-length') ?? 0)
    if (length > MAX_RESPONSE_BYTES) {
      return operation === 'mutate'
        ? unverifiedMutation('Sanity may have applied the mutation, but its response exceeded the administrative size limit; read back the draft and investigate before taking further action')
        : failure('BM_IMPORT_MALFORMED_RESPONSE', 'Sanity response exceeded the administrative size limit')
    }
    const text = await response.text()
    if (text.length > MAX_RESPONSE_BYTES) {
      return operation === 'mutate'
        ? unverifiedMutation('Sanity may have applied the mutation, but its response exceeded the administrative size limit; read back the draft and investigate before taking further action')
        : failure('BM_IMPORT_MALFORMED_RESPONSE', 'Sanity response exceeded the administrative size limit')
    }
    let parsed
    try { parsed = JSON.parse(text) } catch {
      return operation === 'mutate'
        ? unverifiedMutation('Sanity may have applied the mutation, but returned invalid JSON; read back the draft and investigate before taking further action')
        : failure('BM_IMPORT_MALFORMED_RESPONSE', 'Sanity returned invalid JSON')
    }
    return { status: 'complete', body: parsed }
  } catch (error) {
    if (operation === 'mutate') {
      return unverifiedMutation('Sanity may have applied the mutation, but its response could not be verified; read back the draft and investigate before taking further action')
    }
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return failure('BM_IMPORT_LOOKUP_TIMEOUT', 'Sanity administrative request timed out')
    return failure('BM_IMPORT_APPLY_TRANSPORT_FAILED', 'Sanity administrative request could not be completed')
  }
}

function queryDocuments(response) {
  if (response.status !== 'complete') return response
  if (!isRecord(response.body) || !Array.isArray(response.body.result)) {
    return failure('BM_IMPORT_MALFORMED_RESPONSE', 'Sanity lookup response did not contain a result array')
  }
  const ids = new Set()
  for (const [index, document] of response.body.result.entries()) {
    if (!isRecord(document) || typeof document._id !== 'string' || !document._id || ids.has(document._id)) {
      return failure('BM_IMPORT_MALFORMED_RESPONSE', `Sanity lookup returned a malformed or duplicate document at result index ${index}`)
    }
    ids.add(document._id)
  }
  return { status: 'complete', documents: response.body.result }
}

async function query({ target, query: groq, parameters, token, fetchImpl, timeoutMs }) {
  const response = await request({ target, operation: 'query', method: 'GET', query: groq, parameters, token, fetchImpl, timeoutMs })
  return queryDocuments(response)
}

export async function lookupSanityDraftApplyState({
  slug, canonicalId, draftId, seriesSlug = null, sequence = null,
  target, token, fetchImpl = globalThis.fetch, timeoutMs = 10_000
} = {}) {
  assertSanityDraftApplyTarget(target)
  if (typeof token !== 'string' || !token.trim()) return {
    series: failure('BM_IMPORT_AUTH_REQUIRED', 'Set the separate restricted Sanity write credential before apply'),
    challenges: failure('BM_IMPORT_AUTH_REQUIRED', 'Set the separate restricted Sanity write credential before apply'),
    sequence: { status: 'not-required', documents: [] }, candidateSequence: sequence
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required')

  const [series, challenges] = await Promise.all([
    typeof seriesSlug === 'string' && seriesSlug
      ? query({ target, query: SERIES_QUERY, parameters: { slug: seriesSlug }, token, fetchImpl, timeoutMs })
      : { status: 'not-required', documents: [], reason: 'No series slug was supplied' },
    query({ target, query: CHALLENGE_QUERY, parameters: { slug, canonicalId, draftId }, token, fetchImpl, timeoutMs })
  ])

  let sequenceResult = { status: 'not-required', documents: [], reason: 'No published series and positive sequence require a collision lookup' }
  const eligibleSeries = series.status === 'complete'
    ? series.documents.filter(item => !item._id.startsWith('drafts.') && !item._id.startsWith('versions.'))
    : []
  if (eligibleSeries.length === 1 && series.documents.length === 1 && Number.isSafeInteger(sequence) && sequence > 0) {
    sequenceResult = await query({ target, query: SEQUENCE_QUERY, parameters: { seriesId: eligibleSeries[0]._id, sequence }, token, fetchImpl, timeoutMs })
  }
  return { series, challenges, sequence: sequenceResult, candidateSequence: sequence }
}

export async function createSanityDraftIfNotExists({ document, target, token, fetchImpl = globalThis.fetch, timeoutMs = 10_000 } = {}) {
  assertSanityDraftApplyTarget(target)
  if (!isRecord(document) || !validDraftId(document._id)) {
    throw new TypeError('Only a deterministic BerryMark Challenge draft can be created')
  }
  if (typeof token !== 'string' || !token.trim()) return failure('BM_IMPORT_AUTH_REQUIRED', 'Set the separate restricted Sanity write credential before apply')
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required')
  const response = await request({ target, operation: 'mutate', method: 'POST', document, token, fetchImpl, timeoutMs })
  if (response.status !== 'complete') return response
  const transactionId = response.body?.transactionId
  const results = response.body?.results
  if (typeof transactionId !== 'string' || !transactionId || !Array.isArray(results)) {
    return unverifiedMutation('The mutation may have succeeded, but its response was unverifiable; read back the draft and investigate before taking further action')
  }
  const resultId = item => {
    const hasId = Object.hasOwn(item, 'id')
    const hasDocumentId = Object.hasOwn(item, 'documentId')
    if (hasId === hasDocumentId) return null
    const value = hasId ? item.id : item.documentId
    return typeof value === 'string' ? value : null
  }
  if (results.length > 1 || results.some(item => !isRecord(item) || resultId(item) === null || typeof item.operation !== 'string')) {
    return unverifiedMutation('The mutation may have succeeded, but its response was unverifiable; read back the draft and investigate before taking further action')
  }
  if (results.some(item => item.operation === 'update')) {
    return unverifiedMutation('Sanity reported an update where createIfNotExists was required; read back the draft and investigate before taking further action', 'BM_IMPORT_CREATE_ONLY_VIOLATION')
  }
  if (results.some(item => resultId(item) !== document._id || item.operation !== 'create')) {
    return unverifiedMutation('The mutation may have succeeded, but its response was unverifiable; read back the draft and investigate before taking further action')
  }
  return { status: 'complete', created: results.some(item => resultId(item) === document._id && item.operation === 'create') }
}

export async function readSanityDraftAfterApply({ draftId, target, token, fetchImpl = globalThis.fetch, timeoutMs = 10_000 } = {}) {
  assertSanityDraftApplyTarget(target)
  if (!validDraftId(draftId)) throw new TypeError('A deterministic BerryMark draft ID is required')
  if (typeof token !== 'string' || !token.trim()) return failure('BM_IMPORT_AUTH_REQUIRED', 'Set the separate restricted Sanity write credential before readback')
  const result = await query({ target, query: DRAFT_QUERY, parameters: { draftId }, token, fetchImpl, timeoutMs })
  if (result.status !== 'complete') return result
  if (result.documents.length !== 1 || result.documents[0]._id !== draftId) {
    return failure('BM_IMPORT_READBACK_FAILED', 'The exact created draft could not be read back for verification')
  }
  return { status: 'complete', document: result.documents[0] }
}

export const sanityDraftApplyTransport = Object.freeze({
  lookup: lookupSanityDraftApplyState,
  createIfNotExists: createSanityDraftIfNotExists,
  readDraft: readSanityDraftAfterApply
})
