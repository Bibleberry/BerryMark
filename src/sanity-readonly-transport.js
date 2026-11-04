import { SANITY_TARGET } from './sanity-target.js'

const SERIES_QUERY = `*[_type == "challengeSeries" && slug.current == $slug]{
  _id,_rev,_updatedAt,title,"slug":slug.current
}`
const CHALLENGE_QUERY = `*[_type == "challenge" && (_id in [$canonicalId,$draftId] || slug.current == $slug)]{
  _id,_rev,_updatedAt,title,"slug":slug.current,sequence,"seriesId":series._ref,
  editorialReview{adaptationReviewed,reviewedAt,reviewedBy},
  importProvenance{sourceSystem,canonicalId,sourceSha256,lastImportedContentSha256},
  "blockReviewStates":screens[].blocks[]{_key,_type,reviewStatus}
}`
const SEQUENCE_QUERY = `*[_type == "challenge" && series._ref == $seriesId && sequence == $sequence]{
  _id,_rev,title,"slug":slug.current,sequence,"seriesId":series._ref
}`
const MAX_RESPONSE_BYTES = 100_000

function failure(code, message) {
  return { status: 'failed', documents: [], error: { severity: 'error', code, message } }
}

function assertTarget(target) {
  for (const key of ['projectId', 'dataset', 'apiVersion']) {
    if (target[key] !== SANITY_TARGET[key]) throw new TypeError('Sanity target does not match the approved Bibleberry configuration')
  }
}

async function query({ slug, canonicalId, draftId, seriesId, sequence, query, token, fetchImpl, timeoutMs }) {
  const url = new URL(`https://${SANITY_TARGET.projectId}.api.sanity.io/v${SANITY_TARGET.apiVersion}/data/query/${SANITY_TARGET.dataset}`)
  url.searchParams.set('query', query)
  url.searchParams.set('perspective', 'raw')
  if (slug !== undefined) url.searchParams.set('$slug', JSON.stringify(slug))
  if (canonicalId !== undefined) url.searchParams.set('$canonicalId', JSON.stringify(canonicalId))
  if (draftId !== undefined) url.searchParams.set('$draftId', JSON.stringify(draftId))
  if (seriesId !== undefined) url.searchParams.set('$seriesId', JSON.stringify(seriesId))
  if (sequence !== undefined) url.searchParams.set('$sequence', JSON.stringify(sequence))

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (response.status === 401) return failure('BM_IMPORT_AUTH_FAILED', 'Sanity rejected the read-only credential')
    if (response.status === 403) return failure('BM_IMPORT_PERMISSION_DENIED', 'Sanity credential lacks permission for the required raw-perspective reads')
    if (response.status < 200 || response.status >= 300) return failure('BM_IMPORT_LOOKUP_FAILED', `Sanity lookup returned HTTP ${response.status}`)
    const length = Number(response.headers?.get?.('content-length') ?? 0)
    if (length > MAX_RESPONSE_BYTES) return failure('BM_IMPORT_MALFORMED_RESPONSE', 'Sanity lookup response exceeded the administrative size limit')
    const text = await response.text()
    if (text.length > MAX_RESPONSE_BYTES) return failure('BM_IMPORT_MALFORMED_RESPONSE', 'Sanity lookup response exceeded the administrative size limit')
    let body
    try { body = JSON.parse(text) } catch { return failure('BM_IMPORT_MALFORMED_RESPONSE', 'Sanity lookup returned invalid JSON') }
    if (!body || !Array.isArray(body.result)) return failure('BM_IMPORT_MALFORMED_RESPONSE', 'Sanity lookup response did not contain a result array')
    for (const [index, document] of body.result.entries()) {
      if (!document || typeof document !== 'object' || Array.isArray(document) || typeof document._id !== 'string' || !document._id) {
        return failure('BM_IMPORT_MALFORMED_RESPONSE', `Sanity lookup returned a malformed document at result index ${index}`)
      }
    }
    return { status: 'complete', documents: body.result }
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return failure('BM_IMPORT_LOOKUP_TIMEOUT', 'Sanity read-only lookup timed out')
    return failure('BM_IMPORT_LOOKUP_FAILED', 'Sanity read-only lookup could not be completed')
  }
}

/**
 * Server-side administrative transport. It accepts no GROQ from callers and
 * exposes only three fixed parameterized GET queries against the non-CDN API.
 */
export async function lookupSanityImportState({
  slug,
  canonicalId,
  draftId,
  seriesSlug = null,
  sequence = null,
  token,
  fetchImpl = globalThis.fetch,
  timeoutMs = 10_000
} = {}) {
  assertTarget(SANITY_TARGET)
  if (typeof token !== 'string' || !token.trim()) {
    return {
      series: failure('BM_IMPORT_AUTH_REQUIRED', 'Set the server-side read-only Sanity credential before online planning'),
      challenges: failure('BM_IMPORT_AUTH_REQUIRED', 'Set the server-side read-only Sanity credential before online planning'),
      sequence: { status: 'not-required', documents: [], reason: 'Series and sequence could not be resolved without authentication' },
      candidateSequence: sequence
    }
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required')
  if (typeof slug !== 'string' || typeof canonicalId !== 'string' || typeof draftId !== 'string') throw new TypeError('Validated Challenge identity is required')

  const [series, challenges] = await Promise.all([
    typeof seriesSlug === 'string' && seriesSlug
      ? query({ slug: seriesSlug, query: SERIES_QUERY, token, fetchImpl, timeoutMs })
      : { status: 'not-required', documents: [], reason: 'No series slug was supplied' },
    query({ slug, canonicalId, draftId, query: CHALLENGE_QUERY, token, fetchImpl, timeoutMs })
  ])

  let sequenceResult = { status: 'not-required', documents: [], reason: 'No published series and positive sequence require a collision lookup' }
  const eligibleSeries = series.status === 'complete'
    ? series.documents.filter(item => !item._id.startsWith('drafts.') && !item._id.startsWith('versions.'))
    : []
  if (eligibleSeries.length === 1 && series.documents.length === 1 && Number.isSafeInteger(sequence) && sequence > 0) {
    sequenceResult = await query({ seriesId: eligibleSeries[0]._id, sequence, query: SEQUENCE_QUERY, token, fetchImpl, timeoutMs })
  }
  return { series, challenges, sequence: sequenceResult, candidateSequence: sequence }
}
