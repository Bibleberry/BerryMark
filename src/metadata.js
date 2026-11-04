import {
  LineCounter,
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseDocument
} from 'yaml'
import { validateScriptureConsistency } from './scripture.js'

const CORE_TAGS = new Set([
  'tag:yaml.org,2002:map',
  'tag:yaml.org,2002:seq',
  'tag:yaml.org,2002:str',
  'tag:yaml.org,2002:null',
  'tag:yaml.org,2002:bool',
  'tag:yaml.org,2002:int',
  'tag:yaml.org,2002:float'
])
const TOP_LEVEL = ['berrymark', 'challenge', 'publishing', 'scripture', 'editorial', 'companionLinks']
const CHALLENGE_FIELDS = ['title', 'slug', 'type', 'summary']
const PUBLISHING_FIELDS = ['series', 'sequence', 'releaseAt']
const SCRIPTURE_FIELDS = ['reference', 'translation', 'textStatus', 'passage', 'usageRightsConfirmed', 'practiceStatus']
const EDITORIAL_FIELDS = ['sourceTitle', 'sourceAuthor', 'sourceRevision', 'approvalStatus', 'approvedBy', 'approvedAt']
const LINK_FIELDS = ['provider', 'label', 'description', 'url', 'availability']
const CHALLENGE_TYPES = ['teaching', 'discipline', 'reflection', 'memorization']
const PROVIDERS = ['social', 'patreon', 'podcast', 'walkingReel', 'youtube', 'other']
const hasOwn = (object, key) => Object.hasOwn(object, key)
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const hasText = value => typeof value === 'string' && value.trim().length > 0
const pathKey = path => JSON.stringify(path)

export function formatMetadataPath(path) {
  return path.reduce((result, segment) => (
    typeof segment === 'number' ? `${result}[${segment}]` : result ? `${result}.${segment}` : segment
  ), '')
}

function diagnostic(diagnostics, severity, code, message, line, column = 1, path, target) {
  diagnostics.push({ severity, code, message, line, column, ...(path ? { path } : {}), ...(target ? { target } : {}) })
}

/**
 * Parse YAML 1.2 core-schema front matter without evaluating code.
 * Explicit non-core tags, anchors, and aliases are rejected so the typed
 * representation remains acyclic and safe to serialize as JSON.
 */
export function parseMetadata(frontmatter, diagnostics, locationsOut) {
  if (!frontmatter) return null
  const initialErrorCount = diagnostics.filter(item => item.severity === 'error').length
  const lineCounter = new LineCounter()
  const document = parseDocument(frontmatter.raw, {
    lineCounter,
    schema: 'core',
    strict: true,
    uniqueKeys: true,
    version: '1.2'
  })
  const locations = new Map()
  const locateOffset = offset => {
    const position = lineCounter.linePos(Math.max(0, offset ?? 0))
    return { line: frontmatter.startLine + position.line, column: position.col }
  }
  const reportYaml = (code, message, offset) => {
    const { line, column } = locateOffset(offset)
    diagnostic(diagnostics, 'error', code, message, line, column)
  }

  for (const error of document.errors) {
    reportYaml(
      error.code === 'DUPLICATE_KEY' ? 'BM_YAML_DUPLICATE_KEY' : 'BM_YAML_SYNTAX',
      error.message.split('\n')[0],
      error.pos?.[0]
    )
  }

  const inspect = (node, path = []) => {
    if (!node) return
    if (node.tag && !CORE_TAGS.has(node.tag)) {
      reportYaml('BM_YAML_TAG_UNSUPPORTED', `Unsupported YAML tag "${node.tag}"`, node.range?.[0])
    }
    if (node.anchor) {
      reportYaml('BM_YAML_ANCHOR_UNSUPPORTED', 'YAML anchors are not supported in BerryMark front matter', node.range?.[0])
    }
    if (isScalar(node) && typeof node.value === 'number' && !Number.isFinite(node.value)) {
      reportYaml('BM_YAML_NUMBER_UNSUPPORTED', 'Non-finite YAML numbers are not supported', node.range?.[0])
    }
    if (isAlias(node)) {
      reportYaml('BM_YAML_ALIAS_UNSUPPORTED', 'YAML aliases are not supported in BerryMark front matter', node.range?.[0])
      return
    }
    if (isMap(node)) {
      if (!locations.has(pathKey(path))) locations.set(pathKey(path), node.range?.[0] ?? 0)
      for (const pair of node.items) {
        inspect(pair.key, path)
        if (!isScalar(pair.key) || typeof pair.key.value !== 'string') {
          reportYaml('BM_YAML_KEY_TYPE', 'YAML mapping keys must be strings', pair.key?.range?.[0] ?? node.range?.[0])
          continue
        }
        const childPath = [...path, pair.key.value]
        if (!locations.has(pathKey(childPath))) locations.set(pathKey(childPath), pair.key.range?.[0] ?? node.range?.[0])
        inspect(pair.value, childPath)
      }
    } else if (isSeq(node)) {
      if (!locations.has(pathKey(path))) locations.set(pathKey(path), node.range?.[0] ?? 0)
      node.items.forEach((item, index) => {
        const itemPath = [...path, index]
        locations.set(pathKey(itemPath), item?.range?.[0] ?? node.range?.[0] ?? 0)
        inspect(item, itemPath)
      })
    }
  }
  inspect(document.contents)

  for (const warning of document.warnings) {
    if (warning.code === 'TAG_RESOLVE_FAILED') continue
    reportYaml('BM_YAML_UNSUPPORTED', warning.message.split('\n')[0], warning.pos?.[0])
  }

  if (!isMap(document.contents)) {
    reportYaml('BM_YAML_ROOT', 'YAML front matter must be a mapping at its root', document.contents?.range?.[0] ?? 0)
  }

  const yamlErrors = diagnostics.filter(item => item.severity === 'error').length > initialErrorCount
  if (yamlErrors || !isMap(document.contents)) return null

  let value
  try {
    value = document.toJS({ maxAliasCount: 0 })
  } catch (error) {
    reportYaml('BM_YAML_VALUE', `YAML value could not be materialized: ${error.message}`, 0)
    return null
  }

  const locationFor = path => {
    for (let length = path.length; length >= 0; length--) {
      const candidate = path.slice(0, length)
      const offset = locations.get(pathKey(candidate))
      if (offset !== undefined) return { ...locateOffset(offset), path: formatMetadataPath(path) }
    }
    return { line: frontmatter.startLine + 1, column: 1, path: formatMetadataPath(path) }
  }

  validateMetadata(value, diagnostics, locationFor)
  if (locationsOut) {
    for (const [path, offset] of locations) locationsOut.set(path, locateOffset(offset))
  }
  return value
}

function validateMetadata(metadata, diagnostics, locationFor) {
  const report = (severity, code, message, path) => {
    const location = locationFor(path)
    diagnostic(diagnostics, severity, code, message, location.line, location.column, location.path)
  }
  const unknownFields = (record, allowed, path) => {
    for (const key of Object.keys(record)) {
      if (!allowed.includes(key)) report('error', 'BM_METADATA_UNKNOWN_FIELD', `Unknown BerryMark metadata field "${formatMetadataPath([...path, key])}"`, [...path, key])
    }
  }
  const requiredString = (record, key, path) => {
    if (!hasOwn(record, key)) {
      report('error', 'BM_METADATA_REQUIRED', `Missing required metadata "${formatMetadataPath([...path, key])}"`, [...path, key])
      return
    }
    stringField(record, key, path, false)
  }
  const stringField = (record, key, path, nullable = true) => {
    if (!hasOwn(record, key)) return
    const value = record[key]
    if (nullable && value === null) return
    if (typeof value !== 'string') {
      report('error', 'BM_METADATA_TYPE', `${formatMetadataPath([...path, key])} must be ${nullable ? 'a string or null' : 'a string'}; no coercion was applied`, [...path, key])
    } else if (!hasText(value)) {
      report('error', 'BM_METADATA_EMPTY', `${formatMetadataPath([...path, key])} must not be empty`, [...path, key])
    }
  }
  const objectField = (name, required = true) => {
    if (!hasOwn(metadata, name)) {
      if (required) report('error', 'BM_METADATA_REQUIRED', `Missing required metadata section "${name}"`, [name])
      return null
    }
    if (!isRecord(metadata[name])) {
      report('error', 'BM_METADATA_TYPE', `${name} must be a YAML mapping`, [name])
      return null
    }
    return metadata[name]
  }
  const enumField = (record, key, path, values, required = true) => {
    if (!hasOwn(record, key)) {
      if (required) report('error', 'BM_METADATA_REQUIRED', `Missing required metadata "${formatMetadataPath([...path, key])}"`, [...path, key])
      return
    }
    if (typeof record[key] !== 'string') {
      report('error', 'BM_METADATA_TYPE', `${formatMetadataPath([...path, key])} must be a string`, [...path, key])
    } else if (!values.includes(record[key])) {
      report('error', 'BM_METADATA_ENUM', `${formatMetadataPath([...path, key])} must be one of: ${values.join(', ')}`, [...path, key])
    }
  }

  unknownFields(metadata, TOP_LEVEL, [])
  if (!hasOwn(metadata, 'berrymark')) {
    report('error', 'BM_VERSION_REQUIRED', 'Missing required berrymark version "0.1"', ['berrymark'])
  } else if (metadata.berrymark !== '0.1') {
    report('error', 'BM_VERSION_UNSUPPORTED', 'berrymark must be the string "0.1"; no version coercion was applied', ['berrymark'])
  }

  const challenge = objectField('challenge')
  if (challenge) {
    unknownFields(challenge, CHALLENGE_FIELDS, ['challenge'])
    for (const key of ['title', 'slug', 'type']) requiredString(challenge, key, ['challenge'])
    stringField(challenge, 'summary', ['challenge'])
    if (hasOwn(challenge, 'type') && typeof challenge.type === 'string' && !CHALLENGE_TYPES.includes(challenge.type)) {
      report('error', 'BM_METADATA_ENUM', `challenge.type must be one of: ${CHALLENGE_TYPES.join(', ')}`, ['challenge', 'type'])
    }
  }

  const publishing = objectField('publishing')
  if (publishing) {
    unknownFields(publishing, PUBLISHING_FIELDS, ['publishing'])
    stringField(publishing, 'series', ['publishing'])
    if (hasOwn(publishing, 'sequence') && publishing.sequence !== null) {
      if (typeof publishing.sequence !== 'number') {
        report('error', 'BM_METADATA_TYPE', 'publishing.sequence must be a positive integer or null; no coercion was applied', ['publishing', 'sequence'])
      } else if (!Number.isSafeInteger(publishing.sequence) || publishing.sequence <= 0) {
        report('error', 'BM_METADATA_SEQUENCE', 'publishing.sequence must be a positive safe integer', ['publishing', 'sequence'])
      }
    }
    if (hasOwn(publishing, 'releaseAt') && publishing.releaseAt !== null) {
      if (typeof publishing.releaseAt !== 'string') {
        report('error', 'BM_METADATA_TYPE', 'publishing.releaseAt must be a timezone-aware datetime string or null', ['publishing', 'releaseAt'])
      } else if (!isTimezoneAwareDateTime(publishing.releaseAt)) {
        report('error', 'BM_METADATA_DATETIME', 'publishing.releaseAt must be a valid ISO 8601 datetime with Z or an explicit offset', ['publishing', 'releaseAt'])
      }
    }
    for (const key of PUBLISHING_FIELDS) {
      if (!hasOwn(publishing, key) || publishing[key] === null) {
        report('info', 'BM_PUBLISHING_UNRESOLVED', `publishing.${key} is unresolved for publication; no value was inferred`, ['publishing', key])
      }
    }
  }

  const scripture = objectField('scripture')
  if (scripture) {
    unknownFields(scripture, SCRIPTURE_FIELDS, ['scripture'])
    for (const key of ['reference', 'translation']) requiredString(scripture, key, ['scripture'])
    enumField(scripture, 'textStatus', ['scripture'], ['referenceOnly', 'provided'])
    enumField(scripture, 'practiceStatus', ['scripture'], ['notConfigured', 'configured'])
    stringField(scripture, 'passage', ['scripture'])
    if (hasOwn(scripture, 'usageRightsConfirmed') && typeof scripture.usageRightsConfirmed !== 'boolean') {
      report('error', 'BM_METADATA_TYPE', 'scripture.usageRightsConfirmed must be true or false; no coercion was applied', ['scripture', 'usageRightsConfirmed'])
    }
    validateScriptureConsistency({
      ...scripture,
      passagePresent: hasOwn(scripture, 'passage') && scripture.passage !== null
    }, (code, message, key) => report('error', code, message, ['scripture', key]))
    if (scripture.usageRightsConfirmed === true) {
      report('info', 'BM_SCRIPTURE_RIGHTS_ASSERTION', 'usageRightsConfirmed is an author assertion, not independently verified license evidence', ['scripture', 'usageRightsConfirmed'])
    }
  }

  const editorial = objectField('editorial')
  if (editorial) {
    unknownFields(editorial, EDITORIAL_FIELDS, ['editorial'])
    for (const key of ['sourceTitle', 'sourceAuthor']) requiredString(editorial, key, ['editorial'])
    stringField(editorial, 'sourceRevision', ['editorial'])
    enumField(editorial, 'approvalStatus', ['editorial'], ['pending', 'approved'])
    stringField(editorial, 'approvedBy', ['editorial'])
    if (hasOwn(editorial, 'approvedAt') && editorial.approvedAt !== null) {
      if (typeof editorial.approvedAt !== 'string') {
        report('error', 'BM_METADATA_TYPE', 'editorial.approvedAt must be a timezone-aware datetime string or null', ['editorial', 'approvedAt'])
      } else if (!isTimezoneAwareDateTime(editorial.approvedAt)) {
        report('error', 'BM_METADATA_DATETIME', 'editorial.approvedAt must be a valid ISO 8601 datetime with Z or an explicit offset', ['editorial', 'approvedAt'])
      }
    }
    if (editorial.approvalStatus === 'pending') {
      for (const key of ['approvedBy', 'approvedAt']) {
        if (hasOwn(editorial, key) && editorial[key] !== null) {
          report('error', 'BM_EDITORIAL_CONTRADICTION', `pending editorial approval cannot include non-null ${key}`, ['editorial', key])
        }
      }
      report('info', 'BM_EDITORIAL_PENDING', 'Editorial approval remains pending; no reviewer or approval date was inferred', ['editorial', 'approvalStatus'])
    } else if (editorial.approvalStatus === 'approved') {
      for (const key of ['approvedBy', 'approvedAt']) {
        if (!hasText(editorial[key])) {
          report('error', 'BM_EDITORIAL_CONTRADICTION', `approved editorial status requires a truthful non-null ${key}`, ['editorial', key])
        }
      }
    }
  }

  if (hasOwn(metadata, 'companionLinks')) {
    if (!Array.isArray(metadata.companionLinks)) {
      report('error', 'BM_METADATA_TYPE', 'companionLinks must be an array', ['companionLinks'])
    } else {
      metadata.companionLinks.forEach((link, index) => {
        const path = ['companionLinks', index]
        if (!isRecord(link)) {
          report('error', 'BM_METADATA_TYPE', `${formatMetadataPath(path)} must be a mapping`, path)
          return
        }
        unknownFields(link, LINK_FIELDS, path)
        enumField(link, 'provider', path, PROVIDERS)
        requiredString(link, 'label', path)
        stringField(link, 'description', path)
        stringField(link, 'availability', path)
        if (hasOwn(link, 'url') && link.url !== null) {
          if (typeof link.url !== 'string' || !isHttpUrl(link.url)) {
            report('error', 'BM_METADATA_URL', `${formatMetadataPath([...path, 'url'])} must be an absolute HTTP(S) URL or null`, [...path, 'url'])
          }
        } else {
          report('info', 'BM_COMPANION_URL_UNRESOLVED', `${formatMetadataPath([...path, 'url'])} is absent or null; no URL was inferred`, [...path, 'url'])
        }
      })
    }
  }
}

export function isTimezoneAwareDateTime(value) {
  if (typeof value !== 'string') return false
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/)
  if (!match) return false
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone] = match
  const year = Number(yearText), month = Number(monthText), day = Number(dayText)
  const hour = Number(hourText), minute = Number(minuteText), second = Number(secondText)
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  if (day < 1 || day > daysInMonth) return false
  if (zone !== 'Z') {
    const offsetHour = Number(zone.slice(1, 3)), offsetMinute = Number(zone.slice(4, 6))
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return false
  }
  return !Number.isNaN(Date.parse(value))
}

function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname)
  } catch {
    return false
  }
}
