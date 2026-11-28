export class StudioApiError extends Error {
  constructor(code, message, status) {
    super(message)
    this.name = 'StudioApiError'
    this.code = code
    this.status = status
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response
  try {
    response = await fetch(path, {
      method,
      headers: {
        'X-BerryMark-Studio': '1',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store'
    })
  } catch {
    throw new StudioApiError('BM_STUDIO_SERVER_UNAVAILABLE', 'Studio’s local server is unavailable. Your working document remains open; restart the server before editing or saving again.', 0)
  }
  const result = await response.json()
  if (!response.ok) throw new StudioApiError(result.error?.code ?? 'BM_STUDIO_REQUEST_FAILED', result.error?.message ?? 'The local request failed', response.status)
  return result
}

export const studioApi = {
  open({ source, filename, reviewState }) {
    return request('/api/documents', { method: 'POST', body: { action: 'open', source, filename, reviewState } })
  },
  create({ filename }) {
    return request('/api/documents', { method: 'POST', body: { action: 'new', filename } })
  },
  get(id) {
    return request(`/api/documents/${id}`)
  },
  mutate(document, operation, payload) {
    return request(`/api/documents/${document.id}/operations`, {
      method: 'POST',
      body: { revision: document.revision, operation, payload }
    })
  },
  mutateGroup(document, operations) {
    return request(`/api/documents/${document.id}/operations`, {
      method: 'POST',
      body: { revision: document.revision, operations }
    })
  },
  serialize(document) {
    return request(`/api/documents/${document.id}/serialize`, { method: 'POST', body: { revision: document.revision } })
  }
}
