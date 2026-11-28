// Installed before application code. These handles emulate Chromium picker and
// permission behavior in memory; real filesystem interruption coverage lives in
// test/studio-review-state-file.test.js.
export function installMemoryFileHarness() {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
  const files = new Map()
  const queue = {}

  class MemoryFileHandle {
    constructor(name) {
      this.kind = 'file'
      this.name = name
      this.bytes = new Uint8Array()
      this.permissionState = 'granted'
      this.failWrites = 0
      this.missing = false
      this.lastModified = Date.now()
    }

    async getFile() {
      if (this.missing) throw new DOMException('Injected missing file', 'NotFoundError')
      return new File([this.bytes], this.name, { lastModified: this.lastModified })
    }

    async queryPermission() {
      return this.permissionState
    }

    async requestPermission() {
      return this.permissionState === 'prompt' ? 'denied' : this.permissionState
    }

    async createWritable() {
      let pending = null
      return {
        write: async value => {
          pending = typeof value === 'string'
            ? encoder.encode(value)
            : new Uint8Array(await new Blob([value]).arrayBuffer())
        },
        close: async () => {
          if (this.failWrites > 0) {
            this.failWrites -= 1
            throw new DOMException('Injected interrupted write', 'QuotaExceededError')
          }
          this.bytes = pending ?? new Uint8Array()
          this.lastModified = Date.now()
        },
        abort: async () => {
          pending = null
        }
      }
    }
  }

  function ensure(name) {
    if (!files.has(name)) files.set(name, new MemoryFileHandle(name))
    return files.get(name)
  }

  function selected(entry, suggestedName) {
    if (entry?.cancel) throw new DOMException('Picker cancelled by test', 'AbortError')
    return ensure(entry?.name ?? suggestedName)
  }

  const api = {
    set(name, contents = '') {
      const handle = ensure(name)
      handle.bytes = typeof contents === 'string' ? encoder.encode(contents) : new Uint8Array(contents)
      handle.missing = false
      return name
    },
    text(name) {
      return decoder.decode(files.get(name).bytes)
    },
    bytes(name) {
      return Array.from(files.get(name).bytes)
    },
    nextOpen(names) {
      queue.open = { names }
    },
    cancelNextOpen() {
      queue.open = { cancel: true }
    },
    nextSave(manuscriptName, reviewName) {
      queue.saveManuscript = manuscriptName === null ? { cancel: true } : { name: manuscriptName }
      queue.saveReviewCompanion = reviewName === null ? { cancel: true } : { name: reviewName }
    },
    failNextWrite(name) {
      files.get(name).failWrites += 1
    },
    permission(name, value) {
      files.get(name).permissionState = value
    },
    has(name) {
      return files.has(name)
    }
  }

  globalThis.__berryMarkTestFiles = api
  globalThis.__BERRYMARK_STUDIO_PICKERS__ = {
    async openManuscript() {
      const entry = queue.open
      queue.open = null
      if (!entry || entry.cancel) throw new DOMException('Picker cancelled by test', 'AbortError')
      return entry.names.map(name => ensure(name))
    },
    async saveManuscript(suggestedName) {
      const entry = queue.saveManuscript
      queue.saveManuscript = null
      return selected(entry, suggestedName)
    },
    async saveReviewCompanion(suggestedName) {
      const entry = queue.saveReviewCompanion
      queue.saveReviewCompanion = null
      return selected(entry, suggestedName)
    }
  }
}
