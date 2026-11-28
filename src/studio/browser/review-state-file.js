export const REVIEW_FILE_FORMAT = 'berrymark-studio-review-file-v1'
export const REVIEW_STATE_VERSION = 'berrymark-studio-review-v1'

export class ReviewCompanionError extends Error {
  constructor(code, message, phase = null) {
    super(message)
    this.name = 'ReviewCompanionError'
    this.code = code
    this.phase = phase
  }
}

function parseJson(text) {
  if (typeof text !== 'string' || !text.trim()) return null
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

function validReviewState(value, digest) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    value.version === REVIEW_STATE_VERSION &&
    typeof digest === 'string' && value.sourceSha256 === digest &&
    typeof value.approvalStale === 'boolean'
}

function retainStaleApproval(previous, target) {
  if (previous?.sourceSha256 === target.sourceSha256 && previous.approvalStale && !target.approvalStale) {
    return { ...target, approvalStale: true }
  }
  return target
}

function transactionState(transaction, key) {
  const digest = transaction[`${key}SourceSha256`]
  const reviewState = transaction[`${key}ReviewState`]
  if (typeof digest !== 'string') return null
  if (reviewState !== null && !validReviewState(reviewState, digest)) return null
  return { digest, reviewState }
}

export function companionFilename(manuscriptName) {
  return `${manuscriptName || 'untitled.berry.md'}.review.json`
}

export function recoverReviewCompanion(manuscriptSha256, companionText) {
  if (companionText === null || companionText === undefined) {
    return {
      status: 'missing',
      reviewState: null,
      requiresResetConfirmation: true,
      message: 'No review companion was supplied. Source-only opening cannot restore earlier edit-history warnings.'
    }
  }
  const companion = parseJson(companionText)
  if (!companion || companion.format !== REVIEW_FILE_FORMAT) {
    return {
      status: 'malformed',
      reviewState: null,
      requiresResetConfirmation: true,
      message: 'The review companion is malformed or unsupported. The manuscript is preserved, but review history cannot be restored.'
    }
  }
  if (companion.transaction?.phase !== 'prepared' && companion.sourceSha256 === manuscriptSha256 && validReviewState(companion.reviewState, manuscriptSha256)) {
    return {
      status: 'matched',
      reviewState: JSON.stringify(companion.reviewState),
      requiresResetConfirmation: false,
      message: 'Review history matches this manuscript.'
    }
  }
  const transaction = companion.transaction
  if (transaction?.phase === 'prepared' && typeof transaction.id === 'string') {
    const target = transactionState(transaction, 'target')
    const previous = transactionState(transaction, 'previous')
    if (target?.digest === manuscriptSha256 && target.reviewState) {
      return {
        status: 'recovered-target',
        reviewState: JSON.stringify(retainStaleApproval(previous?.reviewState, target.reviewState)),
        requiresResetConfirmation: false,
        message: previous?.digest === target.digest
          ? 'An earlier save was interrupted. Studio safely recovered the matching review history for both identical versions; save again to finalize the companion.'
          : 'An earlier save stopped after updating the manuscript. Studio safely recovered its matching review history; save again to finalize the companion.'
      }
    }
    if (previous?.digest === manuscriptSha256) {
      return {
        status: 'recovered-previous',
        reviewState: previous.reviewState ? JSON.stringify(previous.reviewState) : null,
        requiresResetConfirmation: false,
        message: 'An earlier save stopped before changing the manuscript. Studio retained the previous manuscript and its matching review history.'
      }
    }
  }
  return {
    status: 'mismatched',
    reviewState: null,
    requiresResetConfirmation: true,
    message: 'The review companion belongs to different manuscript content. Studio did not discard it or invent review history.'
  }
}

function preparedCompanion({
  transactionId,
  manuscriptName,
  previousSourceSha256,
  previousReviewState,
  targetSourceSha256,
  targetReviewState
}) {
  const target = parseJson(targetReviewState)
  if (!validReviewState(target, targetSourceSha256)) {
    throw new ReviewCompanionError('BM_STUDIO_REVIEW_STATE_INVALID', 'The engine returned review state that does not match the manuscript being saved')
  }
  const previous = previousReviewState ? parseJson(previousReviewState) : null
  if (previousReviewState && !validReviewState(previous, previousSourceSha256)) {
    throw new ReviewCompanionError('BM_STUDIO_REVIEW_STATE_INVALID', 'The previous review state is invalid')
  }
  const retainedTarget = retainStaleApproval(previous, target)
  return {
    format: REVIEW_FILE_FORMAT,
    manuscript: manuscriptName,
    sourceSha256: targetSourceSha256,
    reviewState: retainedTarget,
    transaction: {
      id: transactionId,
      phase: 'prepared',
      previousSourceSha256: previousSourceSha256 ?? null,
      previousReviewState: previous,
      targetSourceSha256,
      targetReviewState: retainedTarget
    }
  }
}

export async function saveReviewBoundDocument({
  store,
  source,
  sourceSha256,
  reviewState,
  previousSourceSha256 = null,
  manuscriptName = 'untitled.berry.md',
  transactionId = globalThis.crypto.randomUUID(),
  allowCompanionReset = false,
  onPhase = () => {}
}) {
  if (typeof source !== 'string' || !store) throw new TypeError('A source string and file store are required')
  let priorCompanion = null
  try {
    priorCompanion = await store.readReviewState()
  } catch (error) {
    if (error?.name !== 'NotFoundError' && error?.code !== 'ENOENT') {
      throw new ReviewCompanionError('BM_STUDIO_REVIEW_READ_FAILED', 'Studio could not inspect the review companion; nothing was written', 'inspect')
    }
  }

  let previousReviewState = null
  if (previousSourceSha256) {
    const recovered = recoverReviewCompanion(previousSourceSha256, priorCompanion)
    if (recovered.reviewState) previousReviewState = recovered.reviewState
    if (recovered.requiresResetConfirmation && !allowCompanionReset) {
      throw new ReviewCompanionError('BM_STUDIO_REVIEW_RESET_CONFIRMATION', recovered.message, 'confirmation')
    }
  }

  const prepared = preparedCompanion({
    transactionId,
    manuscriptName,
    previousSourceSha256,
    previousReviewState,
    targetSourceSha256: sourceSha256,
    targetReviewState: reviewState
  })
  const completed = {
    ...prepared,
    transaction: { ...prepared.transaction, phase: 'complete' }
  }

  await store.verifyManuscript?.()
  onPhase('prepare-review')
  try {
    await store.writeReviewState(`${JSON.stringify(prepared, null, 2)}\n`)
  } catch (error) {
    throw new ReviewCompanionError('BM_STUDIO_SAVE_REVIEW_PREPARE_FAILED', 'Studio could not prepare the review companion. The manuscript was not written; changes remain unsaved.', 'prepare-review')
  }

  await store.verifyManuscript?.()
  onPhase('write-manuscript')
  try {
    await store.writeManuscript(source)
  } catch (error) {
    throw new ReviewCompanionError('BM_STUDIO_SAVE_MANUSCRIPT_FAILED', 'The manuscript write failed or was interrupted. Changes remain unsaved; the companion contains recovery information.', 'write-manuscript')
  }

  onPhase('finalize-review')
  try {
    await store.writeReviewState(`${JSON.stringify(completed, null, 2)}\n`)
  } catch (error) {
    throw new ReviewCompanionError('BM_STUDIO_SAVE_FINALIZE_FAILED', 'The manuscript was written, but the review companion was not finalized. Changes remain marked unsaved; reopening can recover the matching prepared state.', 'finalize-review')
  }

  onPhase('complete')
  return { transactionId, companion: completed }
}
