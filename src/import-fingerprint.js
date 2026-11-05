import { stableStringify, sha256 } from './keys.js'
import { validateImportCompilation } from './import-validation.js'

export const IMPORT_CONTENT_FINGERPRINT_VERSION = 'berrymark-import-content-v1'

const OBJECT_FIELDS = {
  challenge: ['_type', 'title', 'slug', 'challengeType', 'series', 'sequence', 'releaseAt', 'summary', 'primaryScripture', 'screens', 'companionLinks', 'editorialReview'],
  challengeScreen: ['_type', '_key', 'screenLabel', 'heading', 'blocks'],
  richTextBlock: ['_type', '_key', 'body'],
  scriptureBlock: ['_type', '_key', 'scripture'],
  statementBlock: ['_type', '_key', 'text', 'label'],
  comparisonBlock: ['_type', '_key', 'left', 'right', 'footer', 'reviewStatus'],
  comparisonSide: ['_type', 'title', 'body'],
  visualCardsBlock: ['_type', '_key', 'cards', 'reviewStatus'],
  visualCard: ['_type', '_key', 'title', 'body'],
  connectedSequenceBlock: ['_type', '_key', 'steps', 'cycle', 'returnCaption', 'conclusion', 'reviewStatus'],
  sequenceStep: ['_type', '_key', 'title', 'body'],
  reflectionBlock: ['_type', '_key', 'question', 'choices', 'closing', 'reviewStatus'],
  reflectionChoice: ['_type', '_key', 'label', 'prompt'],
  optionalStudyBlock: ['_type', '_key', 'title', 'body', 'scriptures', 'reviewStatus'],
  prayerBlock: ['_type', '_key', 'paragraphs'],
  scriptureReference: ['_type', '_key', 'reference', 'translation', 'textStatus', 'passage', 'usageRightsConfirmed', 'practiceStatus'],
  companionLink: ['_type', '_key', 'provider', 'label', 'description', 'url', 'availability'],
  editorialReview: ['_type', 'sourceTitle', 'sourceRevision', 'adaptationReviewed', 'reviewedBy', 'reviewedAt', 'reviewNotes'],
  portableTextBlock: ['_type', '_key', 'children', 'markDefs', 'style', 'listItem', 'level'],
  span: ['_type', '_key', 'marks', 'text'],
  link: ['_type', '_key', 'href'],
  slug: ['_type', 'current']
}

const REQUIRED_FIELDS = {
  challenge: ['_type', 'title', 'slug', 'challengeType', 'primaryScripture', 'screens', 'editorialReview'],
  challengeScreen: ['_type', '_key', 'blocks'],
  richTextBlock: ['_type', '_key', 'body'],
  scriptureBlock: ['_type', '_key', 'scripture'],
  statementBlock: ['_type', '_key', 'text'],
  comparisonBlock: ['_type', '_key', 'left', 'right', 'reviewStatus'],
  comparisonSide: ['_type', 'title', 'body'],
  visualCardsBlock: ['_type', '_key', 'cards', 'reviewStatus'],
  visualCard: ['_type', '_key', 'title'],
  connectedSequenceBlock: ['_type', '_key', 'steps', 'reviewStatus'],
  sequenceStep: ['_type', '_key', 'title', 'body'],
  reflectionBlock: ['_type', '_key', 'question', 'reviewStatus'],
  reflectionChoice: ['_type', '_key', 'label', 'prompt'],
  optionalStudyBlock: ['_type', '_key', 'title', 'body', 'reviewStatus'],
  prayerBlock: ['_type', '_key', 'paragraphs'],
  scriptureReference: ['_type', 'reference', 'translation', 'textStatus', 'practiceStatus'],
  companionLink: ['_type', '_key', 'provider', 'label'],
  editorialReview: ['_type', 'sourceTitle', 'adaptationReviewed'],
  portableTextBlock: ['_type', '_key', 'children', 'markDefs', 'style'],
  span: ['_type', '_key', 'marks', 'text'],
  link: ['_type', '_key', 'href'],
  slug: ['_type', 'current']
}

const ARRAY_ITEMS = {
  'challenge.screens': 'challengeScreen',
  'challengeScreen.blocks': 'contentBlock',
  'richTextBlock.body': 'portableTextBlock',
  'comparisonSide.body': 'portableTextBlock',
  'optionalStudyBlock.body': 'portableTextBlock',
  'portableTextBlock.children': 'span',
  'portableTextBlock.markDefs': 'link',
  'visualCardsBlock.cards': 'visualCard',
  'connectedSequenceBlock.steps': 'sequenceStep',
  'reflectionBlock.choices': 'reflectionChoice',
  'optionalStudyBlock.scriptures': 'scriptureReference',
  'challenge.companionLinks': 'companionLink'
}

const OBJECT_CHILDREN = {
  'challenge.slug': 'slug',
  'challenge.primaryScripture': 'scriptureReference',
  'challenge.editorialReview': 'editorialReview',
  'scriptureBlock.scripture': 'scriptureReference',
  'comparisonBlock.left': 'comparisonSide',
  'comparisonBlock.right': 'comparisonSide'
}

const BLOCK_TYPES = new Set([
  'richTextBlock', 'scriptureBlock', 'statementBlock', 'comparisonBlock',
  'visualCardsBlock', 'connectedSequenceBlock', 'reflectionBlock',
  'optionalStudyBlock', 'prayerBlock'
])
const SANITY_TYPES = { portableTextBlock: 'block' }
const HUMAN_REVIEW_FIELDS = new Set(['reviewedBy', 'reviewedAt', 'reviewNotes'])
const CONTENT_ROOT_FIELDS = [
  '_type', 'title', 'slug', 'challengeType', 'summary', 'primaryScripture',
  'screens', 'companionLinks', 'editorialReview'
]

const hasOwn = (value, key) => Object.hasOwn(value, key)
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

function assertJsonValue(value, path, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number' && Number.isFinite(value)) return
  if (typeof value !== 'object') throw new TypeError(`${path} is not JSON-compatible`)
  if (seen.has(value)) throw new TypeError(`${path} contains a cycle`)
  seen.add(value)
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!hasOwn(value, index)) throw new TypeError(`${path}[${index}] is a sparse array entry`)
      assertJsonValue(value[index], `${path}[${index}]`, seen)
    }
  } else {
    for (const [key, nested] of Object.entries(value)) {
      assertJsonValue(nested, `${path}.${key}`, seen)
    }
  }
  seen.delete(value)
}

function validateSanityObject(type, value, path) {
  if (!isObject(value)) throw new TypeError(`${path} must be an object`)
  const allowed = OBJECT_FIELDS[type]
  if (!allowed) throw new TypeError(`${path} has unsupported _type ${String(type)}`)
  const expectedType = SANITY_TYPES[type] ?? type
  if (value._type !== expectedType) throw new TypeError(`${path}._type must be ${expectedType}`)
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new TypeError(`Unknown importer-owned field ${path}.${key}`)
  }
  for (const key of REQUIRED_FIELDS[type]) {
    if (!hasOwn(value, key) || value[key] === null) throw new TypeError(`${path}.${key} is required`)
  }

  const result = {}
  for (const [key, nested] of Object.entries(value)) {
    if (type === 'editorialReview' && HUMAN_REVIEW_FIELDS.has(key)) continue
    const childType = OBJECT_CHILDREN[`${type}.${key}`]
    const itemType = ARRAY_ITEMS[`${type}.${key}`]
    if (childType && nested !== null) {
      result[key] = validateSanityObject(childType, nested, `${path}.${key}`)
    } else if (itemType && nested !== null) {
      if (!Array.isArray(nested)) throw new TypeError(`${path}.${key} must be an array`)
      result[key] = nested.map((item, index) => {
        const resolvedType = itemType === 'contentBlock' ? item?._type : itemType
        if (itemType === 'contentBlock' && !BLOCK_TYPES.has(resolvedType)) {
          throw new TypeError(`${path}.${key}[${index}] has unsupported _type ${String(resolvedType)}`)
        }
        return validateSanityObject(resolvedType, item, `${path}.${key}[${index}]`)
      })
    } else {
      assertJsonValue(nested, `${path}.${key}`)
      result[key] = nested
    }
  }
  return result
}

function projectCandidate(compilation, schemaSnapshot) {
  const validation = validateImportCompilation(compilation, schemaSnapshot)
  if (!validation.structuralValid) {
    const paths = validation.errors.map(error => error.path ?? error.code).join(', ')
    throw new TypeError(`Cannot fingerprint an invalid compiler candidate: ${paths}`)
  }
  const content = Object.fromEntries(CONTENT_ROOT_FIELDS
    .filter(key => hasOwn(compilation.sanityCandidate, key))
    .map(key => [key, compilation.sanityCandidate[key]]))
  return validateSanityObject('challenge', content, 'sanityCandidate')
}

export function projectCandidateImportContent(compilation, schemaSnapshot) {
  return projectCandidate(compilation, schemaSnapshot)
}

export function projectSanityDraftImportContent(document) {
  if (!isObject(document) || document._type !== 'challenge') {
    throw new TypeError('Sanity document must be a challenge')
  }
  const content = {}
  for (const key of CONTENT_ROOT_FIELDS) {
    if (hasOwn(document, key)) content[key] = document[key]
  }
  return validateSanityObject('challenge', content, 'document')
}

function hashProjection(projection) {
  assertJsonValue(projection, 'importerOwnedContent')
  return sha256(`${IMPORT_CONTENT_FINGERPRINT_VERSION}\n${stableStringify(projection)}`)
}

export function candidateSha256(compilation, schemaSnapshot) {
  return hashProjection(projectCandidate(compilation, schemaSnapshot))
}

export function lastImportedContentSha256(document) {
  return hashProjection(projectSanityDraftImportContent(document))
}
