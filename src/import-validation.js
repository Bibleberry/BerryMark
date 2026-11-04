import { stableStringify } from './keys.js'
import { validateScriptureConsistency } from './scripture.js'

const RESULT_FIELDS = ['ok', 'mode', 'sanityCandidate', 'reviewReport', 'diagnostics']
const REPORT_FIELDS = [
  'schemaComplete', 'importReady', 'publicationReady', 'source', 'challenge',
  'validatorSummary', 'compilerSummary', 'counts', 'structure', 'authoredMetadata',
  'metadataStates', 'unresolved', 'editorialItems', 'controlledMappings',
  'pendingLookups', 'skippedDestinationFields', 'compatibility', 'diagnostics'
]
const SUMMARY_FIELDS = ['errors', 'warnings', 'editorial', 'info']
const COUNT_FIELDS = ['screens', 'contentBlocks', 'optionalStudies', 'nestedScriptures', 'editorialAnnotations']
const DIAGNOSTIC_FIELDS = [
  'severity', 'code', 'message', 'filename', 'line', 'column', 'path', 'state',
  'value', 'target', 'side', 'relatedLocations', 'companionKey'
]
const METADATA_FIELDS = {
  challenge: ['title', 'slug', 'type', 'summary'],
  publishing: ['series', 'sequence', 'releaseAt'],
  scripture: ['reference', 'translation', 'textStatus', 'passage', 'usageRightsConfirmed', 'practiceStatus'],
  editorial: ['sourceTitle', 'sourceAuthor', 'sourceRevision', 'approvalStatus', 'approvedBy', 'approvedAt']
}
const BLOCK_TYPES = {
  richTextBlock: 'CB1', scriptureBlock: 'CB2', statementBlock: 'CB3',
  comparisonBlock: 'CB4', visualCardsBlock: 'CB5', connectedSequenceBlock: 'CB6',
  reflectionBlock: 'CB7', optionalStudyBlock: 'CB8', prayerBlock: 'CB9'
}
const REVIEWED_TYPES = new Set(['comparisonBlock', 'visualCardsBlock', 'connectedSequenceBlock', 'reflectionBlock', 'optionalStudyBlock'])
const PORTABLE_BLOCK_FIELDS = ['_type', '_key', 'children', 'markDefs', 'style', 'listItem', 'level']
const SPAN_FIELDS = ['_type', '_key', 'marks', 'text']
const LINK_FIELDS = ['_type', '_key', 'href']

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const same = (left, right) => stableStringify(left) === stableStringify(right)
const hasOwn = (value, key) => Object.hasOwn(value, key)

function httpUrl(value) {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname)
  } catch {
    return false
  }
}

export function validateImportCompilation(compilation, schemaSnapshot) {
  const errors = []
  const warnings = []
  const add = (code, message, path, extra = {}) => {
    errors.push({ severity: 'error', code, message, ...(path ? { path } : {}), ...extra })
  }
  const object = (value, path, allowed, required = [], optionalMissing = []) => {
    if (!isObject(value)) {
      add('BM_IMPORT_RESULT_INVALID', `${path} must be an object`, path)
      return false
    }
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) add('BM_IMPORT_RESULT_INVALID', `Unknown field ${path}.${key}`, `${path}.${key}`)
    }
    for (const key of required) {
      if (!hasOwn(value, key) && !optionalMissing.includes(key)) {
        add('BM_IMPORT_RESULT_INVALID', `Missing required field ${path}.${key}`, `${path}.${key}`)
      }
    }
    return true
  }
  const array = (value, path, nonempty = false) => {
    if (!Array.isArray(value) || (nonempty && value.length === 0)) {
      add('BM_IMPORT_RESULT_INVALID', `${path} must be ${nonempty ? 'a nonempty ' : 'an '}array`, path)
      return false
    }
    return true
  }
  const string = (value, path, nonempty = true) => {
    if (typeof value !== 'string' || (nonempty && value.length === 0)) {
      add('BM_IMPORT_RESULT_INVALID', `${path} must be ${nonempty ? 'a nonempty ' : 'a '}string`, path)
      return false
    }
    return true
  }
  const integer = (value, path) => {
    if (!Number.isSafeInteger(value) || value < 0) add('BM_IMPORT_RESULT_INVALID', `${path} must be a nonnegative safe integer`, path)
  }
  const keys = (items, path) => {
    if (!Array.isArray(items)) return
    const seen = new Map()
    items.forEach((item, index) => {
      if (!isObject(item) || typeof item._key !== 'string' || !item._key.trim()) {
        add('BM_IMPORT_RESULT_INVALID', `${path}[${index}] requires a nonempty _key`, `${path}[${index}]._key`)
        return
      }
      if (/\s/.test(item._key)) add('BM_IMPORT_RESULT_INVALID', `${path}[${index}]._key cannot contain whitespace`, `${path}[${index}]._key`)
      if (seen.has(item._key)) {
        add('BM_IMPORT_RESULT_INVALID', `Duplicate sibling _key ${item._key}`, `${path}[${index}]._key`, {
          relatedLocations: [{ path: `${path}[${seen.get(item._key)}]._key` }, { path: `${path}[${index}]._key` }]
        })
      } else seen.set(item._key, index)
    })
  }
  const shape = (value, expectedType, path, optionalMissing = []) => {
    const schema = schemaSnapshot?.objects?.[expectedType]
    if (!schema) {
      add('BM_IMPORT_SCHEMA_INCOMPATIBLE', `The supplied schema snapshot does not define ${expectedType}`, path)
      return false
    }
    if (!object(value, path, schema.fields, schema.required, optionalMissing)) return false
    if (value._type !== expectedType) add('BM_IMPORT_RESULT_INVALID', `${path} must have _type ${expectedType}`, `${path}._type`)
    return true
  }

  const scripture = (value, path) => {
    if (!shape(value, 'scriptureReference', path)) return
    string(value.reference, `${path}.reference`)
    string(value.translation, `${path}.translation`)
    if (!['referenceOnly', 'provided'].includes(value.textStatus)) add('BM_IMPORT_RESULT_INVALID', `${path}.textStatus is unsupported`, `${path}.textStatus`)
    if (!['notConfigured', 'configured'].includes(value.practiceStatus)) add('BM_IMPORT_RESULT_INVALID', `${path}.practiceStatus is unsupported`, `${path}.practiceStatus`)
    if (hasOwn(value, 'passage')) string(value.passage, `${path}.passage`)
    if (hasOwn(value, 'usageRightsConfirmed') && typeof value.usageRightsConfirmed !== 'boolean') {
      add('BM_IMPORT_RESULT_INVALID', `${path}.usageRightsConfirmed must be Boolean`, `${path}.usageRightsConfirmed`)
    }
    validateScriptureConsistency(value, (code, message, field) => add(code, message, `${path}.${field}`))
  }

  const portableText = (body, path) => {
    if (!array(body, path, true)) return
    keys(body, path)
    body.forEach((block, blockIndex) => {
      const blockPath = `${path}[${blockIndex}]`
      if (!object(block, blockPath, PORTABLE_BLOCK_FIELDS, ['_type', '_key', 'children', 'markDefs', 'style'])) return
      if (block._type !== 'block') add('BM_IMPORT_RESULT_INVALID', `${blockPath} must be a Portable Text block`, `${blockPath}._type`)
      if (!['normal', 'h2', 'h3', 'blockquote'].includes(block.style)) add('BM_IMPORT_RESULT_INVALID', `${blockPath}.style is unsupported`, `${blockPath}.style`)
      if (hasOwn(block, 'listItem')) {
        if (!['bullet', 'number'].includes(block.listItem)) add('BM_IMPORT_RESULT_INVALID', `${blockPath}.listItem is unsupported`, `${blockPath}.listItem`)
        if (block.level !== 1) add('BM_IMPORT_RESULT_INVALID', `${blockPath}.level must be 1`, `${blockPath}.level`)
      } else if (hasOwn(block, 'level')) add('BM_IMPORT_RESULT_INVALID', `${blockPath}.level requires listItem`, `${blockPath}.level`)
      if (!array(block.children, `${blockPath}.children`, true)) return
      if (!array(block.markDefs, `${blockPath}.markDefs`)) return
      keys(block.children, `${blockPath}.children`)
      keys(block.markDefs, `${blockPath}.markDefs`)
      const definitions = new Set()
      block.markDefs.forEach((definition, index) => {
        const definitionPath = `${blockPath}.markDefs[${index}]`
        if (!object(definition, definitionPath, LINK_FIELDS, LINK_FIELDS)) return
        if (definition._type !== 'link') add('BM_IMPORT_RESULT_INVALID', `${definitionPath} must be a link`, `${definitionPath}._type`)
        if (!httpUrl(definition.href)) add('BM_IMPORT_RESULT_INVALID', `${definitionPath}.href must be an absolute HTTP(S) URL`, `${definitionPath}.href`)
        if (typeof definition._key === 'string') definitions.add(definition._key)
      })
      block.children.forEach((span, index) => {
        const spanPath = `${blockPath}.children[${index}]`
        if (!object(span, spanPath, SPAN_FIELDS, SPAN_FIELDS)) return
        if (span._type !== 'span') add('BM_IMPORT_RESULT_INVALID', `${spanPath} must be a span`, `${spanPath}._type`)
        string(span.text, `${spanPath}.text`, false)
        if (!array(span.marks, `${spanPath}.marks`)) return
        for (const mark of span.marks) {
          if (typeof mark !== 'string' || (!['strong', 'em'].includes(mark) && !definitions.has(mark))) {
            add('BM_IMPORT_RESULT_INVALID', `${spanPath} contains an unknown mark`, `${spanPath}.marks`)
          }
        }
        if (new Set(span.marks).size !== span.marks.length) add('BM_IMPORT_RESULT_INVALID', `${spanPath} contains duplicate marks`, `${spanPath}.marks`)
      })
    })
  }

  const block = (value, path) => {
    if (!isObject(value)) {
      add('BM_IMPORT_RESULT_INVALID', `${path} must be an object`, path)
      return
    }
    const expectedType = value._type
    if (!BLOCK_TYPES[expectedType]) {
      add('BM_IMPORT_UNSUPPORTED_BLOCK', `No exact supported target mapping exists for ${String(expectedType)}`, `${path}._type`)
      return
    }
    shape(value, expectedType, path)
    if (REVIEWED_TYPES.has(expectedType) && value.reviewStatus !== 'proposed') {
      add('BM_IMPORT_REVIEW_TRANSFER_FORBIDDEN', `${path}.reviewStatus must remain proposed`, `${path}.reviewStatus`)
    }
    if (expectedType === 'richTextBlock') portableText(value.body, `${path}.body`)
    if (expectedType === 'scriptureBlock') scripture(value.scripture, `${path}.scripture`)
    if (expectedType === 'statementBlock') {
      string(value.text, `${path}.text`)
      if (hasOwn(value, 'label')) string(value.label, `${path}.label`)
    }
    if (expectedType === 'comparisonBlock') {
      for (const side of ['left', 'right']) {
        if (shape(value[side], 'comparisonSide', `${path}.${side}`)) {
          string(value[side].title, `${path}.${side}.title`)
          portableText(value[side].body, `${path}.${side}.body`)
        }
      }
      if (hasOwn(value, 'footer')) string(value.footer, `${path}.footer`)
    }
    if (expectedType === 'visualCardsBlock' && array(value.cards, `${path}.cards`, true)) {
      keys(value.cards, `${path}.cards`)
      value.cards.forEach((card, index) => {
        if (shape(card, 'visualCard', `${path}.cards[${index}]`)) {
          string(card.title, `${path}.cards[${index}].title`)
          if (hasOwn(card, 'body')) string(card.body, `${path}.cards[${index}].body`)
        }
      })
    }
    if (expectedType === 'connectedSequenceBlock') {
      if (array(value.steps, `${path}.steps`, true)) {
        keys(value.steps, `${path}.steps`)
        value.steps.forEach((step, index) => {
          if (shape(step, 'sequenceStep', `${path}.steps[${index}]`)) {
            string(step.title, `${path}.steps[${index}].title`)
            string(step.body, `${path}.steps[${index}].body`)
          }
        })
      }
      for (const field of ['returnCaption', 'conclusion']) if (hasOwn(value, field)) string(value[field], `${path}.${field}`)
      if (hasOwn(value, 'cycle') && typeof value.cycle !== 'boolean') add('BM_IMPORT_RESULT_INVALID', `${path}.cycle must be Boolean`, `${path}.cycle`)
    }
    if (expectedType === 'reflectionBlock') {
      string(value.question, `${path}.question`)
      if (hasOwn(value, 'choices') && array(value.choices, `${path}.choices`, true)) {
        keys(value.choices, `${path}.choices`)
        value.choices.forEach((choice, index) => {
          if (shape(choice, 'reflectionChoice', `${path}.choices[${index}]`)) {
            string(choice.label, `${path}.choices[${index}].label`)
            string(choice.prompt, `${path}.choices[${index}].prompt`)
          }
        })
      }
      if (hasOwn(value, 'closing')) string(value.closing, `${path}.closing`)
    }
    if (expectedType === 'optionalStudyBlock') {
      string(value.title, `${path}.title`)
      portableText(value.body, `${path}.body`)
      if (hasOwn(value, 'scriptures') && array(value.scriptures, `${path}.scriptures`, true)) {
        keys(value.scriptures, `${path}.scriptures`)
        value.scriptures.forEach((item, index) => scripture(item, `${path}.scriptures[${index}]`))
      }
    }
    if (expectedType === 'prayerBlock' && array(value.paragraphs, `${path}.paragraphs`, true)) {
      value.paragraphs.forEach((paragraph, index) => string(paragraph, `${path}.paragraphs[${index}]`))
    }
  }

  if (!object(compilation, 'result', RESULT_FIELDS, RESULT_FIELDS)) return { errors, warnings, structuralValid: false }
  if (compilation.ok !== true) add('BM_IMPORT_RESULT_INVALID', 'The compiler result must have ok: true', 'result.ok')
  if (compilation.mode !== 'experimental-pure-sanity-compilation') add('BM_IMPORT_RESULT_INVALID', 'Unsupported compiler mode', 'result.mode')
  if (!array(compilation.diagnostics, 'result.diagnostics')) return { errors, warnings, structuralValid: false }

  const candidate = compilation.sanityCandidate
  const report = compilation.reviewReport
  if (!shape(candidate, 'challenge', 'sanityCandidate', ['series', 'sequence', 'releaseAt'])) return { errors, warnings, structuralValid: false }
  if (!object(report, 'reviewReport', REPORT_FIELDS, REPORT_FIELDS)) return { errors, warnings, structuralValid: false }

  string(candidate.title, 'sanityCandidate.title')
  if (!isObject(candidate.slug)) add('BM_IMPORT_RESULT_INVALID', 'sanityCandidate.slug must be an object', 'sanityCandidate.slug')
  string(candidate.challengeType, 'sanityCandidate.challengeType')
  if (hasOwn(candidate, 'summary')) string(candidate.summary, 'sanityCandidate.summary')
  if (hasOwn(candidate, 'sequence') && (!Number.isSafeInteger(candidate.sequence) || candidate.sequence <= 0)) {
    add('BM_IMPORT_RESULT_INVALID', 'sequence must be a positive integer', 'sanityCandidate.sequence')
  }
  if (hasOwn(candidate, 'releaseAt') && (typeof candidate.releaseAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(candidate.releaseAt) || Number.isNaN(Date.parse(candidate.releaseAt)))) {
    add('BM_IMPORT_RESULT_INVALID', 'releaseAt must be a timezone-aware instant', 'sanityCandidate.releaseAt')
  }
  scripture(candidate.primaryScripture, 'sanityCandidate.primaryScripture')
  if (array(candidate.screens, 'sanityCandidate.screens', true)) {
    keys(candidate.screens, 'sanityCandidate.screens')
    candidate.screens.forEach((screen, screenIndex) => {
      const screenPath = `sanityCandidate.screens[${screenIndex}]`
      if (!shape(screen, 'challengeScreen', screenPath)) return
      if (hasOwn(screen, 'screenLabel')) string(screen.screenLabel, `${screenPath}.screenLabel`)
      if (hasOwn(screen, 'heading')) string(screen.heading, `${screenPath}.heading`)
      if (array(screen.blocks, `${screenPath}.blocks`, true)) {
        keys(screen.blocks, `${screenPath}.blocks`)
        screen.blocks.forEach((item, blockIndex) => block(item, `${screenPath}.blocks[${blockIndex}]`))
      }
    })
  }
  if (hasOwn(candidate, 'companionLinks') && array(candidate.companionLinks, 'sanityCandidate.companionLinks')) {
    keys(candidate.companionLinks, 'sanityCandidate.companionLinks')
    candidate.companionLinks.forEach((link, index) => {
      const path = `sanityCandidate.companionLinks[${index}]`
      if (!shape(link, 'companionLink', path)) return
      string(link.provider, `${path}.provider`)
      string(link.label, `${path}.label`)
      for (const field of ['description', 'availability']) if (hasOwn(link, field)) string(link[field], `${path}.${field}`)
      if (hasOwn(link, 'url') && !httpUrl(link.url)) add('BM_IMPORT_RESULT_INVALID', `${path}.url must be an absolute HTTP(S) URL`, `${path}.url`)
    })
  }
  if (shape(candidate.editorialReview, 'editorialReview', 'sanityCandidate.editorialReview')) {
    string(candidate.editorialReview.sourceTitle, 'sanityCandidate.editorialReview.sourceTitle')
    if (hasOwn(candidate.editorialReview, 'sourceRevision')) string(candidate.editorialReview.sourceRevision, 'sanityCandidate.editorialReview.sourceRevision')
    if (candidate.editorialReview.adaptationReviewed !== false) {
      add('BM_IMPORT_REVIEW_TRANSFER_FORBIDDEN', 'adaptationReviewed must remain false', 'sanityCandidate.editorialReview.adaptationReviewed')
    }
  }

  // Slug is a scalar schema boundary rather than an entry in the object snapshot.
  const slug = candidate.slug
  if (isObject(slug)) {
    for (const key of Object.keys(slug)) if (!['_type', 'current'].includes(key)) add('BM_IMPORT_RESULT_INVALID', `Unknown field sanityCandidate.slug.${key}`, `sanityCandidate.slug.${key}`)
    if (slug._type !== 'slug') add('BM_IMPORT_RESULT_INVALID', 'slug._type must be slug', 'sanityCandidate.slug._type')
    if (string(slug.current, 'sanityCandidate.slug.current') && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.current) || slug.current.length > 96)) {
      add('BM_IMPORT_RESULT_INVALID', 'Challenge slug is incompatible with the deterministic identity contract', 'sanityCandidate.slug.current')
    }
  }

  if (report.importReady !== false || report.publicationReady !== false) {
    add('BM_IMPORT_RESULT_INVALID', 'Compiler readiness flags must both remain false', 'reviewReport')
  }
  if (typeof report.schemaComplete !== 'boolean') add('BM_IMPORT_RESULT_INVALID', 'schemaComplete must be Boolean', 'reviewReport.schemaComplete')
  if (object(report.source, 'reviewReport.source', ['filename', 'sha256', 'revisionState', 'revision'], ['filename', 'sha256', 'revisionState'])) {
    string(report.source.filename, 'reviewReport.source.filename')
    if (typeof report.source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(report.source.sha256)) add('BM_IMPORT_RESULT_INVALID', 'source.sha256 must be a lowercase SHA-256 digest', 'reviewReport.source.sha256')
    if (!['absent', 'null', 'value'].includes(report.source.revisionState)) add('BM_IMPORT_RESULT_INVALID', 'source.revisionState is invalid', 'reviewReport.source.revisionState')
    if (report.source.revisionState === 'value') string(report.source.revision, 'reviewReport.source.revision')
    if (report.source.revisionState !== 'value' && hasOwn(report.source, 'revision')) add('BM_IMPORT_RESULT_INVALID', 'source.revision is inconsistent with revisionState', 'reviewReport.source.revision')
  }
  if (object(report.challenge, 'reviewReport.challenge', ['title', 'slug', 'type'], ['title', 'slug', 'type'])) {
    const expectedChallenge = { title: candidate.title, slug: candidate.slug?.current, type: candidate.challengeType }
    if (!same(report.challenge, expectedChallenge)) add('BM_IMPORT_RESULT_INVALID', 'reviewReport.challenge does not match the candidate', 'reviewReport.challenge')
  }
  for (const name of ['validatorSummary', 'compilerSummary']) {
    if (object(report[name], `reviewReport.${name}`, SUMMARY_FIELDS, SUMMARY_FIELDS)) {
      for (const field of SUMMARY_FIELDS) integer(report[name][field], `reviewReport.${name}.${field}`)
    }
  }
  if (object(report.counts, 'reviewReport.counts', COUNT_FIELDS, COUNT_FIELDS)) {
    for (const field of COUNT_FIELDS) integer(report.counts[field], `reviewReport.counts.${field}`)
    const blocks = Array.isArray(candidate.screens) ? candidate.screens.flatMap(screen => Array.isArray(screen.blocks) ? screen.blocks : []) : []
    const expectedCounts = {
      screens: Array.isArray(candidate.screens) ? candidate.screens.length : 0,
      contentBlocks: blocks.length,
      optionalStudies: blocks.filter(item => item?._type === 'optionalStudyBlock').length,
      nestedScriptures: blocks.filter(item => item?._type === 'optionalStudyBlock').reduce((sum, item) => sum + (Array.isArray(item.scriptures) ? item.scriptures.length : 0), 0),
      editorialAnnotations: Array.isArray(report.editorialItems) ? report.editorialItems.length : 0
    }
    if (!same(report.counts, expectedCounts)) add('BM_IMPORT_RESULT_INVALID', 'Reported structural counts do not match the artifact', 'reviewReport.counts')
  }
  if (!array(report.structure, 'reviewReport.structure')) add('BM_IMPORT_RESULT_INVALID', 'structure must be an array', 'reviewReport.structure')
  if (Array.isArray(report.structure) && Array.isArray(candidate.screens)) {
    if (report.structure.length !== candidate.screens.length) add('BM_IMPORT_RESULT_INVALID', 'Structure screen count does not match the candidate', 'reviewReport.structure')
    report.structure.forEach((screen, screenIndex) => {
      const path = `reviewReport.structure[${screenIndex}]`
      if (!object(screen, path, ['id', 'type', 'line', 'blocks'], ['id', 'type', 'line', 'blocks'])) return
      const candidateScreen = candidate.screens[screenIndex]
      if (screen.id !== candidateScreen?._key || screen.type !== 'SCREEN') add('BM_IMPORT_RESULT_INVALID', 'Structure screen identity does not match the candidate', path)
      integer(screen.line, `${path}.line`)
      if (!array(screen.blocks, `${path}.blocks`)) return
      if (screen.blocks.length !== candidateScreen?.blocks?.length) add('BM_IMPORT_RESULT_INVALID', 'Structure block count does not match the candidate', `${path}.blocks`)
      screen.blocks.forEach((item, blockIndex) => {
        const blockPath = `${path}.blocks[${blockIndex}]`
        const allowed = ['id', 'type', 'line', 'cards', 'steps', 'choices', 'scriptures']
        if (!object(item, blockPath, allowed, ['id', 'type', 'line'])) return
        const candidateBlock = candidateScreen?.blocks?.[blockIndex]
        if (item.id !== candidateBlock?._key || item.type !== BLOCK_TYPES[candidateBlock?._type]) add('BM_IMPORT_RESULT_INVALID', 'Structure block identity does not match the candidate', blockPath)
        integer(item.line, `${blockPath}.line`)
        const nested = { visualCardsBlock: 'cards', connectedSequenceBlock: 'steps', reflectionBlock: 'choices', optionalStudyBlock: 'scriptures' }[candidateBlock?._type]
        for (const field of ['cards', 'steps', 'choices', 'scriptures']) {
          if (field !== nested && hasOwn(item, field)) add('BM_IMPORT_RESULT_INVALID', `Unexpected structure inventory ${field}`, `${blockPath}.${field}`)
        }
        if (nested) {
          if (!array(item[nested], `${blockPath}.${nested}`)) return
          const candidateItems = candidateBlock?.[nested] ?? []
          if (item[nested].length !== candidateItems.length) add('BM_IMPORT_RESULT_INVALID', 'Nested structure count does not match the candidate', `${blockPath}.${nested}`)
          item[nested].forEach((nestedItem, nestedIndex) => {
            if (!object(nestedItem, `${blockPath}.${nested}[${nestedIndex}]`, ['id', 'line'], ['id', 'line'])) return
            if (nestedItem.id !== candidateItems[nestedIndex]?._key) add('BM_IMPORT_RESULT_INVALID', 'Nested structure identity does not match the candidate', `${blockPath}.${nested}[${nestedIndex}]`)
            integer(nestedItem.line, `${blockPath}.${nested}[${nestedIndex}].line`)
          })
        }
      })
    })
  }

  if (object(report.authoredMetadata, 'reviewReport.authoredMetadata', ['berrymark', ...Object.keys(METADATA_FIELDS), 'companionLinks'], ['berrymark', ...Object.keys(METADATA_FIELDS)])) {
    if (report.authoredMetadata.berrymark !== '0.1') add('BM_IMPORT_RESULT_INVALID', 'Only BerryMark 0.1 metadata is supported', 'reviewReport.authoredMetadata.berrymark')
    for (const [section, fields] of Object.entries(METADATA_FIELDS)) {
      object(report.authoredMetadata[section], `reviewReport.authoredMetadata.${section}`, fields, fields.filter(field => hasOwn(report.authoredMetadata[section] ?? {}, field)))
    }
    const metadata = report.authoredMetadata
    if (metadata.challenge?.title !== candidate.title || metadata.challenge?.slug !== candidate.slug?.current || metadata.challenge?.type !== candidate.challengeType) {
      add('BM_IMPORT_RESULT_INVALID', 'authoredMetadata.challenge does not match the candidate', 'reviewReport.authoredMetadata.challenge')
    }
    if (metadata.editorial?.sourceTitle !== candidate.editorialReview?.sourceTitle) add('BM_IMPORT_RESULT_INVALID', 'sourceTitle does not match the candidate', 'reviewReport.authoredMetadata.editorial.sourceTitle')
    if (metadata.publishing?.sequence !== candidate.sequence && (hasOwn(candidate, 'sequence') || metadata.publishing?.sequence !== null)) {
      add('BM_IMPORT_RESULT_INVALID', 'Publishing sequence does not match the candidate', 'reviewReport.authoredMetadata.publishing.sequence')
    }
    if (metadata.publishing?.releaseAt !== candidate.releaseAt && (hasOwn(candidate, 'releaseAt') || metadata.publishing?.releaseAt !== null)) {
      add('BM_IMPORT_RESULT_INVALID', 'Publishing releaseAt does not match the candidate', 'reviewReport.authoredMetadata.publishing.releaseAt')
    }
  }

  if (!isObject(report.metadataStates)) add('BM_IMPORT_RESULT_INVALID', 'metadataStates must be an object', 'reviewReport.metadataStates')
  else {
    for (const [key, value] of Object.entries(report.metadataStates)) {
      if (object(value, `reviewReport.metadataStates.${key}`, ['state', 'value'], ['state'])) {
        if (!['absent', 'null', 'value'].includes(value.state)) add('BM_IMPORT_RESULT_INVALID', 'Invalid metadata state', `reviewReport.metadataStates.${key}.state`)
        if (value.state === 'value' && !hasOwn(value, 'value')) add('BM_IMPORT_RESULT_INVALID', 'Value state requires a value', `reviewReport.metadataStates.${key}.value`)
        if (value.state !== 'value' && hasOwn(value, 'value')) add('BM_IMPORT_RESULT_INVALID', 'Absent/null state cannot contain a value', `reviewReport.metadataStates.${key}.value`)
      }
    }
  }

  const diagnostic = (value, path) => {
    if (!object(value, path, DIAGNOSTIC_FIELDS, ['severity', 'code', 'message', 'filename', 'line', 'column'])) return
    if (!['error', 'warning', 'info'].includes(value.severity)) add('BM_IMPORT_RESULT_INVALID', 'Invalid diagnostic severity', `${path}.severity`)
    string(value.code, `${path}.code`)
    string(value.message, `${path}.message`)
    string(value.filename, `${path}.filename`)
    integer(value.line, `${path}.line`)
    integer(value.column, `${path}.column`)
  }
  compilation.diagnostics.forEach((item, index) => diagnostic(item, `result.diagnostics[${index}]`))
  if (array(report.diagnostics, 'reviewReport.diagnostics')) {
    report.diagnostics.forEach((item, index) => diagnostic(item, `reviewReport.diagnostics[${index}]`))
    if (!same(report.diagnostics, compilation.diagnostics)) add('BM_IMPORT_RESULT_INVALID', 'Root and review-report diagnostics differ', 'reviewReport.diagnostics')
  }
  if (Array.isArray(compilation.diagnostics) && isObject(report.compilerSummary)) {
    const expectedSummary = {
      errors: compilation.diagnostics.filter(item => item?.severity === 'error').length,
      warnings: compilation.diagnostics.filter(item => item?.severity === 'warning').length,
      editorial: 0,
      info: compilation.diagnostics.filter(item => item?.severity === 'info').length
    }
    if (!same(report.compilerSummary, expectedSummary)) add('BM_IMPORT_RESULT_INVALID', 'compilerSummary does not match diagnostics', 'reviewReport.compilerSummary')
    if (expectedSummary.errors > 0) add('BM_IMPORT_RESULT_INVALID', 'Error-severity compiler diagnostics block import planning', 'result.diagnostics')
  }

  for (const name of ['unresolved', 'controlledMappings', 'pendingLookups', 'skippedDestinationFields', 'editorialItems']) {
    if (!array(report[name], `reviewReport.${name}`)) continue
  }
  report.unresolved?.forEach((item, index) => diagnostic(item, `reviewReport.unresolved[${index}]`))
  report.controlledMappings?.forEach((item, index) => {
    const path = `reviewReport.controlledMappings[${index}]`
    if (object(item, path, ['code', 'path', 'target', 'value', 'reason'], ['code', 'path', 'value', 'reason'])) {
      string(item.code, `${path}.code`); string(item.path, `${path}.path`); string(item.reason, `${path}.reason`)
    }
  })
  report.pendingLookups?.forEach((item, index) => {
    const path = `reviewReport.pendingLookups[${index}]`
    if (object(item, path, ['type', 'slug', 'sourcePath', 'destinationPath', 'status', 'reason'], ['type', 'slug', 'sourcePath', 'destinationPath', 'status', 'reason'])) {
      if (item.type !== 'challengeSeriesSlug' || item.status !== 'unresolved') add('BM_IMPORT_RESULT_INVALID', 'Unsupported pending lookup', path)
    }
  })
  report.skippedDestinationFields?.forEach((item, index) => {
    const path = `reviewReport.skippedDestinationFields[${index}]`
    if (object(item, path, ['sourcePath', 'reason'], ['sourcePath', 'reason'])) {
      string(item.sourcePath, `${path}.sourcePath`); string(item.reason, `${path}.reason`)
    }
  })
  report.editorialItems?.forEach((item, index) => {
    const path = `reviewReport.editorialItems[${index}]`
    if (!object(item, path, ['kind', 'status', 'line', 'column', 'text', 'classification', 'reviewHistory'], ['kind', 'status', 'line', 'column', 'text'])) return
    if (!['EDITORIAL NOTE', 'TODO', 'REVIEW REQUIRED', 'COMMENT'].includes(item.kind)) add('BM_IMPORT_RESULT_INVALID', 'Unknown editorial annotation category', `${path}.kind`)
    if (item.status !== 'unresolved') add('BM_IMPORT_RESULT_INVALID', 'Planner input annotations must remain unresolved', `${path}.status`)
    integer(item.line, `${path}.line`); integer(item.column, `${path}.column`); string(item.text, `${path}.text`)
    if (hasOwn(item, 'classification') && !['actionable', 'informational'].includes(item.classification)) add('BM_IMPORT_RESULT_INVALID', 'Invalid editorial classification', `${path}.classification`)
    if (['TODO', 'REVIEW REQUIRED'].includes(item.kind) && item.classification === 'informational') add('BM_IMPORT_RESULT_INVALID', 'Actionable annotation cannot be classified as informational', `${path}.classification`)
    if (hasOwn(item, 'reviewHistory') && !Array.isArray(item.reviewHistory)) add('BM_IMPORT_RESULT_INVALID', 'reviewHistory must be an array', `${path}.reviewHistory`)
  })

  if (object(report.compatibility, 'reviewReport.compatibility', ['targetRepository', 'targetRevision', 'schemaComplete', 'missingRequiredFields', 'note'], ['targetRepository', 'targetRevision', 'schemaComplete', 'missingRequiredFields', 'note'])) {
    if (report.compatibility.targetRepository !== schemaSnapshot?.repository || report.compatibility.targetRevision !== schemaSnapshot?.revision) {
      add('BM_IMPORT_SCHEMA_INCOMPATIBLE', 'Compiler target does not match the supplied Bibleberry schema snapshot', 'reviewReport.compatibility')
    }
    const missing = ['series']
    if (!hasOwn(candidate, 'sequence')) missing.push('sequence')
    if (!hasOwn(candidate, 'releaseAt')) missing.push('releaseAt')
    if (!same(report.compatibility.missingRequiredFields, missing)) add('BM_IMPORT_RESULT_INVALID', 'compatibility.missingRequiredFields is inconsistent with the candidate', 'reviewReport.compatibility.missingRequiredFields')
    if (report.schemaComplete !== (missing.length === 0) || report.compatibility.schemaComplete !== report.schemaComplete) {
      add('BM_IMPORT_RESULT_INVALID', 'Schema-completeness claims are inconsistent', 'reviewReport.schemaComplete')
    }
  }

  return { errors, warnings, structuralValid: errors.length === 0 }
}
