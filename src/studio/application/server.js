import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { StudioDocumentSessions, StudioRequestError } from './document-sessions.js'

const DEFAULT_PORT = 4173
const BODY_LIMIT = 5 * 1024 * 1024
const STATIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/api-client.js', ['api-client.js', 'text/javascript; charset=utf-8']],
  ['/block-view.js', ['block-view.js', 'text/javascript; charset=utf-8']],
  ['/files.js', ['files.js', 'text/javascript; charset=utf-8']],
  ['/review-state-file.js', ['review-state-file.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']]
])

function securityHeaders(contentType) {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff'
  }
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value)
  response.writeHead(status, { ...securityHeaders('application/json; charset=utf-8'), 'Content-Length': Buffer.byteLength(body) })
  response.end(body)
}

function sendError(response, error) {
  const status = Number.isInteger(error?.status) ? error.status : 500
  const code = typeof error?.code === 'string' ? error.code : 'BM_STUDIO_INTERNAL'
  const message = status === 500 ? 'Studio could not complete the request; no manuscript change was confirmed' : error.message
  sendJson(response, status, { error: { code, message } })
}

function localOrigins(request, server) {
  const port = server.address()?.port
  const origins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`])
  return {
    hosts: new Set([`127.0.0.1:${port}`, `localhost:${port}`]),
    origins
  }
}

function authorize(request, server) {
  const { hosts, origins } = localOrigins(request, server)
  if (!hosts.has(request.headers.host)) {
    throw new StudioRequestError('BM_STUDIO_HOST_REJECTED', 'Studio accepts requests only from its loopback address', 403)
  }
  if (request.url.startsWith('/api/')) {
    if (request.headers['x-berrymark-studio'] !== '1') {
      throw new StudioRequestError('BM_STUDIO_ORIGIN_REJECTED', 'The request did not come from the Studio application', 403)
    }
    const fetchSite = request.headers['sec-fetch-site']
    if (fetchSite && fetchSite !== 'same-origin') {
      throw new StudioRequestError('BM_STUDIO_ORIGIN_REJECTED', 'Cross-origin application requests are not allowed', 403)
    }
    if (request.headers.origin && !origins.has(request.headers.origin)) {
      throw new StudioRequestError('BM_STUDIO_ORIGIN_REJECTED', 'Cross-origin application requests are not allowed', 403)
    }
  }
}

async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) {
    throw new StudioRequestError('BM_STUDIO_CONTENT_TYPE', 'JSON application content is required', 415)
  }
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > BODY_LIMIT) throw new StudioRequestError('BM_STUDIO_BODY_LIMIT', 'The manuscript exceeds Studio’s 5 MiB request limit', 413)
    chunks.push(chunk)
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object required')
    return value
  } catch {
    throw new StudioRequestError('BM_STUDIO_JSON_INVALID', 'The request body is not a valid JSON object')
  }
}

async function staticFile(url, browserDirectory) {
  const entry = STATIC_FILES.get(url)
  if (!entry) return null
  const [filename, contentType] = entry
  const contents = await readFile(new URL(`../browser/${filename}`, browserDirectory))
  return { contents, contentType }
}

export function createStudioServer({
  sessions = new StudioDocumentSessions(),
  browserDirectory = new URL('./', import.meta.url),
  staticReader = staticFile
} = {}) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://studio.invalid')
      if (!['/api/documents', '/api/health'].includes(url.pathname) && !STATIC_FILES.has(url.pathname) && !/^\/api\/documents\/[a-f0-9-]+(?:\/(?:operations|serialize))?$/.test(url.pathname)) {
        throw new StudioRequestError('BM_STUDIO_NOT_FOUND', 'Not found', 404)
      }
      authorize(request, server)
      if (url.pathname === '/api/health' && request.method === 'GET') {
        sendJson(response, 200, { application: 'BerryMark Studio', build: '02', ok: true })
        return
      }
      if (url.pathname === '/api/documents' && request.method === 'POST') {
        const body = await readJson(request)
        const snapshot = body.action === 'new'
          ? sessions.createNew(body)
          : body.action === 'open' ? sessions.create(body) : (() => { throw new StudioRequestError('BM_STUDIO_ACTION_UNSUPPORTED', 'Document action must be new or open') })()
        sendJson(response, 201, snapshot)
        return
      }
      const match = url.pathname.match(/^\/api\/documents\/([a-f0-9-]+)(?:\/(operations|serialize))?$/)
      if (match) {
        const [, id, action] = match
        if (!action && request.method === 'GET') {
          sendJson(response, 200, sessions.get(id))
          return
        }
        if (action === 'operations' && request.method === 'POST') {
          const body = await readJson(request)
          sendJson(response, 200, sessions.mutate(id, body.revision, body))
          return
        }
        if (action === 'serialize' && request.method === 'POST') {
          await readJson(request)
          sendJson(response, 200, sessions.serialize(id))
          return
        }
        throw new StudioRequestError('BM_STUDIO_METHOD', 'Method not allowed', 405)
      }
      if (url.pathname.startsWith('/api/')) throw new StudioRequestError('BM_STUDIO_NOT_FOUND', 'Not found', 404)
      if (request.method !== 'GET' && request.method !== 'HEAD') throw new StudioRequestError('BM_STUDIO_METHOD', 'Method not allowed', 405)
      const asset = await staticReader(url.pathname, browserDirectory)
      if (!asset) throw new StudioRequestError('BM_STUDIO_NOT_FOUND', 'Not found', 404)
      response.writeHead(200, { ...securityHeaders(asset.contentType), 'Content-Length': asset.contents.length })
      response.end(request.method === 'HEAD' ? undefined : asset.contents)
    } catch (error) {
      sendError(response, error)
    }
  })
  return server
}

export async function listenStudio(server, { host = '127.0.0.1', port = DEFAULT_PORT } = {}) {
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new StudioRequestError('BM_STUDIO_HOST_UNSAFE', 'Studio must bind to a loopback address')
  }
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new StudioRequestError('BM_STUDIO_PORT_INVALID', 'Port must be an integer from 0 to 65535')
  }
  await new Promise((resolve, reject) => {
    const onError = error => reject(error)
    server.once('error', onError)
    server.listen(port, host, () => {
      server.off('error', onError)
      resolve()
    })
  })
  return server.address()
}
