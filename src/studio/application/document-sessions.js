import { randomUUID } from 'node:crypto'
import { sha256 } from '../../keys.js'
import {
  createBerryMarkDocument,
  openBerryMarkDocument
} from '../document-engine.js'

const OPERATIONS = new Set([
  'metadata.set',
  'metadata.delete',
  'screen.add',
  'screen.update',
  'screen.move',
  'screen.remove'
])

export class StudioRequestError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.name = 'StudioRequestError'
    this.code = code
    this.status = status
  }
}

function cleanFilename(value) {
  if (typeof value !== 'string') return 'untitled.berry.md'
  const cleaned = value.replace(/[\\/\u0000-\u001F\u007F]/g, '_').trim()
  return (cleaned || 'untitled.berry.md').slice(0, 240)
}

function requiredString(value, name, { allowEmpty = true } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    throw new StudioRequestError('BM_STUDIO_REQUEST_VALUE', `${name} must be ${allowEmpty ? 'a string' : 'a nonempty string'}`)
  }
  return value
}

function optionalIndex(value) {
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || value < 0) {
    throw new StudioRequestError('BM_STUDIO_REQUEST_INDEX', 'Screen index must be a nonnegative integer')
  }
  return value
}

function snapshot(session) {
  const { document, id, revision } = session
  return {
    id,
    revision,
    filename: document.filename,
    status: document.status,
    editable: document.editable,
    dirty: document.dirty,
    eol: document.eol,
    sourceSha256: sha256(document.serialize()),
    metadata: document.getMetadata(),
    screens: document.listScreens(),
    diagnostics: document.diagnostics,
    reviewDiagnostics: document.reviewDiagnostics
  }
}

export class StudioDocumentSessions {
  #sessions = new Map()

  create({ source, filename, reviewState } = {}) {
    requiredString(source, 'Document source')
    try {
      const document = openBerryMarkDocument(source, {
        filename: cleanFilename(filename),
        reviewState
      })
      return this.#add(document)
    } catch (error) {
      if (typeof error?.code === 'string') throw new StudioRequestError(error.code, error.message, 422)
      throw error
    }
  }

  createNew({ filename } = {}) {
    const document = createBerryMarkDocument({
      filename: cleanFilename(filename),
      metadata: { berrymark: '0.1', challenge: { title: '' } }
    })
    return this.#add(document)
  }

  #add(document) {
    const session = { id: randomUUID(), document, revision: 0 }
    this.#sessions.set(session.id, session)
    return snapshot(session)
  }

  #get(id) {
    const session = this.#sessions.get(id)
    if (!session) throw new StudioRequestError('BM_STUDIO_SESSION_NOT_FOUND', 'This document session is no longer available; reopen the manuscript', 404)
    return session
  }

  get(id) {
    return snapshot(this.#get(id))
  }

  serialize(id) {
    const { document, revision } = this.#get(id)
    const source = document.serialize()
    return {
      id,
      revision,
      filename: document.filename,
      source,
      sourceSha256: sha256(source),
      reviewState: document.serializeReviewState(),
      diagnostics: document.diagnostics
    }
  }

  mutate(id, expectedRevision, request = {}) {
    const session = this.#get(id)
    if (!Number.isInteger(expectedRevision) || expectedRevision !== session.revision) {
      throw new StudioRequestError('BM_STUDIO_REVISION_CONFLICT', 'The document changed in another request; refresh before editing again', 409)
    }
    if (!request || typeof request !== 'object' || Array.isArray(request) || !OPERATIONS.has(request.operation)) {
      throw new StudioRequestError('BM_STUDIO_OPERATION_UNSUPPORTED', 'The requested editing operation is not supported')
    }
    const payload = request.payload
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new StudioRequestError('BM_STUDIO_REQUEST_PAYLOAD', 'An operation payload object is required')
    }
    const before = session.document.serialize()
    let result
    try {
      result = this.#apply(session.document, request.operation, payload)
    } catch (error) {
      if (error?.code && typeof error.code === 'string') {
        throw new StudioRequestError(error.code, error.message, error.code === 'BM_STUDIO_READ_ONLY' ? 409 : 422)
      }
      throw error
    }
    if (session.document.serialize() !== before) session.revision += 1
    return { ...snapshot(session), result: result ?? null }
  }

  #apply(document, operation, payload) {
    switch (operation) {
      case 'metadata.set':
        requiredString(payload.path, 'Metadata path', { allowEmpty: false })
        if (!Object.hasOwn(payload, 'value')) throw new StudioRequestError('BM_STUDIO_REQUEST_VALUE', 'A metadata value is required')
        document.setMetadata(payload.path, payload.value)
        return null
      case 'metadata.delete':
        requiredString(payload.path, 'Metadata path', { allowEmpty: false })
        document.deleteMetadata(payload.path)
        return null
      case 'screen.add': {
        const label = payload.label === null ? null : requiredString(payload.label, 'Screen label')
        const heading = payload.heading === null ? null : requiredString(payload.heading, 'Screen heading')
        const idHint = [label, heading].find(value => typeof value === 'string' && value.trim())
        if (!idHint) throw new StudioRequestError('BM_STUDIO_ID_HINT_REQUIRED', 'Enter a screen label or heading so Studio can create a stable semantic ID')
        return document.addScreen({ idHint, label, heading, blocks: [] }, optionalIndex(payload.index))
      }
      case 'screen.update': {
        requiredString(payload.id, 'Screen ID', { allowEmpty: false })
        const changes = {}
        for (const key of ['label', 'heading']) {
          if (!Object.hasOwn(payload, key)) continue
          changes[key] = payload[key] === null ? null : requiredString(payload[key], `Screen ${key}`)
        }
        if (!Object.keys(changes).length) throw new StudioRequestError('BM_STUDIO_REQUEST_VALUE', 'No screen changes were supplied')
        document.updateScreen(payload.id, changes)
        return null
      }
      case 'screen.move':
        requiredString(payload.id, 'Screen ID', { allowEmpty: false })
        document.moveScreen(payload.id, optionalIndex(payload.index))
        return null
      case 'screen.remove':
        requiredString(payload.id, 'Screen ID', { allowEmpty: false })
        document.removeScreen(payload.id)
        return null
      default:
        throw new StudioRequestError('BM_STUDIO_OPERATION_UNSUPPORTED', 'The requested editing operation is not supported')
    }
  }
}
