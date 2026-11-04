import { SANITY_TARGET } from './sanity-target.js'

const clone = value => JSON.parse(JSON.stringify(value))
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const isDraft = id => id.startsWith('drafts.')
const isRelease = id => id.startsWith('versions.')

function issue(code, message, path, extra = {}) {
  return { severity: 'error', code, message, ...(path ? { path } : {}), ...extra }
}

function warning(code, message, path, extra = {}) {
  return { severity: 'warning', code, message, ...(path ? { path } : {}), ...extra }
}

function failedResult(code, message, path) {
  return { status: 'failed', documents: [], error: issue(code, message, path) }
}

function normalizeLookup(value, path, allowNotRequired = true) {
  if (!isRecord(value)) return failedResult('BM_IMPORT_LOOKUP_INVALID', `${path} must be a structured lookup result`, path)
  if (value.status === 'not-required') {
    if (!allowNotRequired) return failedResult('BM_IMPORT_LOOKUP_INCOMPLETE', `${path} was required but not completed`, path)
    return { status: 'not-required', documents: [], reason: value.reason ?? 'Lookup is not applicable' }
  }
  if (value.status === 'failed') {
    return {
      status: 'failed',
      documents: [],
      error: issue(
        typeof value.error?.code === 'string' ? value.error.code : 'BM_IMPORT_LOOKUP_FAILED',
        typeof value.error?.message === 'string' ? value.error.message : `${path} did not complete`,
        path
      )
    }
  }
  if (value.status !== 'complete' || !Array.isArray(value.documents)) {
    return failedResult('BM_IMPORT_LOOKUP_INCOMPLETE', `${path} is incomplete or malformed`, path)
  }
  const ids = new Set()
  for (const [index, document] of value.documents.entries()) {
    if (!isRecord(document) || typeof document._id !== 'string' || !document._id) {
      return failedResult('BM_IMPORT_MALFORMED_RESPONSE', `${path}.documents[${index}] has no valid Sanity _id`, path)
    }
    if (ids.has(document._id)) return failedResult('BM_IMPORT_MALFORMED_RESPONSE', `${path} returned duplicate document ID ${document._id}`, path)
    ids.add(document._id)
  }
  return { status: 'complete', documents: clone(value.documents) }
}

function resolveSeries(result, slug, conflicts, unresolved) {
  if (typeof slug !== 'string' || !slug) {
    return { state: 'not-supplied', eligible: false, documentId: null, lookup: result }
  }
  if (result.status !== 'complete') {
    return { state: 'lookup-failed', eligible: false, documentId: null, lookup: result }
  }
  const documents = result.documents
  const published = documents.filter(item => !isDraft(item._id) && !isRelease(item._id))
  const drafts = documents.filter(item => isDraft(item._id))
  const releases = documents.filter(item => isRelease(item._id))
  if (releases.length || published.length > 1 || drafts.length > 1 || (published.length && drafts.length)) {
    const conflict = issue('BM_IMPORT_SERIES_CONFLICT', 'Series slug has multiple or unsupported document variants; no reference was selected', 'publishing.series', {
      slug,
      documentIds: documents.map(item => item._id)
    })
    conflicts.push(conflict)
    return { state: 'conflict', eligible: false, documentId: null, lookup: result }
  }
  if (published.length === 1) {
    const document = published[0]
    if (document.slug !== undefined && document.slug !== slug) {
      const conflict = issue('BM_IMPORT_SERIES_CONFLICT', 'A series lookup result does not match the requested slug', 'publishing.series', { slug, documentId: document._id })
      conflicts.push(conflict)
      return { state: 'conflict', eligible: false, documentId: null, lookup: result }
    }
    return { state: 'published', eligible: true, documentId: document._id, slug, lookup: result }
  }
  if (drafts.length === 1) {
    const item = warning('BM_IMPORT_SERIES_DRAFT_ONLY', 'Series exists only as a draft; no published-series reference can be resolved', 'publishing.series', {
      slug,
      draftId: drafts[0]._id,
      seriesState: 'draft-only'
    })
    unresolved.push({ type: 'publishedChallengeSeries', status: 'unresolved', slug, seriesState: 'draft-only', reason: item.message })
    return { state: 'draft-only', eligible: false, documentId: null, lookup: result }
  }
  const item = warning('BM_IMPORT_SERIES_NOT_FOUND', 'No published or draft series matches the authored slug', 'publishing.series', { slug, seriesState: 'missing' })
  unresolved.push({ type: 'publishedChallengeSeries', status: 'unresolved', slug, seriesState: 'missing', reason: item.message })
  return { state: 'missing', eligible: false, documentId: null, lookup: result }
}

function trustworthyContentVerification(document) {
  const verification = document?.contentVerification
  return verification?.status === 'verified-unchanged'
    && typeof verification.currentContentSha256 === 'string'
    && verification.currentContentSha256 === document?.importProvenance?.lastImportedContentSha256
}

function reviewIsUnapproved(document) {
  if (document?.editorialReview?.adaptationReviewed === true) return false
  if (document.editorialReview?.reviewedAt || document.editorialReview?.reviewedBy) return false
  if (!Array.isArray(document.blockReviewStates)) return false
  const structuredTypes = ['comparisonBlock', 'visualCardsBlock', 'connectedSequenceBlock', 'reflectionBlock', 'optionalStudyBlock']
  return document.blockReviewStates.every(item => !structuredTypes.includes(item._type) || item.reviewStatus === 'proposed')
}

/**
 * Purely combine a successful source-verified offline plan with injected Sanity
 * lookup records. No I/O, credentials, current time, or write authorization.
 */
export function resolveBerryMarkOnlineImport({ offlineReport, lookupResults, expectedPreviousSourceSha256 } = {}) {
  if (!isRecord(offlineReport)) throw new TypeError('An offline dry-run report is required')
  const report = clone(offlineReport)
  const errors = [...report.errors]
  const warnings = [...report.warnings]
  const conflicts = []
  const unresolved = []
  const resolved = {
    series: null,
    contentVerification: 'not-available'
  }

  report.lookup = { status: 'not-run', dependencies: clone(report.lookup?.dependencies ?? []) }
  report.target = { ...report.target, ...SANITY_TARGET, status: 'read-only-online-planning' }
  report.writesAttempted = 0
  report.provenanceChanges = {
    ...report.provenanceChanges,
    sanityMutationsAttempted: false,
    freshWriteAuthorizationGranted: false
  }

  if (report.proposedAction === 'reject' || !report.structuralValid || !report.sourceVerification?.verified) {
    report.proposedAction = report.proposedAction === 'reject' ? 'reject' : 'unknown'
    report.importEligible = false
    report.onlineResolution = { state: 'offline-prerequisite-failed', ...resolved }
    return report
  }
  if (!report.importEligible) {
    report.proposedAction = 'unknown'
    report.onlineResolution = { state: 'offline-prerequisite-failed', ...resolved }
    return report
  }

  const seriesSlug = report.missingRequiredMetadata?.find(item => item.path === 'series')?.state === 'value-requires-reference-resolution'
    ? report.warnings?.find(item => item.code === 'BM_SERIES_LOOKUP_REQUIRED')?.value
      ?? report.unresolvedLookups?.find(item => item.type === 'challengeSeriesSlug')?.slug
    : null
  const seriesLookup = normalizeLookup(lookupResults?.series, 'lookup.series', !seriesSlug)
  const challengeLookup = normalizeLookup(lookupResults?.challenges, 'lookup.challenges', false)
  const sequenceInput = lookupResults?.sequence ?? { status: 'not-required', reason: 'No sequence lookup was requested' }
  let sequenceLookup = normalizeLookup(sequenceInput, 'lookup.sequence')
  const lookupErrors = [seriesLookup, challengeLookup, sequenceLookup]
    .filter(item => item.status === 'failed')
    .map(item => item.error)
  errors.push(...lookupErrors)

  const series = resolveSeries(seriesLookup, seriesSlug, conflicts, unresolved)
  resolved.series = series.documentId ? { _id: series.documentId, slug: seriesSlug, state: 'published' } : null
  if (['missing', 'draft-only'].includes(series.state)) {
    const item = seriesLookup.documents.length && series.state === 'draft-only'
      ? warning('BM_IMPORT_SERIES_DRAFT_ONLY', 'Series exists only as a draft; no published-series reference can be resolved', 'publishing.series', { slug: seriesSlug, draftId: seriesLookup.documents[0]._id, seriesState: 'draft-only' })
      : warning('BM_IMPORT_SERIES_NOT_FOUND', 'No published or draft series matches the authored slug', 'publishing.series', { slug: seriesSlug, seriesState: 'missing' })
    warnings.push(item)
  }

  let action = 'create'
  if (challengeLookup.status !== 'complete') {
    action = 'unknown'
  } else {
    const { canonicalId, draftId, slug } = report.proposedIdentity
    const documents = challengeLookup.documents
    const canonical = documents.find(item => item._id === canonicalId)
    const draft = documents.find(item => item._id === draftId)
    const unexpected = documents.filter(item => item._id !== canonicalId && item._id !== draftId)
    if (canonical) {
      conflicts.push(issue('BM_IMPORT_ID_CONFLICT', 'The proposed canonical Challenge ID already has a published document', 'sanityCandidate._id', { documentId: canonical._id, slug }))
      action = 'reject'
    }
    if (unexpected.length) {
      conflicts.push(issue('BM_IMPORT_DUPLICATE_SLUG', 'The authored Challenge slug exists under another Sanity identity or release variant', 'sanityCandidate.slug.current', {
        slug,
        documentIds: unexpected.map(item => item._id)
      }))
      action = 'reject'
    }
    if (draft && action !== 'reject') {
      const provenance = draft.importProvenance
      const owned = provenance?.sourceSystem === 'berrymark'
        && provenance?.canonicalId === canonicalId
        && typeof provenance?.sourceSha256 === 'string'
        && typeof provenance?.lastImportedContentSha256 === 'string'
      if (!owned) {
        conflicts.push(issue('BM_IMPORT_ID_CONFLICT', 'The deterministic draft exists without trustworthy matching BerryMark provenance', 'sanityCandidate._id', { documentId: draftId }))
        action = 'reject'
      } else {
        const unchanged = trustworthyContentVerification(draft)
        resolved.contentVerification = unchanged ? 'verified-unchanged' : 'missing-or-untrusted'
        if (provenance.sourceSha256 === report.source?.sha256) {
          if (unchanged) action = 'none'
          else {
            action = 'unknown'
            unresolved.push({ type: 'currentImportedContentVerification', status: 'required', documentId: draftId, reason: 'Same-source no-op requires trustworthy evidence that the current draft content is unchanged' })
          }
        } else if (!reviewIsUnapproved(draft)) {
          conflicts.push(issue('BM_IMPORT_APPROVED_DRAFT_CONFLICT', 'A revised import cannot replace an approved, reviewed, or non-proposed draft', 'sanityCandidate.editorialReview', { documentId: draftId }))
          action = 'reject'
        } else if (typeof expectedPreviousSourceSha256 !== 'string' || expectedPreviousSourceSha256 !== provenance.sourceSha256) {
          conflicts.push(issue('BM_IMPORT_REVISION_CONFLICT', 'A revised import requires the exact expected previous source digest', 'provenance.previousSourceSha256', { documentId: draftId }))
          action = 'reject'
        } else if (!unchanged) {
          action = 'unknown'
          unresolved.push({ type: 'currentImportedContentVerification', status: 'required', documentId: draftId, reason: 'Exceptional update requires trustworthy evidence that importer-owned draft content is unchanged' })
        } else action = 'update'
      }
    }
  }

  const candidateSequence = lookupResults?.candidateSequence
  const sequenceRequired = series.state === 'published' && Number.isSafeInteger(candidateSequence) && candidateSequence > 0
  if (sequenceRequired) {
    if (sequenceLookup.status === 'not-required') {
      sequenceLookup = failedResult('BM_IMPORT_LOOKUP_INCOMPLETE', 'lookup.sequence was required but not completed', 'lookup.sequence')
      lookupErrors.push(sequenceLookup.error)
      errors.push(sequenceLookup.error)
    }
    if (sequenceLookup.status !== 'complete') {
      if (action === 'create') action = 'unknown'
    } else {
      const collisions = sequenceLookup.documents.filter(item => ![report.proposedIdentity.canonicalId, report.proposedIdentity.draftId].includes(item._id))
      if (collisions.length) {
        conflicts.push(issue('BM_IMPORT_SEQUENCE_COLLISION', 'Another Challenge already uses the authored sequence in the resolved series', 'publishing.sequence', {
          sequence: candidateSequence,
          seriesId: series.documentId,
          documentIds: collisions.map(item => item._id)
        }))
        action = 'reject'
      }
    }
  }

  if (conflicts.length) action = 'reject'
  if (lookupErrors.length && action === 'create') action = 'unknown'
  if (series.state === 'lookup-failed' && action === 'create') action = 'unknown'
  errors.push(...conflicts)
  report.lookup = {
    status: lookupErrors.length ? 'failed' : 'complete',
    perspective: 'raw',
    dependencies: clone(report.lookup.dependencies),
    series: { state: series.state, eligibleForReference: series.eligible, ...(series.documentId ? { documentId: series.documentId } : {}) },
    challenge: { state: challengeLookup.status, documentCount: challengeLookup.documents.length },
    sequence: { state: sequenceRequired ? sequenceLookup.status : 'not-required', documentCount: sequenceLookup.documents.length }
  }
  report.proposedAction = action
  report.importEligible = report.importEligible && ['create', 'update', 'none'].includes(action)
  report.unresolvedLookups = [...report.unresolvedLookups, ...unresolved]
  report.conflicts = conflicts
  report.errors = errors
  report.warnings = warnings
  report.onlineResolution = {
    state: lookupErrors.length ? 'incomplete' : 'resolved',
    ...resolved,
    updatePolicy: 'exceptional-only-with-source-content-and-approval-evidence'
  }
  return report
}
