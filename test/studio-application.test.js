import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createStudioServer, listenStudio } from '../src/studio/application/server.js'

const fixture = readFileSync(new URL('../examples/compiler-all-blocks.berry.md', import.meta.url), 'utf8')

async function harness(run) {
  const server = createStudioServer()
  const { port } = await listenStudio(server, { port: 0 })
  const origin = `http://127.0.0.1:${port}`
  const request = async (path, { method = 'GET', body, headers = {} } = {}) => {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: {
        'X-BerryMark-Studio': '1',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    return { status: response.status, body: await response.json() }
  }
  try {
    await run({ request, origin, server })
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

async function createDocument(request, action = 'open') {
  const response = await request('/api/documents', {
    method: 'POST',
    body: action === 'new'
      ? { action, filename: 'untitled.berry.md' }
      : { action, filename: 'fixture.berry.md', source: fixture }
  })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return response.body
}

async function mutate(request, document, operation, payload, revision = document.revision) {
  return request(`/api/documents/${document.id}/operations`, {
    method: 'POST',
    body: { revision, operation, payload }
  })
}

test('local startup exposes only a loopback health endpoint and creates an incomplete new document without invented metadata', async () => {
  await harness(async ({ request }) => {
    const health = await request('/api/health')
    assert.equal(health.status, 200)
    assert.equal(health.body.ok, true)
    const document = await createDocument(request, 'new')
    assert.equal(document.status, 'incomplete')
    assert.deepEqual(document.screens, [])
    assert.equal(document.metadata.berrymark, '0.1')
    assert.equal(document.metadata.challenge.title, '')
    assert.equal(document.metadata.editorial, undefined)
    assert.equal(document.metadata.publishing, undefined)
  })
})

test('opening and serializing an unchanged manuscript preserves exact source and review state', async () => {
  await harness(async ({ request }) => {
    const document = await createDocument(request)
    assert.equal(document.status, 'valid')
    const saved = await request(`/api/documents/${document.id}/serialize`, { method: 'POST', body: {} })
    assert.equal(saved.status, 200)
    assert.equal(saved.body.source, fixture)
    assert.equal(saved.body.sourceSha256, document.sourceSha256)
    assert.equal(JSON.parse(saved.body.reviewState).approvalStale, false)
  })
})

test('metadata editing and complete screen management use the engine and preserve stable semantic IDs', async () => {
  await harness(async ({ request }) => {
    let document = await createDocument(request)
    let response = await mutate(request, document, 'metadata.set', { path: 'challenge.title', value: 'Revised in Studio' })
    assert.equal(response.status, 200, JSON.stringify(response.body))
    document = response.body
    assert.equal(document.metadata.challenge.title, 'Revised in Studio')

    response = await mutate(request, document, 'screen.add', { label: 'Response', heading: 'Consider the teaching' })
    document = response.body
    const addedId = response.body.result
    assert.equal(addedId, 'response')
    assert.equal(document.screens.at(-1).id, addedId)

    response = await mutate(request, document, 'screen.update', { id: addedId, label: 'Reflection', heading: 'A revised heading' })
    document = response.body
     assert.equal(document.screens.at(-1).label, 'Reflection')
    assert.equal(document.screens.at(-1).id, addedId)

    response = await mutate(request, document, 'screen.move', { id: addedId, index: 0 })
    document = response.body
    assert.deepEqual(document.screens.map(screen => screen.id), [addedId, 'compiler-fixture-screen'])

    response = await mutate(request, document, 'screen.remove', { id: addedId })
    document = response.body
    assert.deepEqual(document.screens.map(screen => screen.id), ['compiler-fixture-screen'])
    const saved = await request(`/api/documents/${document.id}/serialize`, { method: 'POST', body: {} })
    assert.ok(saved.body.source.includes('title: "Revised in Studio"'))
    assert.ok(saved.body.source.includes('[[CB1 id=compiler-rich-teaching]]'))
  })
})

test('revision conflicts and failed mutations cannot silently overwrite or partially change document state', async () => {
  await harness(async ({ request }) => {
    const document = await createDocument(request)
    const conflict = await mutate(request, document, 'metadata.set', { path: 'challenge.title', value: 'Conflict' }, -1)
    assert.equal(conflict.status, 409)
    assert.equal(conflict.body.error.code, 'BM_STUDIO_REVISION_CONFLICT')
    const failed = await mutate(request, document, 'screen.update', { id: 'compiler-fixture-screen', label: 42 })
    assert.equal(failed.status, 422)
    const current = await request(`/api/documents/${document.id}`)
    assert.equal(current.body.sourceSha256, document.sourceSha256)
    assert.equal(current.body.revision, document.revision)
  })
})

test('document sessions are isolated from one another', async () => {
  await harness(async ({ request }) => {
    const first = await createDocument(request)
    const second = await createDocument(request)
    assert.notEqual(first.id, second.id)
    const changed = await mutate(request, first, 'metadata.set', { path: 'challenge.title', value: 'First only' })
    assert.equal(changed.status, 200)
    const other = await request(`/api/documents/${second.id}`)
    assert.equal(other.body.metadata.challenge.title, 'BM-TEST Complete Compiler Fixture')
    assert.equal(other.body.sourceSha256, second.sourceSha256)
  })
})

test('unsupported documents remain read-only and recoverable with meaningful diagnostics', async () => {
  await harness(async ({ request }) => {
    const source = 'not a BerryMark document\n'
    const opened = await request('/api/documents', { method: 'POST', body: { action: 'open', filename: 'broken.berry.md', source } })
    assert.equal(opened.status, 201)
    const document = opened.body
    assert.equal(document.status, 'unsupported')
    assert.ok(document.diagnostics.length > 0)
    const edit = await mutate(request, document, 'metadata.set', { path: 'challenge.title', value: 'Not allowed' })
    assert.equal(edit.status, 409)
    assert.equal(edit.body.error.code, 'BM_STUDIO_READ_ONLY')
    const saved = await request(`/api/documents/${document.id}/serialize`, { method: 'POST', body: {} })
    assert.equal(saved.body.source, source)
  })
})

test('inappropriate filesystem routes, unknown APIs, cross-origin requests, and missing application headers are rejected', async () => {
  await harness(async ({ request }) => {
    for (const path of ['/etc/passwd', '/api/files', '/api/documents/../../etc/passwd', '/%2e%2e/%2e%2e/etc/passwd']) {
      const response = await request(path)
      assert.equal(response.status, 404, path)
    }
     const crossOrigin = await request('/api/documents', {
      method: 'POST',
      headers: { Origin: 'https://attacker.invalid', 'Sec-Fetch-Site': 'cross-site' },
      body: { action: 'new' }
    })
    assert.equal(crossOrigin.status, 403)
    assert.equal(crossOrigin.body.error.code, 'BM_STUDIO_ORIGIN_REJECTED')
  })
})

test('API access requires the application header and JSON mutation content type', async () => {
  await harness(async ({ request, origin }) => {
    const missing = await fetch(`${origin}/api/health`)
    assert.equal(missing.status, 403)
    const wrongType = await fetch(`${origin}/api/documents`, {
      method: 'POST',
      headers: { 'X-BerryMark-Studio': '1', 'Content-Type': 'text/plain' },
      body: '{}'
    })
    assert.equal(wrongType.status, 415)
  })
})

test('malformed or mismatched engine review state is rejected without replacing manuscript source', async () => {
  await harness(async ({ request }) => {
    for (const reviewState of ['not json', JSON.stringify({ version: 'berrymark-studio-review-v1', sourceSha256: '0'.repeat(64), approvalStale: true })]) {
      const response = await request('/api/documents', { method: 'POST', body: { action: 'open', filename: 'fixture.berry.md', source: fixture, reviewState } })
      assert.equal(response.status, 422)
      assert.match(response.body.error.code, /BM_STUDIO_REVIEW_STATE_(INVALID|MISMATCH)/)
    }
  })
})
