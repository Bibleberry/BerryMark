import { parseBerryMark } from './parser.js'
import { blockScriptureValue } from './scripture.js'
import { generatedKey, sha256 } from './keys.js'
import { markdownToPortableText } from './portable-text.js'

const hasOwn = (object, key) => Object.hasOwn(object, key)
const hasValue = (object, key) => hasOwn(object, key) && object[key] !== null && object[key] !== undefined
const clone = value => JSON.parse(JSON.stringify(value))
const REVIEWED_TYPES = new Set(['CB4', 'CB5', 'CB6', 'CB7', 'CB8'])

function valueState(object, key) {
  if (!hasOwn(object, key)) return { state: 'absent' }
  if (object[key] === null) return { state: 'null' }
  return { state: 'value', value: object[key] }
}

function sourceLine(source, expression, fallback = 1) {
  const lines = source.split('\n')
  const index = lines.findIndex(line => expression.test(line))
  if (index < 0) return { line: fallback, column: 1 }
  return { line: index + 1, column: lines[index].search(/\S/) + 1 }
}

function scriptureReference(value, key) {
  const result = {
    _type: 'scriptureReference',
    ...(key ? { _key: key } : {}),
    reference: value.reference,
    translation: value.translation,
    textStatus: value.textStatus,
    practiceStatus: value.practiceStatus
  }
  if (hasValue(value, 'passage')) result.passage = value.passage
  if (hasOwn(value, 'usageRightsConfirmed')) result.usageRightsConfirmed = value.usageRightsConfirmed
  return result
}

function blockScripture(fields, key) {
  const value = blockScriptureValue(fields)
  return scriptureReference({
    reference: fields.Reference,
    translation: fields.Translation,
    textStatus: value.textStatus,
    passage: value.passage,
    usageRightsConfirmed: value.usageRightsConfirmed,
    practiceStatus: value.practiceStatus
  }, key)
}

function richText(body, block, context, diagnostics, lineOffset = 1) {
  return markdownToPortableText(body, {
    filename: context.filename,
    line: block.line + lineOffset,
    path: context.path,
    target: block.id
  }, diagnostics)
}

function compileBlock(block, screen, context, diagnostics, controlledMappings) {
  const base = { _key: block.id }
  if (block.type === 'CB1') {
    return {
      ...base,
      _type: 'richTextBlock',
      body: richText(block.text, block, {
        ...context,
        path: `screens.${screen.id}.blocks.${block.id}.body`
      }, diagnostics)
    }
  }
  if (block.type === 'CB2') {
    return { ...base, _type: 'scriptureBlock', scripture: blockScripture(block.fields) }
  }
  if (block.type === 'CB3') {
    return {
      ...base,
      _type: 'statementBlock',
      text: block.fields.Text,
      ...(hasOwn(block.fields, 'Label') ? { label: block.fields.Label } : {})
    }
  }
  if (block.type === 'CB4') {
    return {
      ...base,
      _type: 'comparisonBlock',
      left: {
        _type: 'comparisonSide',
        title: block.left.title,
        body: richText(block.left.body, block.left, {
          ...context,
          path: `screens.${screen.id}.blocks.${block.id}.left.body`,
          target: block.id
        }, diagnostics, 3)
      },
      right: {
        _type: 'comparisonSide',
        title: block.right.title,
        body: richText(block.right.body, block.right, {
          ...context,
          path: `screens.${screen.id}.blocks.${block.id}.right.body`,
          target: block.id
        }, diagnostics, 3)
      },
      ...(block.footer !== null ? { footer: block.footer } : {}),
      reviewStatus: 'proposed'
    }
  }
  if (block.type === 'CB5') {
    return {
      ...base,
      _type: 'visualCardsBlock',
      cards: block.cards.map(card => ({
        _type: 'visualCard',
        _key: card.id,
        title: card.fields.Title,
        ...(hasOwn(card.fields, 'Body') ? { body: card.fields.Body } : {})
      })),
      reviewStatus: 'proposed'
    }
  }
  if (block.type === 'CB6') {
    return {
      ...base,
      _type: 'connectedSequenceBlock',
      steps: block.steps.map(step => ({
        _type: 'sequenceStep',
        _key: step.id,
        title: step.fields.Title,
        body: step.fields.Body
      })),
      ...(hasOwn(block.fields, 'Cycle') ? { cycle: block.fields.Cycle === 'true' } : {}),
      ...(hasOwn(block.fields, 'Return Caption') ? { returnCaption: block.fields['Return Caption'] } : {}),
      ...(hasOwn(block.fields, 'Conclusion') ? { conclusion: block.fields.Conclusion } : {}),
      reviewStatus: 'proposed'
    }
  }
  if (block.type === 'CB7') {
    return {
      ...base,
      _type: 'reflectionBlock',
      question: block.fields.Question,
      ...(block.choices.length ? {
        choices: block.choices.map(choice => ({
          _type: 'reflectionChoice',
          _key: choice.id,
          label: choice.fields.Label,
          prompt: choice.fields.Prompt
        }))
      } : {}),
      ...(hasOwn(block.fields, 'Closing') ? { closing: block.fields.Closing } : {}),
      reviewStatus: 'proposed'
    }
  }
  if (block.type === 'CB8') {
    return {
      ...base,
      _type: 'optionalStudyBlock',
      title: block.title,
      body: richText(block.body, block, {
        ...context,
        path: `screens.${screen.id}.blocks.${block.id}.body`
      }, diagnostics, 3),
      ...(block.scriptures.length ? {
        scriptures: block.scriptures.map(item => blockScripture(item.fields, item.id))
      } : {}),
      reviewStatus: 'proposed'
    }
  }
  if (block.type === 'CB9') {
    return { ...base, _type: 'prayerBlock', paragraphs: [...block.paragraphs] }
  }
  diagnostics.push({
    severity: 'error',
    code: 'BM_COMPILER_BLOCK_UNSUPPORTED',
    message: `No compiler mapping exists for ${block.type}`,
    filename: context.filename,
    line: block.line,
    column: 1,
    target: block.id
  })
  return null
}

function metadataStates(metadata) {
  const states = {}
  for (const [section, fields] of Object.entries({
    challenge: ['summary'],
    publishing: ['series', 'sequence', 'releaseAt'],
    scripture: ['passage', 'usageRightsConfirmed'],
    editorial: ['sourceRevision', 'approvedBy', 'approvedAt']
  })) {
    for (const field of fields) states[`${section}.${field}`] = valueState(metadata[section], field)
  }
  states.companionLinks = valueState(metadata, 'companionLinks')
  for (const [index, link] of (metadata.companionLinks ?? []).entries()) {
    for (const field of ['description', 'url', 'availability']) {
      states[`companionLinks[${index}].${field}`] = valueState(link, field)
    }
  }
  return states
}

function structureReport(screens) {
  return screens.map(screen => ({
    id: screen.id,
    type: screen.type,
    line: screen.line,
    blocks: screen.blocks.map(block => ({
      id: block.id,
      type: block.type,
      line: block.line,
      ...(block.cards ? { cards: block.cards.map(item => ({ id: item.id, line: item.line })) } : {}),
      ...(block.steps ? { steps: block.steps.map(item => ({ id: item.id, line: item.line })) } : {}),
      ...(block.choices ? { choices: block.choices.map(item => ({ id: item.id, line: item.line })) } : {}),
      ...(block.scriptures ? { scriptures: block.scriptures.map(item => ({ id: item.id, line: item.line })) } : {})
    }))
  }))
}

function invalidResult(validation, source, code, message) {
  const diagnostic = {
    severity: 'error',
    code,
    message,
    filename: validation?.filename ?? '<memory>',
    line: 1,
    column: 1
  }
  return {
    ok: false,
    mode: 'experimental-pure-sanity-compilation',
    sanityCandidate: null,
    reviewReport: {
      schemaComplete: false,
      importReady: false,
      publicationReady: false,
      source: {
        filename: validation?.filename ?? '<memory>',
        ...(typeof source === 'string' ? { sha256: sha256(source) } : {})
      },
      diagnostics: [diagnostic]
    },
    diagnostics: [diagnostic]
  }
}

/** Compile only a successful validator AST into local candidate JSON. */
export function compileValidatedBerryMark(validation, { source } = {}) {
  if (!validation || typeof validation !== 'object' || !validation.document) {
    return invalidResult(validation, source, 'BM_COMPILER_VALIDATION_REQUIRED', 'A parseBerryMark result is required')
  }
  if (typeof source !== 'string') {
    return invalidResult(validation, source, 'BM_COMPILER_SOURCE_REQUIRED', 'Exact original source is required for fingerprinting')
  }
  if (!validation.ok) {
    return invalidResult(validation, source, 'BM_COMPILER_INVALID_INPUT', 'Compilation requires a validator result with no blocking errors')
  }

  const filename = validation.filename
  const metadata = validation.document.metadata
  const diagnostics = []
  const unresolved = []
  const controlledMappings = []
  const pendingLookups = []
  const reportDiagnostic = (severity, code, message, location, extra = {}) => {
    const item = { severity, code, message, filename, ...location, ...extra }
    diagnostics.push(item)
    return item
  }
  const reportUnresolved = (code, message, location, extra) => {
    const item = reportDiagnostic('info', code, message, location, extra)
    unresolved.push(item)
  }

  const slugLocation = sourceLine(source, /^\s{2}slug:/, 1)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.challenge.slug) || metadata.challenge.slug.length > 96) {
    reportDiagnostic('error', 'BM_SLUG_INCOMPATIBLE', 'Challenge slug is not compatible with the target slug contract; it was not rewritten', slugLocation, { path: 'challenge.slug' })
  }

  const candidate = {
    _type: 'challenge',
    title: metadata.challenge.title,
    slug: { _type: 'slug', current: metadata.challenge.slug },
    challengeType: metadata.challenge.type,
    ...(hasValue(metadata.challenge, 'summary') ? { summary: metadata.challenge.summary } : {}),
    primaryScripture: scriptureReference(metadata.scripture),
    screens: [],
    editorialReview: {
      _type: 'editorialReview',
      sourceTitle: metadata.editorial.sourceTitle,
      ...(hasValue(metadata.editorial, 'sourceRevision') ? { sourceRevision: metadata.editorial.sourceRevision } : {}),
      adaptationReviewed: false
    }
  }

  if (hasValue(metadata.publishing, 'sequence')) candidate.sequence = metadata.publishing.sequence
  if (hasValue(metadata.publishing, 'releaseAt')) candidate.releaseAt = metadata.publishing.releaseAt

  for (const field of ['series', 'sequence', 'releaseAt']) {
    const state = valueState(metadata.publishing, field)
    const location = { ...sourceLine(source, new RegExp(`^\\s{2}${field}:`), 1), path: `publishing.${field}` }
    if (state.state !== 'value') {
      reportUnresolved('BM_PUBLISHING_UNRESOLVED', `publishing.${field} remains ${state.state}; no value was inferred`, location, { state: state.state })
    }
  }
  if (hasValue(metadata.publishing, 'series')) {
    const lookup = {
      type: 'challengeSeriesSlug',
      slug: metadata.publishing.series,
      sourcePath: 'publishing.series',
      destinationPath: 'series',
      status: 'unresolved',
      reason: 'A series slug is not a Sanity document ID; offline compilation cannot create a truthful _ref'
    }
    pendingLookups.push(lookup)
    reportUnresolved('BM_SERIES_LOOKUP_REQUIRED', `Series slug "${metadata.publishing.series}" requires later authorized lookup; no _ref was generated`, {
      ...sourceLine(source, /^\s{2}series:/, 1),
      path: 'publishing.series'
    }, { state: 'value', value: metadata.publishing.series })
  }

  controlledMappings.push({
    code: 'BM_ADAPTATION_REVIEW_NOT_TRANSFERRED',
    path: 'editorialReview.adaptationReviewed',
    value: false,
    reason: 'Source approval is preserved only in the sidecar until an approval-transfer contract exists'
  })
  reportDiagnostic('info', 'BM_ADAPTATION_REVIEW_NOT_TRANSFERRED', 'Sanity adaptationReviewed is conservatively false; source approval was not promoted', {
    ...sourceLine(source, /^\s{2}approvalStatus:/, 1),
    path: 'editorialReview.adaptationReviewed'
  })
  if (metadata.editorial.approvalStatus === 'pending') {
    reportUnresolved('BM_EDITORIAL_PENDING', 'Source editorial approval remains pending', {
      ...sourceLine(source, /^\s{2}approvalStatus:/, 1),
      path: 'editorial.approvalStatus'
    }, { state: 'value', value: 'pending' })
  } else {
    reportUnresolved('BM_REVIEW_TRANSFER_UNRESOLVED', 'Approved source claim remains in the sidecar and was not transferred to Sanity approval fields', {
      ...sourceLine(source, /^\s{2}approvalStatus:/, 1),
      path: 'editorial.approvalStatus'
    }, { state: 'value', value: 'approved' })
  }
  if (metadata.scripture.usageRightsConfirmed === true) {
    reportUnresolved('BM_SCRIPTURE_RIGHTS_ASSERTION', 'Scripture usageRightsConfirmed is an author assertion, not independent license verification', {
      ...sourceLine(source, /^\s{2}usageRightsConfirmed:/, 1),
      path: 'scripture.usageRightsConfirmed'
    }, { state: 'value', value: true })
  }

  const companionKeys = new Map()
  if (hasOwn(metadata, 'companionLinks')) {
    candidate.companionLinks = metadata.companionLinks.map((link, index) => {
      const originalState = Object.fromEntries(['provider', 'label', 'description', 'url', 'availability'].map(field => [field, valueState(link, field)]))
      const key = generatedKey(metadata.challenge.slug, 'companionLink', originalState)
      if (companionKeys.has(key)) {
        reportDiagnostic('error', 'BM_KEY_COLLISION', `Companion links at indexes ${companionKeys.get(key)} and ${index} have identical deterministic key content`, {
          line: 1,
          column: 1,
          path: `companionLinks[${index}]`
        })
      } else {
        companionKeys.set(key, index)
      }
      if (!hasValue(link, 'url')) {
        const state = valueState(link, 'url')
        reportUnresolved('BM_COMPANION_URL_UNRESOLVED', `companionLinks[${index}].url remains ${state.state}; no URL was inferred`, {
          line: 1,
          column: 1,
          path: `companionLinks[${index}].url`
        }, { state: state.state, companionKey: key })
      }
      return {
        _type: 'companionLink',
        _key: key,
        provider: link.provider,
        label: link.label,
        ...(hasValue(link, 'description') ? { description: link.description } : {}),
        ...(hasValue(link, 'url') ? { url: link.url } : {}),
        ...(hasValue(link, 'availability') ? { availability: link.availability } : {})
      }
    })
  }

  for (const screen of validation.document.screens) {
    const output = {
      _type: 'challengeScreen',
      _key: screen.id,
      ...(screen.label !== null ? { screenLabel: screen.label } : {}),
      ...(screen.heading !== null ? { heading: screen.heading } : {}),
      blocks: []
    }
    for (const block of screen.blocks) {
      output.blocks.push(compileBlock(block, screen, { filename }, diagnostics, controlledMappings))
      if (REVIEWED_TYPES.has(block.type)) {
        controlledMappings.push({
          code: 'BM_REVIEW_STATE_PROPOSED',
          path: `screens.${screen.id}.blocks.${block.id}.reviewStatus`,
          target: block.id,
          value: 'proposed',
          reason: 'Structured CB4–CB8 adaptations always remain proposed during pure compilation'
        })
      }
    }
    candidate.screens.push(output)
  }

  const blocks = validation.document.screens.flatMap(screen => screen.blocks)
  const editorialItems = validation.document.annotations.map(annotation => {
    const match = annotation.text.match(/^<!--\s*(EDITORIAL NOTE|TODO|REVIEW REQUIRED)\s*:/)
    return {
      kind: match?.[1] ?? 'COMMENT',
      status: 'unresolved',
      line: annotation.line,
      column: 1,
      text: annotation.text
    }
  })
  const missingRequiredFields = ['series']
  for (const field of ['sequence', 'releaseAt']) {
    if (!hasOwn(candidate, field)) missingRequiredFields.push(field)
  }
  const ok = !diagnostics.some(item => item.severity === 'error')
  const summary = {
    errors: diagnostics.filter(item => item.severity === 'error').length,
    warnings: diagnostics.filter(item => item.severity === 'warning').length,
    editorial: 0,
    info: diagnostics.filter(item => item.severity === 'info').length
  }
  const reviewReport = {
    schemaComplete: missingRequiredFields.length === 0,
    importReady: false,
    publicationReady: false,
    source: {
      filename,
      sha256: sha256(source),
      revisionState: valueState(metadata.editorial, 'sourceRevision').state,
      ...(hasValue(metadata.editorial, 'sourceRevision') ? { revision: metadata.editorial.sourceRevision } : {})
    },
    challenge: {
      title: metadata.challenge.title,
      slug: metadata.challenge.slug,
      type: metadata.challenge.type
    },
    validatorSummary: clone(validation.summary),
    compilerSummary: summary,
    counts: {
      screens: validation.document.screens.length,
      contentBlocks: blocks.length,
      optionalStudies: blocks.filter(block => block.type === 'CB8').length,
      nestedScriptures: blocks.filter(block => block.type === 'CB8').flatMap(block => block.scriptures).length,
      editorialAnnotations: editorialItems.length
    },
    structure: structureReport(validation.document.screens),
    authoredMetadata: clone(metadata),
    metadataStates: metadataStates(metadata),
    unresolved,
    editorialItems,
    controlledMappings,
    pendingLookups,
    skippedDestinationFields: [
      { sourcePath: 'editorial.sourceAuthor', reason: 'Current Sanity editorialReview has no sourceAuthor field; exact value remains in authoredMetadata' },
      { sourcePath: 'editorial.approvalStatus', reason: 'Source approval vocabulary is not equivalent to adaptationReviewed' },
      { sourcePath: 'editorial.approvedBy', reason: 'No approved transfer policy for Sanity reviewedBy' },
      { sourcePath: 'editorial.approvedAt', reason: 'No approved transfer policy for Sanity reviewedAt' },
      { sourcePath: 'publishing.series', reason: 'Series slug requires an authorized lookup before a reference can be emitted' }
    ],
    compatibility: {
      targetRepository: 'ContraPhilosophy/Bibleberry',
      targetRevision: 'c43b53146f3b4f6c1d5154e1ce0409a5aa3e4d3d',
      schemaComplete: missingRequiredFields.length === 0,
      missingRequiredFields,
      note: 'Schema-compatible local candidate only; Studio validation, reference resolution and import gates were not executed'
    },
    diagnostics: clone(diagnostics)
  }

  return {
    ok,
    mode: 'experimental-pure-sanity-compilation',
    sanityCandidate: ok ? candidate : null,
    reviewReport,
    diagnostics
  }
}

export function compileBerryMark(source, { filename = '<memory>' } = {}) {
  const validation = parseBerryMark(source, { filename })
  return compileValidatedBerryMark(validation, { source })
}
