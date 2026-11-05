import { compileBerryMark } from './compiler.js'
import { planBerryMarkImport } from './import-planner.js'
import { resolveBerryMarkOnlineImport } from './online-import-planner.js'
import {
  candidateSha256,
  lastImportedContentSha256,
  projectCandidateImportContent,
  projectSanityDraftImportContent
} from './import-fingerprint.js'
import { stableStringify } from './keys.js'
import {
  assertSanityDraftApplyTarget,
  sanityDraftApplyTransport
} from './sanity-draft-apply-transport.js'

export const BERRYMARK_COMPILER_CONTRACT = 'berrymark-compiler-contract-v0.1'

const clone = value => JSON.parse(JSON.stringify(value))
const hasOwn = (value, key) => Object.hasOwn(value, key)
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const same = (left, right) => stableStringify(left) === stableStringify(right)

function issue(code, message, path, extra = {}) {
  return { severity: 'error', code, message, ...(path ? { path } : {}), ...extra }
}

function safeTarget(target) {
  return target ? { projectId: target.projectId, dataset: target.dataset, apiVersion: target.apiVersion } : null
}

function safeReport(report, mode) {
  return {
    mode,
    writesAttempted: 0,
    structuralValid: report.structuralValid,
    importEligible: report.importEligible,
    sourceVerification: clone(report.sourceVerification),
    source: clone(report.source),
    proposedIdentity: clone(report.proposedIdentity),
    lookup: clone(report.lookup),
    proposedAction: report.proposedAction,
    readyFields: report.readyFields.map(item => ({ path: item.path, source: item.source, resolution: item.resolution })),
    missingRequiredMetadata: clone(report.missingRequiredMetadata),
    editorialSummary: {
      unresolvedActionable: report.unresolvedEditorialDecisions.length,
      informationalNotes: report.informationalEditorialNotes.length,
      sidecarContentIncluded: false
    },
    unresolvedLookups: clone(report.unresolvedLookups),
    conflicts: clone(report.conflicts),
    errors: clone(report.errors),
    warnings: clone(report.warnings),
    target: safeTarget(report.target),
    apply: {
      status: 'not-attempted',
      createOnly: true,
      publicationAttempted: false,
      updateAttempted: false,
      deleteAttempted: false,
      readbackVerified: false
    }
  }
}

function assertLogicalSourceFilename(filename) {
  if (typeof filename !== 'string' || !filename || filename.startsWith('/') || /^file:/i.test(filename) || filename.includes('\\') || filename.split('/').includes('..')) {
    throw new TypeError('A non-sensitive relative logical source filename is required')
  }
}

function assertOperator(operator) {
  if (typeof operator !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(operator) || operator.includes('@')) {
    throw new TypeError('A non-sensitive operator identifier is required for apply')
  }
}

function assertTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new TypeError('The apply clock must return a timezone-aware ISO timestamp')
  }
}

function addContentFingerprintEvidence(lookupResults, draftId) {
  if (!isRecord(lookupResults) || lookupResults.challenges?.status !== 'complete') return lookupResults
  const documents = lookupResults.challenges.documents.map(document => {
    if (document._id !== draftId) return document
    try {
      const currentContentSha256 = lastImportedContentSha256(document)
      const expected = document.importProvenance?.lastImportedContentSha256
      return {
        ...document,
        contentVerification: {
          status: typeof expected === 'string' && currentContentSha256 === expected ? 'verified-unchanged' : 'changed-or-untrusted',
          currentContentSha256
        }
      }
    } catch {
      return { ...document, contentVerification: { status: 'malformed-or-untrusted' } }
    }
  })
  return { ...lookupResults, challenges: { ...lookupResults.challenges, documents } }
}

function provenanceForCreate({ compilation, report, operator, importedAt, contentDigest }) {
  return {
    _type: 'importProvenance',
    sourceSystem: 'berrymark',
    compilerContract: BERRYMARK_COMPILER_CONTRACT,
    compilerMode: compilation.mode,
    canonicalId: report.proposedIdentity.canonicalId,
    sourceFilename: report.source.filename,
    sourceSha256: report.source.sha256,
    ...(typeof report.source.revision === 'string' ? { sourceRevision: report.source.revision } : {}),
    candidateSha256: contentDigest,
    lastImportedContentSha256: contentDigest,
    lastImportAction: 'create',
    importedBy: operator,
    importedAt
  }
}

export function buildBerryMarkDraftCreateDocument({ compilation, onlineReport, operator, importedAt, schemaSnapshot }) {
  if (onlineReport?.proposedAction !== 'create' || !onlineReport.importEligible) throw new TypeError('Only an eligible fresh create plan can build a draft mutation')
  assertOperator(operator)
  assertTimestamp(importedAt)
  const content = projectCandidateImportContent(compilation, schemaSnapshot)
  const contentDigest = candidateSha256(compilation, schemaSnapshot)
  const candidate = compilation.sanityCandidate
  const seriesId = onlineReport.onlineResolution?.series?._id
  return {
    _id: onlineReport.proposedIdentity.draftId,
    ...content,
    ...(seriesId ? { series: { _type: 'reference', _ref: seriesId, _weak: true } } : {}),
    ...(hasOwn(candidate, 'sequence') ? { sequence: candidate.sequence } : {}),
    ...(hasOwn(candidate, 'releaseAt') ? { releaseAt: candidate.releaseAt } : {}),
    importProvenance: provenanceForCreate({ compilation, report: onlineReport, operator, importedAt, contentDigest })
  }
}

function verifyPublishingFields(document, expected) {
  for (const field of ['series', 'sequence', 'releaseAt']) {
    if (hasOwn(expected, field) !== hasOwn(document, field)) return false
    if (hasOwn(expected, field) && !same(document[field], expected[field])) return false
  }
  return true
}

function verifyCreatedDraft({ document, expected, contentDigest, allowConcurrentCreator }) {
  if (!isRecord(document) || document._id !== expected._id || document._type !== 'challenge') return false
  let projection
  let actualDigest
  try {
    projection = projectSanityDraftImportContent(document)
    actualDigest = lastImportedContentSha256(document)
  } catch {
    return false
  }
  const expectedProjection = projectSanityDraftImportContent(expected)
  if (!same(projection, expectedProjection) || actualDigest !== contentDigest || !verifyPublishingFields(document, expected)) return false
  const actual = document.importProvenance
  const wanted = expected.importProvenance
  if (!isRecord(actual)) return false
  const lineageFields = [
    '_type', 'sourceSystem', 'compilerContract', 'compilerMode', 'canonicalId',
    'sourceFilename', 'sourceRevision', 'sourceSha256', 'candidateSha256',
    'lastImportedContentSha256', 'lastImportAction'
  ]
  for (const field of lineageFields) {
    if (hasOwn(actual, field) !== hasOwn(wanted, field) || (hasOwn(wanted, field) && !same(actual[field], wanted[field]))) return false
  }
  if (hasOwn(actual, 'previousSourceSha256')) return false
  if (!allowConcurrentCreator && (actual.importedBy !== wanted.importedBy || actual.importedAt !== wanted.importedAt)) return false
  return typeof actual.importedBy === 'string' && typeof actual.importedAt === 'string'
}

function failedApply(report, code, message, path) {
  report.importEligible = false
  report.proposedAction = report.proposedAction === 'reject' ? 'reject' : 'unknown'
  report.errors.push(issue(code, message, path))
  return report
}

/**
 * Administrative create-only apply. All network behavior is injected through
 * the fixed transport; dry-run performs no credential, target, or network work.
 */
export async function runBerryMarkDraftApply({
  source,
  sourceFilename,
  schemaSnapshot,
  apply = false,
  target,
  token,
  operator,
  now = () => new Date().toISOString(),
  transport = sanityDraftApplyTransport
} = {}) {
  if (typeof source !== 'string') throw new TypeError('The exact BerryMark source text is required')
  assertLogicalSourceFilename(sourceFilename)
  if (apply) assertOperator(operator)
  const compilation = compileBerryMark(source, { filename: sourceFilename })
  const offlineReport = planBerryMarkImport({ compilation, source, schemaSnapshot })
  const report = safeReport(offlineReport, apply ? 'apply' : 'dry-run')
  if (!apply) return report
  report.target = safeTarget(target)

  if (offlineReport.proposedAction === 'reject' || !offlineReport.importEligible || !offlineReport.sourceVerification.verified) {
    report.apply.status = 'blocked-local-preflight'
    return report
  }
  try { assertSanityDraftApplyTarget(target) } catch (error) {
    report.apply.status = 'blocked-target'
    return failedApply(report, 'BM_IMPORT_TARGET_NOT_AUTHORIZED', error.message, 'target')
  }
  if (typeof token !== 'string' || !token.trim()) {
    report.apply.status = 'blocked-credential'
    return failedApply(report, 'BM_IMPORT_AUTH_REQUIRED', 'Set the separate restricted Sanity write credential before apply', 'credential')
  }

  let lookups
  try {
    lookups = await transport.lookup({
      ...offlineReport.proposedIdentity,
      seriesSlug: compilation.reviewReport.pendingLookups.find(item => item.type === 'challengeSeriesSlug')?.slug ?? null,
      sequence: compilation.sanityCandidate.sequence ?? null,
      target,
      token
    })
  } catch {
    report.apply.status = 'blocked-preflight'
    return failedApply(report, 'BM_IMPORT_LOOKUP_FAILED', 'Fresh authenticated preflight could not be completed', 'lookup')
  }
  const verifiedLookups = addContentFingerprintEvidence(lookups, offlineReport.proposedIdentity.draftId)
  const online = resolveBerryMarkOnlineImport({ offlineReport, lookupResults: verifiedLookups })
  const resolved = safeReport(online, 'apply')
  resolved.target = safeTarget(target)
  resolved.apply = report.apply
  Object.assign(report, resolved)

  if (online.proposedAction === 'none' && online.importEligible && online.onlineResolution?.contentVerification === 'verified-unchanged') {
    report.apply.status = 'verified-noop'
    report.apply.readbackVerified = true
    report.appliedAction = 'none'
    return report
  }
  if (online.proposedAction !== 'create' || !online.importEligible || online.lookup.status !== 'complete') {
    report.apply.status = 'blocked-online-preflight'
    report.importEligible = false
    if (online.proposedAction === 'update') {
      report.proposedAction = 'reject'
      report.errors.push(issue('BM_IMPORT_CREATE_ONLY', 'This administrative pathway never updates an existing draft', 'proposedAction'))
    }
    return report
  }

  let document
  try {
    document = buildBerryMarkDraftCreateDocument({
      compilation,
      onlineReport: online,
      operator,
      importedAt: now(),
      schemaSnapshot
    })
  } catch {
    report.apply.status = 'blocked-payload'
    return failedApply(report, 'BM_IMPORT_SCHEMA_INCOMPATIBLE', 'The validated candidate could not be represented under the approved create schema', 'sanityCandidate')
  }
  report.provenance = {
    sourceSha256: document.importProvenance.sourceSha256,
    candidateSha256: document.importProvenance.candidateSha256,
    lastImportedContentSha256: document.importProvenance.lastImportedContentSha256
  }

  let mutation
  report.writesAttempted = 1
  report.apply.status = 'mutation-attempted'
  try {
    mutation = await transport.createIfNotExists({ document, target, token })
  } catch {
    mutation = { status: 'failed', error: issue('BM_IMPORT_APPLY_FAILED', 'The create-only Sanity mutation could not be completed') }
  }
  if (mutation?.status !== 'complete' || typeof mutation.created !== 'boolean') {
    report.apply.status = 'mutation-failed'
    const error = mutation?.error
    return failedApply(report,
      typeof error?.code === 'string' ? error.code : 'BM_IMPORT_APPLY_FAILED',
      typeof error?.message === 'string' ? error.message : 'The create-only Sanity mutation failed',
      'mutation')
  }

  let readback
  try { readback = await transport.readDraft({ draftId: document._id, target, token }) } catch {
    readback = { status: 'failed', error: issue('BM_IMPORT_READBACK_FAILED', 'The draft readback could not be completed') }
  }
  if (readback?.status !== 'complete') {
    report.apply.status = 'readback-failed'
    const error = readback?.error
    return failedApply(report,
      typeof error?.code === 'string' ? error.code : 'BM_IMPORT_READBACK_FAILED',
      typeof error?.message === 'string' ? error.message : 'The exact draft could not be read back',
      'readback')
  }
  const verified = verifyCreatedDraft({
    document: readback.document,
    expected: document,
    contentDigest: document.importProvenance.lastImportedContentSha256,
    allowConcurrentCreator: !mutation.created
  })
  if (!verified) {
    report.apply.status = 'readback-mismatch'
    return failedApply(report, 'BM_IMPORT_READBACK_MISMATCH', 'Readback did not match the exact candidate, publishing metadata, and create provenance', 'readback')
  }

  report.apply.status = mutation.created ? 'created-and-verified' : 'concurrent-create-verified-noop'
  report.apply.readbackVerified = true
  report.apply.raceHandledWithoutOverwrite = !mutation.created
  report.appliedAction = mutation.created ? 'create' : 'none'
  report.draftId = document._id
  return report
}
