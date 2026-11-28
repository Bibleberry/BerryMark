import { companionFilename } from './review-state-file.js'

export class StudioFileError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'StudioFileError'
    this.code = code
  }
}

function hex(buffer) {
  return [...new Uint8Array(buffer)].map(value => value.toString(16).padStart(2, '0')).join('')
}

export async function sha256Buffer(buffer) {
  return hex(await globalThis.crypto.subtle.digest('SHA-256', buffer))
}

export async function sha256Text(text) {
  return sha256Buffer(new TextEncoder().encode(text))
}

export function isPickerCancellation(error) {
  return error?.name === 'AbortError'
}

function pickerOverride(name) {
  return globalThis.__BERRYMARK_STUDIO_PICKERS__?.[name]
}

async function readHandle(handle) {
  const file = await handle.getFile()
  const buffer = await file.arrayBuffer()
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer)
  } catch {
    throw new StudioFileError('BM_STUDIO_FILE_ENCODING', 'This manuscript is not valid UTF-8. Studio preserved the file and did not attempt to repair its encoding.')
  }
  return {
    file,
    text,
    sourceSha256: await sha256Buffer(buffer),
    size: file.size,
    lastModified: file.lastModified
  }
}

export const fileAccess = {
  async openManuscript() {
    const override = pickerOverride('openManuscript')
    if (override) return override()
    if (!globalThis.showOpenFilePicker) {
      throw new StudioFileError('BM_STUDIO_FILE_API_UNAVAILABLE', 'This browser does not provide Chromium’s File System Access API. Use a current Chrome or Chromium release on macOS or Arch Linux.')
    }
    const handles = await globalThis.showOpenFilePicker({
      multiple: true,
      types: [{ description: 'BerryMark manuscript and optional review companion', accept: { 'text/markdown': ['.berry.md'], 'application/json': ['.json'] } }]
    })
    return handles
  },

    async saveManuscript(suggestedName) {
    const override = pickerOverride('saveManuscript')
    if (override) return override(suggestedName)
    if (!globalThis.showSaveFilePicker) {
      throw new StudioFileError('BM_STUDIO_FILE_API_UNAVAILABLE', 'This browser cannot directly save local manuscripts. Use a current Chrome or Chromium release.')
    }
    return globalThis.showSaveFilePicker({
      suggestedName,
      types: [{ description: 'BerryMark manuscript', accept: { 'text/markdown': ['.berry.md'] } }]
    })
  },

  async saveReviewCompanion(manuscriptName) {
    const suggestedName = companionFilename(manuscriptName)
    const override = pickerOverride('saveReviewCompanion')
    if (override) return override(suggestedName)
    if (!globalThis.showSaveFilePicker) throw new StudioFileError('BM_STUDIO_FILE_API_UNAVAILABLE', 'Chromium’s File System Access API is unavailable.')
    return globalThis.showSaveFilePicker({
      suggestedName,
      types: [{ description: 'BerryMark review companion', accept: { 'application/json': ['.json'] } }]
    })
  },

  readHandle,

  async ensureReadWrite(handle) {
    if (!handle) throw new StudioFileError('BM_STUDIO_FILE_HANDLE_MISSING', 'Choose a file destination before saving.')
    if (!handle.queryPermission || !handle.requestPermission) return true
    const options = { mode: 'readwrite' }
    let permission = await handle.queryPermission(options)
    if (permission === 'prompt') permission = await handle.requestPermission(options)
    if (permission !== 'granted') {
      throw new StudioFileError('BM_STUDIO_FILE_PERMISSION', 'Chrome or Chromium did not grant read/write permission. Your changes remain unsaved; choose the file again or use Save As.')
    }
    return true
  },

  async assertUnchanged(handle, acceptedDigests) {
    const current = await readHandle(handle)
    if (!acceptedDigests.filter(Boolean).includes(current.sourceSha256)) {
      throw new StudioFileError('BM_STUDIO_FILE_EXTERNAL_CHANGE', 'The working file changed outside Studio or is missing its expected content. Studio did not overwrite it. Reload the external version or use Save As.')
    }
    return current
  },

  async hasExistingContent(handle) {
    try {
      const file = await handle.getFile()
      return file.size > 0
    } catch (error) {
      if (error?.name === 'NotFoundError') return false
      throw error
    }
  },

  async writeText(handle, text) {
    let writable
    try {
      writable = await handle.createWritable()
      await writable.write(text)
      await writable.close()
    } catch (error) {
      if (writable?.abort) {
        try { await writable.abort() } catch { /* Preserve the original write failure. */ }
      }
      throw error
    }
  },

  createStore(manuscriptHandle, reviewHandle) {
    return {
      async readReviewState() {
        if (!reviewHandle) return null
        return (await readHandle(reviewHandle)).text
      },
      async writeReviewState(text) {
        await fileAccess.writeText(reviewHandle, text)
      },
      async writeManuscript(text) {
        await fileAccess.writeText(manuscriptHandle, text)
      }
    }
  }
}

export function meaningfulFileError(error) {
  if (error?.code?.startsWith?.('BM_STUDIO_')) return error.message
  if (error?.name === 'NotFoundError') return 'The file is missing or was moved. Studio did not report a save. Use Save As to choose a new destination; your changes remain open.'
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'File permission was denied or revoked. Your changes remain unsaved. Grant access explicitly or choose another destination with Save As.'
  return error?.message || 'The file operation failed. Your working document remains open and unsaved.'
}
