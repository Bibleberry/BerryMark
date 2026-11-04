import { compileBerryMark } from './compiler.js'
import { sha256, stableStringify } from './keys.js'
import { validateImportCompilation } from './import-validation.js'

const hasOwn = (value, key) => Object.hasOwn(value, key)
const same = (left, right) => stableStringify(left) === stableStringify(right)
const clone = value => JSON.parse(JSON.stringify(value))

function issue(code, message, path, extra = {}) {
  return { severity: 'error', code, message, ...(path ? { path } : {}), ...extra }
}

function annotation(item, sourceFilename, classification) {
  return {
    originalCategory: item.kind,
    classification,
    status: item.status,
    text: item.text,
    sourceLocation: {
      filename: sourceFilename,
      line: item.line,
      column: item.column
    },
    reviewHistory: clone(item.reviewHistory ?? [])
  }
}

function collectScriptureRights(candidate) {
  const requirements = []
  const visit = (value, path) => {
    if (value?._type === 'scriptureReference' && value.textStatus === 'provided') {
      requirements.push({
        type: 'scriptureRightsEvidence',
        status: 'required',
        path,
        reference: value.reference,
        translation: value.translation,
        reason: 'The compiler rights Boolean is an author assertion; independent human rights evidence is required before passage text can be imported'
      })
    }
  }
  visit(candidate?.primaryScripture, 'sanityCandidate.primaryScripture')
  candidate?.screens?.forEach((screen, screenIndex) => {
    screen.blocks?.forEach((block, blockIndex) => {
      const path = `sanityCandidate.screens[${screenIndex}].blocks[${blockIndex}]`
      if (block._type === 'scriptureBlock') visit(block.scripture, `${path}.scripture`)
      if (block._type === 'optionalStudyBlock') block.scriptures?.forEach((item, index) => visit(item, `${path}.scriptures[${index}]`))
    })
  })
  return requirements
}

function readyFields(candidate) {
  if (!candidate || typeof candidate !== 'object') return []
  const fields = []
  const ready = (path, source, resolution = 'mapped without value changes') => fields.push({ path, source, resolution })
  ready('title', 'challenge.title')
  ready('slug.current', 'challenge.slug')
  ready('challengeType', 'challenge.type')
  if (hasOwn(candidate, 'summary')) ready('summary', 'challenge.summary')
  ready('primaryScripture', 'scripture')
  ready('screens', 'SCREEN and CB1–CB9 structures')
  if (hasOwn(candidate, 'companionLinks')) ready('companionLinks', 'companionLinks')
  ready('editorialReview.sourceTitle', 'editorial.sourceTitle')
  if (hasOwn(candidate.editorialReview ?? {}, 'sourceRevision')) ready('editorialReview.sourceRevision', 'editorial.sourceRevision')
  ready('editorialReview.adaptationReviewed', 'controlled conservative mapping', 'false; no source approval transferred')
  if (hasOwn(candidate, 'sequence')) ready('sequence', 'publishing.sequence')
  if (hasOwn(candidate, 'releaseAt')) ready('releaseAt', 'publishing.releaseAt')
  return fields
}

function missingMetadata(compilation, candidate) {
  const states = compilation?.reviewReport?.metadataStates ?? {}
  const missing = []
  const add = (path, state, sourcePath, reason) => missing.push({
    path,
    sourcePath,
    state,
    blocksPublication: true,
    reason
  })
  const seriesState = states['publishing.series']?.state ?? (candidate?.series ? 'value' : 'absent')
  add('series', seriesState === 'value' ? 'value-requires-reference-resolution' : seriesState, 'publishing.series', 'An existing published challengeSeries must be resolved by an authenticated read-only lookup; no series is created')
  for (const field of ['sequence', 'releaseAt']) {
    if (!hasOwn(candidate ?? {}, field)) {
      add(field, states[`publishing.${field}`]?.state ?? 'absent', `publishing.${field}`, `No ${field} value was inferred`)
    }
  }
  return missing
}

/**
 * Produce a deterministic offline dry-run report. This function performs no I/O,
 * network requests, Sanity writes, approval transfers, or source normalization.
 * The caller supplies the existing Bibleberry schema snapshot as data.
 */
export function planBerryMarkImport({ compilation, source, schemaSnapshot } = {}) {
  const validation = validateImportCompilation(compilation, schemaSnapshot)
  const errors = [...validation.errors]
  const warnings = [...validation.warnings]
  const sourceReport = compilation?.reviewReport?.source
  const sourceFilename = sourceReport?.filename ?? '<input>'
  const sourceSupplied = typeof source === 'string'
  let actualSourceSha256
  let verified = false

  if (sourceSupplied && sourceReport && typeof sourceReport.sha256 === 'string') {
    actualSourceSha256 = sha256(source)
    if (actualSourceSha256 !== sourceReport.sha256) {
      errors.push(issue('BM_IMPORT_ARTIFACT_MISMATCH', 'The exact source fingerprint does not match the compiler artifact', 'reviewReport.source.sha256', {
        filename: sourceFilename,
        expectedSha256: sourceReport.sha256,
        actualSha256: actualSourceSha256
      }))
    } else {
      const recompiled = compileBerryMark(source, { filename: sourceFilename })
      verified = same(recompiled, compilation)
      if (!verified) {
        errors.push(issue('BM_IMPORT_ARTIFACT_MISMATCH', 'Recompilation does not match the supplied candidate or review report', 'result', {
          filename: sourceFilename
        }))
      }
    }
  }

  const candidate = compilation?.sanityCandidate
  const slug = typeof candidate?.slug?.current === 'string' ? candidate.slug.current : null
  const canonicalId = slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 96
    ? `berrymark-challenge-${slug}`
    : null
  const rightsRequirements = validation.structuralValid ? collectScriptureRights(candidate) : []
  for (const requirement of rightsRequirements) {
    warnings.push({
      severity: 'warning',
      code: 'BM_IMPORT_RIGHTS_EVIDENCE_REQUIRED',
      message: requirement.reason,
      path: requirement.path,
      reference: requirement.reference,
      translation: requirement.translation
    })
  }

  const identityLookup = {
    type: 'challengeIdentityAndSlug',
    status: 'required',
    reason: 'Authenticated duplicate checks must cover the canonical ID, exact draft ID, and matching slug under other IDs'
  }
  const seriesLookup = compilation?.reviewReport?.pendingLookups?.map(item => ({
    type: item.type,
    status: 'required',
    slug: item.slug,
    sourcePath: item.sourcePath,
    destinationPath: item.destinationPath,
    reason: item.reason
  })) ?? []
  const unresolvedLookups = [identityLookup, ...seriesLookup, ...rightsRequirements]
  const editorialItems = Array.isArray(compilation?.reviewReport?.editorialItems) ? compilation.reviewReport.editorialItems : []
  const unresolvedEditorialDecisions = editorialItems.filter(item => (
    item.kind === 'TODO' || item.kind === 'REVIEW REQUIRED' || (item.kind === 'EDITORIAL NOTE' && item.classification === 'actionable')
  )).map(item => annotation(item, sourceFilename, 'actionable'))
  const informationalEditorialNotes = editorialItems.filter(item => (
    item.kind === 'EDITORIAL NOTE' && item.classification !== 'actionable'
  )).map(item => annotation(item, sourceFilename, 'informational'))

  const sourceVerification = {
    state: sourceSupplied ? 'source-verified' : 'artifact-only',
    independentSourceComparisonPerformed: sourceSupplied,
    verified: sourceSupplied ? verified : false,
    ...(actualSourceSha256 ? { actualSourceSha256 } : {}),
    ...(!sourceSupplied ? { note: 'Independent source verification was not performed; only structural and internal-consistency validation was possible' } : {})
  }
  const importEligible = validation.structuralValid && verified && rightsRequirements.length === 0
  const rejected = !validation.structuralValid || (sourceSupplied && !verified)

  return {
    mode: 'dry-run',
    writesAttempted: 0,
    structuralValid: validation.structuralValid,
    importEligible,
    sourceVerification,
    source: {
      filename: sourceFilename,
      sha256: sourceReport?.sha256 ?? null,
      revision: sourceReport?.revision ?? null
    },
    proposedIdentity: {
      slug,
      canonicalId,
      draftId: canonicalId ? `drafts.${canonicalId}` : null
    },
    lookup: {
      status: 'offline',
      dependencies: clone(unresolvedLookups)
    },
    proposedAction: rejected ? 'reject' : 'unknown',
    readyFields: readyFields(candidate),
    missingRequiredMetadata: missingMetadata(compilation, candidate),
    unresolvedEditorialDecisions,
    informationalEditorialNotes,
    unresolvedLookups,
    conflicts: [],
    errors,
    warnings,
    provenanceChanges: {
      approvalTransferred: false,
      annotationTextAddedToReaderContent: false,
      sourceOrArtifactRepairPerformed: false
    },
    target: {
      repository: schemaSnapshot?.repository ?? null,
      projectId: null,
      dataset: null,
      schemaRevision: schemaSnapshot?.revision ?? null,
      status: 'offline-schema-snapshot-only'
    }
  }
}
