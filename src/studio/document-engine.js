import { isDeepStrictEqual } from 'node:util'
import { parseDocument, stringify } from 'yaml'
import { parseBerryMark } from '../parser.js'
import { sha256 } from '../keys.js'
import { indexBerryMarkSource, nodeSource } from './source-index.js'
import {
  SEMANTIC_ID,
  StudioSerializationError,
  assertFieldAllowed,
  fieldPhase,
  idHint,
  semanticId,
  serializeBlock,
  serializeBody,
  serializeField,
  serializeNested,
  serializeScreen
} from './serialization.js'

const READ_ONLY_CODES = new Set([
  'BM_VERSION_UNSUPPORTED', 'BM_METADATA_UNKNOWN_FIELD',
  'BM_MARKER_UNKNOWN', 'BM_MARKER_MISMATCH', 'BM_MARKER_UNCLOSED',
  'BM_NESTING', 'BM_ID_DUPLICATE', 'BM_ID_REQUIRED', 'BM_ID_UNEXPECTED',
  'BM_COMMENT_UNCLOSED', 'BM_OUTSIDE_SCREEN',
  'BM_FIELD_UNKNOWN', 'BM_FIELD_SYNTAX', 'BM_FIELD_DUPLICATE',
  'BM_SCREEN_DUPLICATE', 'BM_SCREEN_HEADER', 'BM_SCREEN_PROSE',
  'BM_CB4_STRAY', 'BM_CB5_STRAY', 'BM_BODY_AFTER_NESTED', 'BM_MIXED_STRAY',
  'BM_PLAIN_NESTED', 'BM_FIELD_NESTED'
])
const REPEATABLE = new Set(['CARD', 'STEP', 'CHOICE', 'SCRIPTURE'])
const SINGULAR = new Set(['LEFT', 'RIGHT', 'FOOTER'])
const APPROVAL_FIELDS = new Set(['approvalStatus', 'approvedBy', 'approvedAt'])
const REVIEW_STATE_VERSION = 'berrymark-studio-review-v1'
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value))

function freezeData(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) freezeData(child)
  }
  return value
}

function validationSnapshot(validation) {
  const snapshot = structuredClone(validation)
  const locations = structuredClone(validation.metadataLocations)
  for (const location of locations.values()) freezeData(location)
  Object.defineProperties(snapshot, {
    sourceSha256: { value: validation.sourceSha256 },
    // Freezing a Map leaves its entries mutable. Give each reader its own Map.
    metadataLocations: { get: () => new Map(locations) }
  })
  return freezeData(snapshot)
}

function validationAllowsEditing(validation) {
  return validation.diagnostics.every(item => (
    item.severity !== 'error' ||
    (!READ_ONLY_CODES.has(item.code) && !item.code.startsWith('BM_YAML_') && !item.code.startsWith('BM_FRONTMATTER_'))
  ))
}

function pathParts(path) {
  if (Array.isArray(path)) return path.map(part => typeof part === 'number' ? part : String(part))
  if (typeof path !== 'string' || !path) throw new StudioSerializationError('BM_STUDIO_METADATA_PATH', 'Metadata path must be a nonempty string or array')
  return path.replace(/\[(\d+)\]/g, '.$1').split('.').map(part => /^\d+$/.test(part) ? Number(part) : part)
}

function assertMetadataPath(path) {
  const allowed = new Set([
    'berrymark',
    ...['title', 'slug', 'type', 'summary'].map(key => `challenge.${key}`),
    ...['series', 'sequence', 'releaseAt'].map(key => `publishing.${key}`),
    ...['reference', 'translation', 'textStatus', 'passage', 'usageRightsConfirmed', 'practiceStatus'].map(key => `scripture.${key}`),
    ...['sourceTitle', 'sourceAuthor', 'sourceRevision', 'approvalStatus', 'approvedBy', 'approvedAt'].map(key => `editorial.${key}`)
  ])
  const rendered = path.join('.')
  if (allowed.has(rendered)) return
  if (path[0] === 'companionLinks') {
    if (path.length === 1) return
    if (typeof path[1] === 'number' && path.length === 2) return
    if (typeof path[1] === 'number' && path.length === 3 && ['provider', 'label', 'description', 'url', 'availability'].includes(path[2])) return
  }
  throw new StudioSerializationError('BM_STUDIO_METADATA_PATH', `Unsupported metadata path "${rendered}"`)
}

function assertJsonValue(value, seen = new Set()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return
  if (typeof value === 'number' && Number.isFinite(value)) return
  if (typeof value !== 'object' || value === undefined) {
    throw new StudioSerializationError('BM_STUDIO_VALUE_TYPE', 'Metadata values must be finite JSON-compatible values')
  }
  if (seen.has(value)) throw new StudioSerializationError('BM_STUDIO_VALUE_TYPE', 'Cyclic metadata values are not supported')
  seen.add(value)
  if (Array.isArray(value)) {
    for (const item of value) assertJsonValue(item, seen)
  } else {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new StudioSerializationError('BM_STUDIO_VALUE_TYPE', 'Metadata objects must be plain objects')
    }
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) throw new StudioSerializationError('BM_STUDIO_VALUE_TYPE', `Metadata value "${key}" is undefined; use null or delete the key`)
      assertJsonValue(item, seen)
    }
  }
  seen.delete(value)
}

function valueAt(value, path) {
  let current = value
  for (const part of path) {
    if (current === null || current === undefined || !Object.hasOwn(current, part)) return undefined
    current = current[part]
  }
  return current
}

function lineIndexRange(index, start, end) {
  return index.lines.filter(line => line.start >= start && line.end <= end && line.end > line.start)
}

export class BerryMarkEditError extends Error {
  constructor(code, message, line = 1) {
    super(message)
    this.name = 'BerryMarkEditError'
    this.code = code
    this.diagnostic = { severity: 'error', code, message, line, column: 1 }
  }
}

export class BerryMarkStudioDocument {
  #source
  #filename
  #index
  #validation
  #validationSnapshots = new WeakMap()
  #reviewDiagnostics = []
  #dirty = false

  constructor(source, { filename = '<memory>', reviewState } = {}) {
    if (typeof source !== 'string') throw new TypeError('BerryMark source must be a string')
    this.#source = source
    this.#filename = filename
    this.#refresh()
    if (reviewState !== undefined) this.#restoreReviewState(reviewState)
  }

  get filename() { return this.#filename }
  get dirty() { return this.#dirty }
  get editable() { return this.#index.editableStructure && validationAllowsEditing(this.#validation) }
  get valid() { return this.#validation.ok }
  get status() { return this.editable ? (this.valid ? 'valid' : 'incomplete') : 'unsupported' }
  get eol() { return this.#index.eol }
  get diagnostics() {
    return structuredClone([...this.#index.diagnostics, ...this.#validation.diagnostics, ...this.#reviewDiagnostics])
  }
  get reviewDiagnostics() { return clone(this.#reviewDiagnostics) }

  // Stage a group of edits without affecting the original working document.
  fork() {
    const copy = new BerryMarkStudioDocument(this.#source, {
      filename: this.#filename,
      reviewState: this.serializeReviewState()
    })
    copy.#dirty = this.#dirty
    return copy
  }

  serialize() { return this.#source }
  serializeReviewState() {
    return JSON.stringify({
      version: REVIEW_STATE_VERSION,
      sourceSha256: sha256(this.#source),
      approvalStale: this.#reviewDiagnostics.some(item => item.code === 'BM_STUDIO_APPROVAL_STALE')
    })
  }
  validate() {
    let snapshot = this.#validationSnapshots.get(this.#validation)
    if (!snapshot) {
      snapshot = validationSnapshot(this.#validation)
      this.#validationSnapshots.set(this.#validation, snapshot)
    }
    return snapshot
  }
  getMetadata(path) {
    const metadata = this.#validation.document.metadata
    if (metadata === null) return null
    return path === undefined ? clone(metadata) : clone(valueAt(metadata, pathParts(path)))
  }
  listScreens() { return clone(this.#validation.document.screens) }
  getScreen(id) { return clone(this.#validation.document.screens.find(screen => screen.id === id) ?? null) }
  getBlock(id) {
    for (const screen of this.#validation.document.screens) {
      const block = screen.blocks.find(item => item.id === id)
      if (block) return clone(block)
    }
    return null
  }
  getNested(id) {
    for (const screen of this.#validation.document.screens) {
      for (const block of screen.blocks) {
        for (const key of ['cards', 'steps', 'choices', 'scriptures']) {
          const nested = block[key]?.find(item => item.id === id)
          if (nested) return clone(nested)
        }
      }
    }
    return null
  }

  #approvalStaleWarning() {
    return {
      severity: 'warning',
      code: 'BM_STUDIO_APPROVAL_STALE',
      message: 'Source content changed after an existing approval claim; the prior approval does not certify this revision and requires human review',
      filename: this.#filename,
      line: 1,
      column: 1
    }
  }

  #restoreReviewState(serialized) {
    if (typeof serialized !== 'string') {
      throw new BerryMarkEditError('BM_STUDIO_REVIEW_STATE_INVALID', 'Review state must be the string returned by serializeReviewState()')
    }
    let state
    try {
      state = JSON.parse(serialized)
    } catch {
      throw new BerryMarkEditError('BM_STUDIO_REVIEW_STATE_INVALID', 'Review state is not valid JSON')
    }
    if (state === null || typeof state !== 'object' || Array.isArray(state) ||
        state.version !== REVIEW_STATE_VERSION || typeof state.sourceSha256 !== 'string' ||
        typeof state.approvalStale !== 'boolean') {
      throw new BerryMarkEditError('BM_STUDIO_REVIEW_STATE_INVALID', 'Review state has an unsupported shape or version')
    }
    if (state.sourceSha256 !== sha256(this.#source)) {
      throw new BerryMarkEditError('BM_STUDIO_REVIEW_STATE_MISMATCH', 'Review state belongs to different source; reopen the matching saved source')
    }
    if (state.approvalStale) {
      this.#reviewDiagnostics = [this.#approvalStaleWarning()]
    }
  }

  #refresh(rejectUnsafe = false) {
    const index = indexBerryMarkSource(this.#source, this.#filename)
    const validation = parseBerryMark(this.#source, { filename: this.#filename })
    if (rejectUnsafe && (!index.editableStructure || !validationAllowsEditing(validation))) {
      throw new BerryMarkEditError('BM_STUDIO_EDIT_UNSAFE', 'The edit would create malformed or ambiguous source; the previous document was restored')
    }
    this.#index = index
    this.#validation = validation
  }

  #assertEditable() {
    if (!this.editable) {
      throw new BerryMarkEditError('BM_STUDIO_READ_ONLY', `Document is ${this.status}; preserve the original source and resolve structural/unsupported diagnostics before editing`)
    }
  }

  #transaction(callback, { approvalMutation = false } = {}) {
    this.#assertEditable()
    const prior = {
      source: this.#source,
      index: this.#index,
      validation: this.#validation,
      review: this.#reviewDiagnostics,
      dirty: this.#dirty
    }
    const wasApproved = this.#validation.document.metadata?.editorial?.approvalStatus === 'approved'
    try {
      const result = callback()
      const isApproved = this.#validation.document.metadata?.editorial?.approvalStatus === 'approved'
      if (this.#source !== prior.source && wasApproved && isApproved && !approvalMutation &&
          !this.#reviewDiagnostics.some(item => item.code === 'BM_STUDIO_APPROVAL_STALE')) {
        this.#reviewDiagnostics = [...this.#reviewDiagnostics, this.#approvalStaleWarning()]
      }
      return result ?? this
    } catch (error) {
      this.#source = prior.source
      this.#index = prior.index
      this.#validation = prior.validation
      this.#reviewDiagnostics = prior.review
      this.#dirty = prior.dirty
      throw error
    }
  }

  #replace(start, end, replacement) {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > this.#source.length) {
      throw new BerryMarkEditError('BM_STUDIO_RANGE', 'Invalid source edit range')
    }
    const updated = this.#source.slice(0, start) + replacement + this.#source.slice(end)
    if (updated === this.#source) return
    this.#source = updated
    this.#refresh(true)
    this.#dirty = true
  }

  #node(id, expected) {
    const node = this.#index.nodesById.get(id)
    if (!node || (expected && node.kind !== expected)) {
      throw new BerryMarkEditError('BM_STUDIO_TARGET_NOT_FOUND', `${expected ?? 'Element'} with ID "${id}" was not found`)
    }
    if (node.end === null) throw new BerryMarkEditError('BM_STUDIO_TARGET_UNCLOSED', `${node.kind} "${id}" has no safe closing range`, node.openLine + 1)
    return node
  }

  #screen(id) { return this.#node(id, 'SCREEN') }
  #block(id) {
    const node = this.#node(id)
    if (!/^CB[1-9]$/.test(node.kind)) throw new BerryMarkEditError('BM_STUDIO_TARGET_TYPE', `"${id}" is not a top-level Content Block`, node.openLine + 1)
    return node
  }

  #section(block, reference) {
    const byId = REPEATABLE.has(reference) || !SINGULAR.has(reference) ? this.#index.nodesById.get(reference) : null
    const node = byId ?? block.children.find(child => child.kind === reference)
    if (!node || node.parent !== block) {
      throw new BerryMarkEditError('BM_STUDIO_TARGET_NOT_FOUND', `Nested element "${reference}" was not found in ${block.id}`, block.openLine + 1)
    }
    return node
  }

  #usedIds() { return new Set(this.#index.nodesById.keys()) }

  #prepareId(spec, prefix, reserved) {
    const result = { ...spec }
    if (result.id !== null && result.id !== undefined) {
      if (!SEMANTIC_ID.test(result.id)) throw new StudioSerializationError('BM_STUDIO_ID_INVALID', `Invalid semantic ID "${result.id}"`)
      if (reserved.has(result.id)) throw new StudioSerializationError('BM_STUDIO_ID_COLLISION', `Semantic ID "${result.id}" already exists`)
    } else {
      result.id = semanticId(idHint(result), reserved, prefix)
    }
    reserved.add(result.id)
    return result
  }

  #prepareNested(spec, reserved) {
    const kind = spec.type ?? spec.kind
    const result = { ...spec, type: kind }
    if (REPEATABLE.has(kind)) return this.#prepareId(result, kind.toLowerCase(), reserved)
    if (result.id) throw new StudioSerializationError('BM_STUDIO_ID_UNEXPECTED', `${kind} cannot have an ID`)
    return result
  }

  #prepareBlock(spec, reserved) {
    const result = this.#prepareId(spec, 'block', reserved)
    const nestedKinds = { cards: 'CARD', steps: 'STEP', choices: 'CHOICE', scriptures: 'SCRIPTURE' }
    for (const [key, kind] of Object.entries(nestedKinds)) {
      if (!result[key]) continue
      result[key] = result[key].map(item => {
        const declared = item.type ?? item.kind
        if (declared && declared !== kind) {
          throw new StudioSerializationError('BM_STUDIO_NESTING', `${declared} cannot be constructed in the ${key} collection`)
        }
        return this.#prepareNested({ ...item, type: kind }, reserved)
      })
    }
    return result
  }

  #prepareScreen(spec, reserved) {
    const result = this.#prepareId(spec, 'screen', reserved)
    result.blocks = (result.blocks ?? []).map(block => this.#prepareBlock(block, reserved))
    return result
  }

  #insert(anchor, raw) {
    let insertion = raw
    if (!insertion.endsWith('\n') && !insertion.endsWith('\r')) insertion += this.eol
    if (anchor === this.#source.length && anchor > 0 && !/\r$|\n$/.test(this.#source)) insertion = this.eol + insertion
    this.#replace(anchor, anchor, insertion)
  }

  #insertChild(parent, raw, index, kinds = null) {
    const siblings = parent.children.filter(child => !kinds || kinds.includes(child.kind))
    if (!Number.isInteger(index) || index < 0 || index > siblings.length) {
      throw new BerryMarkEditError('BM_STUDIO_INDEX', `Insertion index must be an integer from 0 to ${siblings.length}`, parent.openLine + 1)
    }
    let anchor
    if (index < siblings.length) {
      anchor = siblings[index].start
    } else {
      anchor = this.#index.lines[parent.closeLine].start
      const kind = kinds?.length === 1 ? kinds[0] : null
      const postField = { STEP: 'Conclusion', CHOICE: 'Closing' }[kind]
      if (postField) {
        const range = this.#fieldRange(parent, postField)
        if (range) anchor = range.start
      }
      if (SINGULAR.has(kind)) {
        const order = ['LEFT', 'RIGHT', 'FOOTER']
        const following = parent.children.find(child => order.indexOf(child.kind) > order.indexOf(kind))
        if (following) anchor = following.start
      }
    }
    this.#insert(anchor, raw)
  }

  addScreen(spec, index = this.#index.screens.length) {
    return this.#transaction(() => {
      const prepared = this.#prepareScreen(spec, this.#usedIds())
      const raw = serializeScreen(prepared, this.eol)
      const screens = this.#index.screens
      if (!Number.isInteger(index) || index < 0 || index > screens.length) {
        throw new BerryMarkEditError('BM_STUDIO_INDEX', `Screen insertion index must be from 0 to ${screens.length}`)
      }
      this.#insert(index < screens.length ? screens[index].start : this.#source.length, raw)
      return prepared.id
    })
  }

  updateScreen(id, changes) {
    return this.#transaction(() => {
      if (Object.hasOwn(changes, 'label')) this.#setScreenHeader(this.#screen(id), 'label', changes.label)
      if (Object.hasOwn(changes, 'heading')) this.#setScreenHeader(this.#screen(id), 'heading', changes.heading)
    })
  }

  removeScreen(id) {
    return this.#transaction(() => {
      const screen = this.#screen(id)
      this.#replace(screen.start, screen.end, '')
    })
  }

  moveScreen(id, index) {
    return this.#transaction(() => {
      const screen = this.#screen(id)
      const raw = nodeSource(this.#index, screen)
      const currentIndex = this.#index.screens.indexOf(screen)
      if (index === currentIndex) return
      this.#replace(screen.start, screen.end, '')
      const screens = this.#index.screens
      if (!Number.isInteger(index) || index < 0 || index > screens.length) {
        throw new BerryMarkEditError('BM_STUDIO_INDEX', `Screen destination index must be from 0 to ${screens.length}`)
      }
      this.#insert(index < screens.length ? screens[index].start : this.#source.length, raw)
    })
  }

  addBlock(screenId, spec, index) {
    return this.#transaction(() => {
      const prepared = this.#prepareBlock(spec, this.#usedIds())
      const raw = serializeBlock(prepared, this.eol)
      const screen = this.#screen(screenId)
      this.#insertChild(screen, raw, index ?? screen.children.length)
      return prepared.id
    })
  }

  updateBlock(id, changes) {
    return this.#transaction(() => {
      const kind = this.#block(id).kind
      if (Object.hasOwn(changes, 'fields')) {
        for (const [name, value] of Object.entries(changes.fields)) {
          this.#setField(this.#block(id), name, value)
        }
      }
      if (kind === 'CB1' || kind === 'CB9') {
        if (Object.hasOwn(changes, 'text') || Object.hasOwn(changes, 'body')) {
          this.#setBody(this.#block(id), changes.text ?? changes.body ?? '')
        }
      } else if (kind === 'CB8') {
        if (Object.hasOwn(changes, 'title')) this.#setTitle(this.#block(id), changes.title)
        if (Object.hasOwn(changes, 'body')) this.#setBody(this.#block(id), changes.body, true)
      } else if (kind === 'CB4') {
        for (const section of ['left', 'right', 'footer']) {
          if (!Object.hasOwn(changes, section)) continue
          const reference = section.toUpperCase()
          const value = changes[section]
          if (value === null) {
            const node = this.#section(this.#block(id), reference)
            this.#replace(node.start, node.end, '')
          } else {
            this.#updateSection(this.#block(id), reference, typeof value === 'string' ? { text: value } : value)
          }
        }
      }
    })
  }

  removeBlock(id) {
    return this.#transaction(() => {
      const block = this.#block(id)
      this.#replace(block.start, block.end, '')
    })
  }

  moveBlock(id, destinationScreenId, index) {
    return this.#transaction(() => {
      const block = this.#block(id)
      const destination = this.#screen(destinationScreenId)
      const raw = nodeSource(this.#index, block)
      const currentIndex = block.parent.children.indexOf(block)
      if (block.parent === destination && currentIndex === index) return
      this.#replace(block.start, block.end, '')
      const refreshedDestination = this.#screen(destinationScreenId)
      this.#insertChild(refreshedDestination, raw, index ?? refreshedDestination.children.length)
    })
  }

  addNested(blockId, spec, index) {
    return this.#transaction(() => {
      const block = this.#block(blockId)
      const prepared = this.#prepareNested(spec, this.#usedIds())
      const kind = prepared.type
      const allowed = { CB4: SINGULAR, CB5: new Set(['CARD']), CB6: new Set(['STEP']), CB7: new Set(['CHOICE']), CB8: new Set(['SCRIPTURE']) }[block.kind]
      if (!allowed?.has(kind)) throw new BerryMarkEditError('BM_STUDIO_NESTING', `${kind} is not supported inside ${block.kind}`, block.openLine + 1)
      if (SINGULAR.has(kind) && block.children.some(child => child.kind === kind)) {
        throw new BerryMarkEditError('BM_STUDIO_NESTED_DUPLICATE', `${block.kind} already contains ${kind}`, block.openLine + 1)
      }
      const raw = serializeNested(prepared, this.eol)
      this.#insertChild(block, raw, index ?? block.children.filter(child => child.kind === kind).length, [kind])
      return prepared.id ?? kind
    })
  }

  updateNested(blockId, reference, changes) {
    return this.#transaction(() => this.#updateSection(this.#block(blockId), reference, changes))
  }

  #updateSection(block, reference, changes) {
    const blockId = block.id
    if (Object.hasOwn(changes, 'fields')) {
      for (const [name, value] of Object.entries(changes.fields)) {
        this.#setField(this.#section(this.#block(blockId), reference), name, value)
      }
    }
    if (Object.hasOwn(changes, 'title')) {
      this.#setTitle(this.#section(this.#block(blockId), reference), changes.title)
    }
    if (Object.hasOwn(changes, 'body') || Object.hasOwn(changes, 'text')) {
      const node = this.#section(this.#block(blockId), reference)
      this.#setBody(node, changes.text ?? changes.body ?? '', ['LEFT', 'RIGHT'].includes(node.kind))
    }
  }

  removeNested(blockId, reference) {
    return this.#transaction(() => {
      const node = this.#section(this.#block(blockId), reference)
      this.#replace(node.start, node.end, '')
    })
  }

  moveNested(blockId, reference, index) {
    return this.#transaction(() => {
      const block = this.#block(blockId)
      const node = this.#section(block, reference)
      if (!REPEATABLE.has(node.kind)) throw new BerryMarkEditError('BM_STUDIO_NESTED_REORDER', 'Only CARD, STEP, CHOICE, and SCRIPTURE repeatable elements are reorderable by ID')
      const raw = nodeSource(this.#index, node)
      const siblings = block.children.filter(child => child.kind === node.kind)
      if (siblings.indexOf(node) === index) return
      this.#replace(node.start, node.end, '')
      const refreshed = this.#block(blockId)
      this.#insertChild(refreshed, raw, index, [node.kind])
    })
  }

  setMetadata(path, value) {
    const parts = pathParts(path)
    assertMetadataPath(parts)
    assertJsonValue(value)
    const approvalMutation = parts[0] === 'editorial' && parts.length === 2 && APPROVAL_FIELDS.has(parts[1])
    return this.#transaction(() => this.#editMetadata(parts, value, false), { approvalMutation })
  }

  deleteMetadata(path) {
    const parts = pathParts(path)
    assertMetadataPath(parts)
    if (parts.length === 1 && parts[0] !== 'companionLinks') {
      throw new StudioSerializationError('BM_STUDIO_METADATA_PATH', 'Top-level scalar/section deletion is not supported; set berrymark explicitly or update fields within a section')
    }
    const approvalMutation = parts[0] === 'editorial' && parts.length === 2 && APPROVAL_FIELDS.has(parts[1])
    return this.#transaction(() => this.#editMetadata(parts, null, true), { approvalMutation })
  }

  #editMetadata(path, value, remove) {
    const frontmatter = this.#index.frontmatter
    if (!frontmatter) throw new BerryMarkEditError('BM_STUDIO_METADATA_UNSUPPORTED', 'Safe YAML front matter is required for metadata editing')
    const current = valueAt(this.#validation.document.metadata, path)
    if ((remove && current === undefined) || (!remove && isDeepStrictEqual(current, value))) return
    const document = parseDocument(frontmatter.raw, { schema: 'core', strict: true, uniqueKeys: true, version: '1.2' })
    if (document.errors.length) throw new BerryMarkEditError('BM_STUDIO_METADATA_UNSUPPORTED', 'Malformed YAML cannot be edited safely')
    if (remove) document.deleteIn(path)
    else document.setIn(path, clone(value))
    let output = document.toString({ lineWidth: 0 })
    const hadFinalNewline = /\r$|\n$/.test(frontmatter.raw)
    if (!hadFinalNewline) output = output.replace(/\n$/, '')
    const eol = frontmatter.raw.includes('\r\n') ? '\r\n' : frontmatter.raw.includes('\r') ? '\r' : '\n'
    if (eol !== '\n') output = output.replace(/\n/g, eol)
    this.#replace(frontmatter.rawStart, frontmatter.rawEnd, output)
  }

  #setScreenHeader(screen, key, value) {
    if (value !== null && (typeof value !== 'string' || /[\r\n]/.test(value))) {
      throw new StudioSerializationError('BM_STUDIO_VALUE_TYPE', `Screen ${key} must be a single-line string or null`)
    }
    const firstChild = screen.parts.findIndex(part => part.kind === 'node')
    const candidates = screen.parts.slice(0, firstChild < 0 ? screen.parts.length : firstChild)
    const isLabel = key === 'label'
    const match = part => part.kind === 'line' && (isLabel ? part.text?.startsWith('Label: ') : /^# /.test(part.text ?? ''))
    // line text is read from the index to keep comment/structural locations exact.
    const found = candidates.find(part => {
      if (part.kind !== 'line' || part.comment) return false
      const text = this.#index.lines[part.line].text
      return isLabel ? text.startsWith('Label: ') : /^# /.test(text)
    })
    if (found) {
      const line = this.#index.lines[found.line]
      this.#replace(line.start, line.end, value === null ? '' : `${isLabel ? 'Label:' : '#'} ${value}${this.eol}`)
      return
    }
    if (value === null) return
    let anchor = firstChild < 0 ? this.#index.lines[screen.closeLine].start : screen.parts[firstChild].node.start
    if (isLabel) {
      const heading = candidates.find(part => part.kind === 'line' && /^# /.test(this.#index.lines[part.line].text))
      if (heading) anchor = this.#index.lines[heading.line].start
    } else {
      const label = candidates.find(part => part.kind === 'line' && this.#index.lines[part.line].text.startsWith('Label: '))
      if (label) anchor = this.#index.lines[label.line].end
    }
    this.#insert(anchor, `${isLabel ? 'Label:' : '#'} ${value}${this.eol}`)
  }

  #fieldRange(node, name) {
    const phase = fieldPhase(node.kind, name)
    const childParts = node.parts.map((part, index) => part.kind === 'node' ? index : -1).filter(index => index >= 0)
    let startPart = 0
    let endPart = node.parts.length
    if (phase === 'PRE' && childParts.length) endPart = childParts[0]
    if (phase === 'POST' && childParts.length) startPart = childParts.at(-1) + 1
    const expression = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:(?: ?)(.*)$`)
    for (let partIndex = startPart; partIndex < endPart; partIndex++) {
      const part = node.parts[partIndex]
      if (part.kind !== 'line' || part.comment) continue
      const line = this.#index.lines[part.line]
      const match = line.text.match(expression)
      if (!match) continue
      let end = line.end
      if (match[1] === '|') {
        for (let next = partIndex + 1; next < endPart; next++) {
          const continuation = node.parts[next]
          if (continuation.kind !== 'line') break
          const continuationLine = this.#index.lines[continuation.line]
          if (continuation.comment || continuationLine.text === '' || /^ {2}/.test(continuationLine.text)) end = continuationLine.end
          else break
        }
      }
      return { start: line.start, end, line: part.line + 1 }
    }
    return null
  }

  #setField(node, name, value) {
    assertFieldAllowed(node.kind, name)
    const range = this.#fieldRange(node, name)
    if (!range) {
      if (value === null) return
      const phase = fieldPhase(node.kind, name)
      let anchor = this.#index.lines[node.closeLine].start
      if (phase === 'PRE') {
        const firstChild = node.parts.find(part => part.kind === 'node')
        if (firstChild) anchor = firstChild.node.start
      }
      this.#insert(anchor, serializeField(name, value, this.eol))
      return
    }
    const replacement = value === null ? '' : serializeField(name, value, this.eol)
    this.#replacePreservingComments(range.start, range.end, replacement)
  }

  #richHeader(node) {
    const firstChild = node.parts.findIndex(part => part.kind === 'node')
    const eligible = node.parts.slice(0, firstChild < 0 ? node.parts.length : firstChild)
    const entries = eligible.filter(part => part.kind === 'line' && !part.comment)
    const first = entries.find(part => this.#index.lines[part.line].text.trim())
    const title = first && this.#index.lines[first.line].text.startsWith('Title:') ? first : null
    const valid = Boolean(title && /^Title: [^\s]/.test(this.#index.lines[title.line].text))
    let separator = null
    if (valid) {
      const titlePosition = eligible.indexOf(title)
      for (const part of eligible.slice(titlePosition + 1)) {
        if (part.kind !== 'line' || part.comment) continue
        if (this.#index.lines[part.line].text === '') separator = part
        break
      }
    }
    return { title, valid, separator }
  }

  #setTitle(node, value) {
    if (!['CB8', 'LEFT', 'RIGHT'].includes(node.kind)) {
      throw new BerryMarkEditError('BM_STUDIO_TARGET_TYPE', `${node.kind} does not have a rich-body Title header`, node.openLine + 1)
    }
    if (value !== null && (typeof value !== 'string' || /[\r\n]/.test(value))) {
      throw new StudioSerializationError('BM_STUDIO_VALUE_TYPE', 'Rich-body titles must be a single-line string or null')
    }
    const { title } = this.#richHeader(node)
    if (title) {
      const line = this.#index.lines[title.line]
      this.#replace(line.start, line.end, value === null ? '' : serializeField('Title', value, this.eol))
    } else if (value !== null) {
      this.#insert(this.#index.lines[node.openLine].end, `${serializeField('Title', value, this.eol)}${this.eol}`)
    }
  }

  #setBody(node, value, header = false) {
    if (!['CB1', 'CB9', 'CB8', 'FOOTER', 'LEFT', 'RIGHT'].includes(node.kind)) {
      throw new BerryMarkEditError('BM_STUDIO_TARGET_TYPE', `${node.kind} does not have an editable freeform body`, node.openLine + 1)
    }
    let start = this.#index.lines[node.openLine].end
    let end = this.#index.lines[node.closeLine].start
    const firstChild = node.parts.find(part => part.kind === 'node')
    if (firstChild) end = firstChild.node.start
    if (header) {
      const headerInfo = this.#richHeader(node)
      if (headerInfo.valid) {
        start = this.#index.lines[headerInfo.title.line].end
        if (headerInfo.separator) start = this.#index.lines[headerInfo.separator.line].end
      }
    }
    this.#replacePreservingComments(start, end, serializeBody(value, this.eol))
  }

  #replacePreservingComments(start, end, replacement) {
    const ranges = []
    let comment = null
    for (const line of lineIndexRange(this.#index, start, end)) {
      if (comment) {
        ranges.at(-1).end = line.end
        if (line.text.includes('-->')) comment = null
        continue
      }
      if (line.text.startsWith('<!--')) {
        ranges.push({ start: line.start, end: line.end })
        if (!line.text.includes('-->')) comment = true
      }
    }
    if (!ranges.length) {
      this.#replace(start, end, replacement)
      return
    }
    let output = ''
    let replaced = false
    for (const range of ranges) {
      if (!replaced) {
        output += replacement
        replaced = true
      }
      output += this.#source.slice(range.start, range.end)
    }
    if (!replaced) output = replacement
    this.#replace(start, end, output)
  }
}

export function openBerryMarkDocument(source, options) {
  return new BerryMarkStudioDocument(source, options)
}

export function createBerryMarkDocument({ metadata = { berrymark: '0.1' }, screens = [], lineEnding = '\n', filename = '<memory>' } = {}) {
  if (!['\n', '\r\n'].includes(lineEnding)) throw new StudioSerializationError('BM_STUDIO_EOL', 'lineEnding must be LF or CRLF')
  assertJsonValue(metadata)
  const yaml = stringify(metadata, { lineWidth: 0 }).replace(/\n$/, '').replace(/\n/g, lineEnding)
  const source = `---${lineEnding}${yaml}${lineEnding}---${lineEnding}`
  const document = openBerryMarkDocument(source, { filename })
  for (const screen of screens) document.addScreen(screen)
  return document
}
