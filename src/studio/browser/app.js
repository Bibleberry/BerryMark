import { studioApi } from './api-client.js'
import { renderBlocks } from './block-view.js'
import { fileAccess, isPickerCancellation, meaningfulFileError } from './files.js'
import { recoverReviewCompanion, saveReviewBoundDocument } from './review-state-file.js'

const byId = id => document.getElementById(id)
const state = {
  document: null,
  selectedScreenId: null,
  savedDigest: null,
  manuscriptHandle: null,
  reviewHandle: null,
  reviewRecovery: null,
  hostDiagnostics: [],
  partialSave: null,
  metadataBaseline: null,
  metadataDraft: null,
  busy: false,
  screenDialogMode: null,
  saveDialog: null
}

function isDirty() {
  return Boolean(state.document && (state.savedDigest === null || state.document.sourceSha256 !== state.savedDigest))
}

function showNotice(message, kind = 'info') {
  byId('notice-text').textContent = message
  byId('notice').dataset.kind = kind
  byId('notice').hidden = false
}

function clearNotice() {
  byId('notice').hidden = true
  byId('notice-text').textContent = ''
}

function valueLabel(value) {
  if (value === undefined) return 'Missing'
  if (value === null) return 'Explicit null'
  if (value === '') return 'Empty authored value'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function screenName(screen) {
  return screen?.label || screen?.heading || 'Untitled screen'
}

function currentScreen() {
  return state.document?.screens.find(screen => screen.id === state.selectedScreenId) ?? state.document?.screens[0] ?? null
}

function confirmAction(message) {
  return globalThis.confirm(message)
}

function ensureDiscardAllowed() {
  if (state.metadataDraft) {
    return confirmAction('This document has unapplied document information. Continue and discard it and any unsaved changes? The last saved file will not be changed.')
  }
  return !isDirty() || confirmAction('This document has unsaved changes. Continue and discard those working changes? The last saved file will not be changed.')
}

function createButton(label, className, action, ariaLabel = label) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.textContent = label
  button.setAttribute('aria-label', ariaLabel)
  button.addEventListener('click', action)
  return button
}

function renderScreens() {
  const list = byId('screen-list')
  list.replaceChildren()
  const screens = state.document?.screens ?? []
  byId('screen-count').textContent = state.document
    ? `${screens.length} ordered ${screens.length === 1 ? 'screen' : 'screens'}`
    : 'Open or create a document to begin.'
  screens.forEach((screen, index) => {
    const item = document.createElement('li')
    item.className = 'screen-item'
    item.dataset.selected = String(screen.id === currentScreen()?.id)
    item.dataset.screenId = screen.id
    const select = createButton('', 'screen-select', () => {
      state.selectedScreenId = screen.id
      render()
    }, `Select ${screenName(screen)}`)
    const number = document.createElement('span')
    number.className = 'screen-number'
    number.textContent = String(index + 1).padStart(2, '0')
    const names = document.createElement('span')
    const primary = document.createElement('span')
    primary.className = 'screen-primary'
    primary.textContent = screenName(screen)
    const secondary = document.createElement('span')
    secondary.className = 'screen-secondary'
    secondary.textContent = `${screen.blocks.length} ${screen.blocks.length === 1 ? 'block' : 'blocks'}`
    names.append(primary, secondary)
    select.append(number, names)
    const controls = document.createElement('div')
    controls.className = 'screen-controls'
    controls.append(
      createButton('↑', '', () => moveScreen(screen.id, index - 1), `Move ${screenName(screen)} up`),
      createButton('↓', '', () => moveScreen(screen.id, index + 1), `Move ${screenName(screen)} down`),
      createButton('Edit', '', () => openScreenDialog('edit', screen), `Edit ${screenName(screen)}`),
      createButton('Remove', 'remove-screen', () => removeScreen(screen), `Remove ${screenName(screen)}`)
    )
    controls.children[0].disabled = state.busy || !state.document.editable || index === 0
    controls.children[1].disabled = state.busy || !state.document.editable || index === screens.length - 1
    controls.children[2].disabled = state.busy || !state.document.editable
    controls.children[3].disabled = state.busy || !state.document.editable
    item.append(select, controls)
    list.append(item)
  })
}

const metadataControls = ['challenge-title', 'challenge-slug', 'challenge-type', 'summary-state', 'challenge-summary']

function readMetadataForm() {
  return Object.fromEntries(metadataControls.map(id => [id, byId(id).value]))
}

function updateMetadataDraft() {
  const form = readMetadataForm()
  state.metadataDraft = metadataControls.some(id => form[id] !== state.metadataBaseline[id]) ? form : null
  byId('metadata-draft-note').hidden = !state.metadataDraft
}

function renderMetadata() {
  const metadata = state.document?.metadata
  const editable = Boolean(state.document?.editable && !state.busy)
  byId('metadata-form').hidden = !state.document
  byId('readonly-metadata').hidden = !state.document
  byId('metadata-intro').textContent = !state.document
    ? 'No manuscript is open.'
    : state.document.editable
      ? 'Required fields may remain incomplete while you compose. Optional values distinguish missing, null, and authored content.'
      : 'This manuscript is read-only because its structure is unsupported or unsafe for targeted editing.'
  if (!state.document) return
  byId('challenge-title').value = metadata?.challenge?.title ?? ''
  byId('challenge-slug').value = metadata?.challenge?.slug ?? ''
  byId('challenge-type').value = metadata?.challenge?.type ?? ''
  const summary = metadata?.challenge?.summary
  const summaryState = summary === undefined ? 'missing' : summary === null ? 'null' : 'authored'
  byId('summary-state').value = summaryState
  byId('challenge-summary').value = summary ?? ''
  state.metadataBaseline = readMetadataForm()
  if (state.metadataDraft) {
    for (const id of metadataControls) byId(id).value = state.metadataDraft[id]
  }
  updateMetadataDraft()
  updateSummaryState()
  for (const id of ['challenge-title', 'challenge-slug', 'challenge-type', 'summary-state', 'apply-metadata']) byId(id).disabled = !editable
  byId('challenge-summary').disabled = !editable || byId('summary-state').value !== 'authored'

  const values = byId('publishing-values')
  values.replaceChildren()
  const entries = [
    ['Release date', metadata?.publishing?.releaseAt],
    ['Approval status', metadata?.editorial?.approvalStatus],
    ['Approved by', metadata?.editorial?.approvedBy],
    ['Approved at', metadata?.editorial?.approvedAt],
    ['Scripture translation', metadata?.scripture?.translation],
    ['Scripture rights confirmed', metadata?.scripture?.usageRightsConfirmed]
  ]
  for (const [label, value] of entries) {
    const row = document.createElement('div')
    const term = document.createElement('dt')
    term.textContent = label
    const description = document.createElement('dd')
    description.textContent = valueLabel(value)
    if (value === undefined || value === null) description.className = 'value-missing'
    row.append(term, description)
    values.append(row)
  }
}

function updateSummaryState() {
  const value = byId('summary-state').value
  byId('challenge-summary').disabled = Boolean(state.busy || !state.document?.editable || value !== 'authored')
  byId('summary-state-description').textContent = value === 'authored'
    ? 'Authored text, including an intentionally empty string, is stored as a value.'
    : value === 'null'
      ? 'Explicit null records an intentional empty value; it is not the same as a missing key.'
      : 'Missing removes the optional summary key from front matter.'
}

function renderDiagnostics() {
  const engineDiagnostics = state.document?.diagnostics ?? []
  const diagnostics = [...state.hostDiagnostics, ...engineDiagnostics]
  byId('diagnostic-count').textContent = String(diagnostics.length)
  const list = byId('diagnostic-list')
  list.replaceChildren()
  for (const diagnostic of diagnostics) {
    const item = document.createElement('li')
    item.className = 'diagnostic-item'
    item.dataset.severity = diagnostic.severity ?? 'info'
    const heading = document.createElement('strong')
    heading.textContent = `${diagnostic.severity ?? 'info'} · ${diagnostic.code ?? 'Studio'}`
    const message = document.createElement('p')
    message.textContent = diagnostic.message
    item.append(heading, message)
    if (diagnostic.line) {
      const location = document.createElement('span')
      location.className = 'diagnostic-location'
      location.textContent = `Line ${diagnostic.line}${diagnostic.column ? `, column ${diagnostic.column}` : ''}`
      item.append(location)
    }
    list.append(item)
  }
  byId('no-diagnostics').hidden = diagnostics.length > 0
  byId('no-diagnostics').textContent = state.document ? 'No diagnostics. The working document is valid.' : 'No document diagnostics to display.'
  const recovery = byId('review-recovery')
  recovery.hidden = !state.reviewRecovery || state.reviewRecovery.status === 'matched'
  recovery.textContent = state.reviewRecovery?.message ?? ''
}

function render() {
  const document = state.document
  const selected = currentScreen()
  if (selected && state.selectedScreenId !== selected.id) state.selectedScreenId = selected.id
  byId('welcome-view').hidden = Boolean(document)
  byId('document-view').hidden = !document || !selected
  byId('no-screen-view').hidden = !document || Boolean(selected)
  byId('document-name').textContent = document?.filename ?? 'No document open'
  byId('unsaved-indicator').hidden = !isDirty()
  byId('save-button').disabled = !document || state.busy
  byId('save-as-button').disabled = !document || state.busy
  byId('new-button').disabled = state.busy
  byId('open-button').disabled = state.busy
  byId('add-screen-button').disabled = !document?.editable || state.busy
  byId('empty-add-screen').disabled = !document?.editable || state.busy
  byId('edit-screen-button').disabled = !document?.editable || state.busy
  const status = document?.status ?? 'empty'
  byId('validation-summary').dataset.status = status
  byId('validation-text').textContent = {
    empty: 'No document',
    valid: 'Valid working document',
    incomplete: 'Incomplete working document',
    unsupported: 'Unsupported · read-only'
  }[status]
  byId('validation-summary').querySelector('.status-symbol').textContent = { empty: '—', valid: '✓', incomplete: '!', unsupported: '×' }[status]

  renderScreens()
  if (document && selected) {
    const index = document.screens.indexOf(selected)
    byId('screen-position').textContent = `Screen ${index + 1} of ${document.screens.length} · ${selected.blocks.length} Content ${selected.blocks.length === 1 ? 'Block' : 'Blocks'}`
    byId('screen-heading').textContent = selected.heading || screenName(selected)
    byId('screen-label').textContent = selected.label ? `${selected.label} · ID ${selected.id}` : `ID ${selected.id}`
    byId('empty-screen').hidden = selected.blocks.length > 0
    renderBlocks(byId('block-list'), selected)
  } else {
    byId('block-list').replaceChildren()
  }
  renderMetadata()
  renderDiagnostics()
}

async function runBusy(action) {
  if (state.busy) return
  state.busy = true
  render()
  try {
    await action()
  } finally {
    state.busy = false
    render()
  }
}

function adoptDocument(document, {
  savedDigest = null,
  manuscriptHandle = null,
  reviewHandle = null,
  reviewRecovery = null,
  hostDiagnostics = [],
  metadataDraft = null
} = {}) {
  state.document = document
  state.selectedScreenId = document.screens[0]?.id ?? null
  state.savedDigest = savedDigest
  state.manuscriptHandle = manuscriptHandle
  state.reviewHandle = reviewHandle
  state.reviewRecovery = reviewRecovery
  state.hostDiagnostics = hostDiagnostics
  state.metadataDraft = metadataDraft
  state.partialSave = null
}

async function openDocument() {
  if (!ensureDiscardAllowed()) return
  let handles
  try {
    showNotice('In Chromium’s picker, select one .berry.md manuscript and, when available, its matching .berry.md.review.json companion together.')
    handles = await fileAccess.openManuscript()
  } catch (error) {
    if (!isPickerCancellation(error)) showNotice(meaningfulFileError(error), 'error')
    return
  }
  const manuscripts = (handles ?? []).filter(handle => handle.name.endsWith('.berry.md'))
  const companions = (handles ?? []).filter(handle => handle.name.endsWith('.json'))
  if (manuscripts.length !== 1 || companions.length > 1) {
    showNotice('Select exactly one .berry.md manuscript and no more than one JSON review companion. No document was replaced.', 'error')
    return
  }
  const manuscriptHandle = manuscripts[0]
  const reviewHandle = companions[0] ?? null
  await runBusy(async () => {
    try {
      const manuscript = await fileAccess.readHandle(manuscriptHandle)
      const reviewText = reviewHandle ? (await fileAccess.readHandle(reviewHandle)).text : null
      const recovery = recoverReviewCompanion(manuscript.sourceSha256, reviewText)
      const opened = await studioApi.open({
        source: manuscript.text,
        filename: manuscriptHandle.name,
        reviewState: recovery.reviewState ?? undefined
      })
      adoptDocument(opened, {
        savedDigest: manuscript.sourceSha256,
        manuscriptHandle,
        reviewHandle,
        reviewRecovery: recovery,
        hostDiagnostics: recovery.status === 'matched' ? [] : [{ severity: recovery.status.startsWith('recovered') ? 'warning' : 'info', code: 'BM_STUDIO_REVIEW_COMPANION', message: recovery.message }]
      })
      showNotice(recovery.status === 'matched' ? 'Manuscript and matching review history opened.' : 'Manuscript opened without changing its source.', recovery.status.startsWith('recovered') ? 'info' : 'success')
    } catch (error) {
      showNotice(meaningfulFileError(error), 'error')
    }
  })
}

function openNewDialog() {
  if (!ensureDiscardAllowed()) return
  byId('new-filename').value = 'untitled.berry.md'
  byId('new-title').value = ''
  byId('new-dialog').showModal()
  byId('new-filename').focus()
}

async function createDocument(event) {
  event.preventDefault()
  const filename = byId('new-filename').value.trim()
  const title = byId('new-title').value
  byId('new-dialog').close()
  await runBusy(async () => {
    try {
      let document = await studioApi.create({ filename })
      if (title) document = await studioApi.mutate(document, 'metadata.set', { path: 'challenge.title', value: title })
      adoptDocument(document)
      showNotice('New incomplete document created. Add a screen and save when you are ready.', 'success')
    } catch (error) {
      showNotice(meaningfulFileError(error), 'error')
    }
  })
}

function openScreenDialog(mode, screen = null) {
  if (!state.document?.editable) return
  state.screenDialogMode = { mode, id: screen?.id ?? null }
  byId('screen-dialog-title').textContent = mode === 'add' ? 'Add a screen' : 'Edit screen'
  byId('screen-dialog-submit').textContent = mode === 'add' ? 'Add screen' : 'Apply screen changes'
  byId('screen-label-input').value = screen?.label ?? ''
  byId('screen-heading-input').value = screen?.heading ?? ''
  byId('screen-id-note').textContent = mode === 'add'
    ? 'Studio generates and preserves the semantic ID. You never need to manage it.'
    : `Semantic ID · ${screen.id} · This identity will not change.`
  byId('screen-dialog').showModal()
  byId('screen-label-input').focus()
}

async function submitScreen(event) {
  event.preventDefault()
  const mode = state.screenDialogMode
  const label = byId('screen-label-input').value
  const headingText = byId('screen-heading-input').value
  if (!mode || !label.trim()) return
  byId('screen-dialog').close()
  await runBusy(async () => {
    try {
      const heading = headingText ? headingText : null
      const response = mode.mode === 'add'
        ? await studioApi.mutate(state.document, 'screen.add', { label, heading })
        : await studioApi.mutate(state.document, 'screen.update', { id: mode.id, label, heading })
      state.document = response
      state.selectedScreenId = mode.mode === 'add' ? response.result : mode.id
      state.hostDiagnostics = []
      showNotice(mode.mode === 'add' ? 'Screen added with a stable semantic ID.' : 'Screen label and heading updated; its semantic ID is unchanged.', 'success')
    } catch (error) {
      showNotice(meaningfulFileError(error), 'error')
    }
  })
}

async function moveScreen(id, index) {
  if (!state.document?.editable) return
  await runBusy(async () => {
    try {
      state.document = await studioApi.mutate(state.document, 'screen.move', { id, index })
      state.selectedScreenId = id
      showNotice('Screen order updated. Semantic IDs are unchanged.', 'success')
    } catch (error) {
      showNotice(meaningfulFileError(error), 'error')
    }
  })
}

async function removeScreen(screen) {
  if (!state.document?.editable) return
  if (!confirmAction(`Remove “${screenName(screen)}” and all of its Content Blocks from the working document?\n\nThis does not change the file until you save. Cancel keeps the screen.`)) return
  await runBusy(async () => {
    try {
      const oldIndex = state.document.screens.findIndex(item => item.id === screen.id)
      state.document = await studioApi.mutate(state.document, 'screen.remove', { id: screen.id })
      state.selectedScreenId = state.document.screens[Math.min(oldIndex, state.document.screens.length - 1)]?.id ?? null
      showNotice('Screen removed from the working document. Save to write the change.', 'success')
    } catch (error) {
      showNotice(meaningfulFileError(error), 'error')
    }
  })
}

async function applyMetadata(event) {
  event.preventDefault()
  if (!state.document?.editable || state.busy) return
  updateMetadataDraft()
  const form = readMetadataForm()
  const baseline = state.metadataBaseline
  const operations = []
  for (const field of ['title', 'slug', 'type']) {
    const id = `challenge-${field}`
    if (form[id] !== baseline[id]) {
      operations.push({ operation: 'metadata.set', payload: { path: `challenge.${field}`, value: form[id] } })
    }
  }
  const path = 'challenge.summary'
  const summaryState = form['summary-state']
  const summaryStateChanged = summaryState !== baseline['summary-state']
  if (summaryState === 'missing' && summaryStateChanged) {
    operations.push({ operation: 'metadata.delete', payload: { path } })
  } else if (summaryState === 'null' && summaryStateChanged) {
    operations.push({ operation: 'metadata.set', payload: { path, value: null } })
  } else if (summaryState === 'authored' && (summaryStateChanged || form['challenge-summary'] !== baseline['challenge-summary'])) {
    operations.push({ operation: 'metadata.set', payload: { path, value: form['challenge-summary'] } })
  }
  if (!operations.length) {
    if (state.metadataDraft) {
      state.metadataDraft = null
      renderMetadata()
    }
    showNotice('No document information changes to apply.')
    return
  }
  await runBusy(async () => {
    try {
      state.document = await studioApi.mutateGroup(state.document, operations)
      state.metadataDraft = null
      const count = operations.length
      showNotice(`Applied ${count} document information ${count === 1 ? 'change' : 'changes'}. Save to write them to the manuscript.`, 'success')
    } catch (error) {
      const outcome = error.status >= 400 && error.status < 500
        ? 'No document information changes were applied.'
        : 'Studio could not confirm whether the changes were applied.'
      showNotice(`${outcome} Your inputs are still in the form. ${meaningfulFileError(error)}`, 'error')
    }
  })
}

function updateSaveDialog() {
  const selection = state.saveDialog
  byId('save-manuscript-name').textContent = selection?.manuscriptHandle?.name ?? 'Not selected'
  byId('save-review-name').textContent = selection?.reviewHandle?.name ?? 'Not selected'
  byId('confirm-save-destinations').disabled = !selection?.manuscriptHandle || !selection?.reviewHandle
  byId('save-dialog-title').textContent = selection?.saveAs ? 'Save As — choose destinations' : 'Choose a review companion'
}

function openSaveDialog(saveAs) {
  state.saveDialog = {
    saveAs,
    manuscriptHandle: saveAs ? null : state.manuscriptHandle,
    reviewHandle: saveAs ? null : state.reviewHandle
  }
  updateSaveDialog()
  byId('save-dialog').showModal()
}

async function chooseSaveManuscript() {
  if (!state.saveDialog) return
  try {
    const handle = await fileAccess.saveManuscript(state.document.filename || 'untitled.berry.md')
    if (!handle?.name.endsWith('.berry.md')) throw new Error('Choose a filename ending in .berry.md so the authored product remains a BerryMark manuscript.')
    state.saveDialog.manuscriptHandle = handle
    updateSaveDialog()
  } catch (error) {
    if (!isPickerCancellation(error)) showNotice(meaningfulFileError(error), 'error')
  }
}

async function chooseSaveReview() {
  if (!state.saveDialog) return
  try {
    const manuscriptName = state.saveDialog.manuscriptHandle?.name ?? state.document.filename
    state.saveDialog.reviewHandle = await fileAccess.saveReviewCompanion(manuscriptName)
    updateSaveDialog()
  } catch (error) {
    if (!isPickerCancellation(error)) showNotice(meaningfulFileError(error), 'error')
  }
}

async function submitSaveDestinations(event) {
  event.preventDefault()
  const selection = state.saveDialog
  if (!selection?.manuscriptHandle || !selection?.reviewHandle) return
  byId('save-dialog').close()
  await saveDocument(selection.saveAs, {
    manuscriptHandle: selection.manuscriptHandle,
    reviewHandle: selection.reviewHandle
  })
}

async function saveDocument(saveAsRequested = false, destinations = null) {
  if (!state.document || state.busy) return
  const saveAs = saveAsRequested || !state.manuscriptHandle
  if (!destinations && (saveAs || !state.reviewHandle)) {
    openSaveDialog(saveAs)
    return
  }
  await runBusy(async () => {
    const manuscriptHandle = destinations?.manuscriptHandle ?? state.manuscriptHandle
    const reviewHandle = destinations?.reviewHandle ?? state.reviewHandle
    let serialized = null
    try {
      if (!manuscriptHandle?.name.endsWith('.berry.md')) throw new Error('Choose a filename ending in .berry.md so the authored product remains a BerryMark manuscript.')
      if (!reviewHandle) throw new Error('Choose a review companion destination before saving. No manuscript write has occurred.')
      await Promise.all([
        fileAccess.ensureReadWrite(manuscriptHandle),
        fileAccess.ensureReadWrite(reviewHandle)
      ])

      if (saveAs) {
        const manuscriptExists = await fileAccess.hasExistingContent(manuscriptHandle)
        const reviewExists = await fileAccess.hasExistingContent(reviewHandle)
        if ((manuscriptExists || reviewExists) && !confirmAction('The selected destination already contains data. Replace the selected manuscript and/or review companion with this working document?')) return
      } else {
        await fileAccess.assertUnchanged(manuscriptHandle, [state.savedDigest, state.partialSave?.targetSha256])
      }

      const resetConfirmed = !saveAs && state.reviewRecovery?.requiresResetConfirmation
        ? confirmAction('The current review companion is missing, malformed, or mismatched. Replace it with review state for this manuscript?\n\nThe manuscript source is preserved. Cancel stops the entire save.')
        : false
      if (!saveAs && state.reviewRecovery?.requiresResetConfirmation && !resetConfirmed) return

      serialized = await studioApi.serialize(state.document)
      const store = fileAccess.createStore(manuscriptHandle, reviewHandle)
      await saveReviewBoundDocument({
        store,
        source: serialized.source,
        sourceSha256: serialized.sourceSha256,
        reviewState: serialized.reviewState,
        previousSourceSha256: state.savedDigest,
        manuscriptName: manuscriptHandle.name,
        allowCompanionReset: saveAs || resetConfirmed,
        onPhase: phase => {
          if (phase !== 'complete') showNotice(`Saving · ${phase.replaceAll('-', ' ')}…`)
        }
      })

      const manuscriptReadback = await fileAccess.readHandle(manuscriptHandle)
      if (manuscriptReadback.sourceSha256 !== serialized.sourceSha256) throw new Error('The manuscript read-back did not match the engine output. Studio is keeping the document marked unsaved.')
      const reviewReadback = recoverReviewCompanion(serialized.sourceSha256, (await fileAccess.readHandle(reviewHandle)).text)
      if (reviewReadback.status !== 'matched') throw new Error('The review companion read-back was not finalized. Studio is keeping the document marked unsaved.')
      const reopened = await studioApi.open({
        source: serialized.source,
        filename: manuscriptHandle.name,
        reviewState: serialized.reviewState
      })
      adoptDocument(reopened, {
        savedDigest: serialized.sourceSha256,
        manuscriptHandle,
        reviewHandle,
        reviewRecovery: reviewReadback,
        metadataDraft: state.metadataDraft
      })
      showNotice('Saved the manuscript and finalized its matching review companion. Read-back verification passed.', 'success')
    } catch (error) {
      if (!saveAs && serialized && error?.phase) state.partialSave = { phase: error.phase, targetSha256: serialized.sourceSha256 }
      if (isPickerCancellation(error)) showNotice('File selection was cancelled. The working document and its unsaved changes are still open.')
      else showNotice(meaningfulFileError(error), 'error')
    }
  })
}

byId('new-button').addEventListener('click', openNewDialog)
byId('welcome-new').addEventListener('click', openNewDialog)
byId('open-button').addEventListener('click', openDocument)
byId('welcome-open').addEventListener('click', openDocument)
byId('save-button').addEventListener('click', () => saveDocument(false))
byId('save-as-button').addEventListener('click', () => saveDocument(true))
byId('new-form').addEventListener('submit', createDocument)
byId('screen-form').addEventListener('submit', submitScreen)
byId('save-form').addEventListener('submit', submitSaveDestinations)
byId('choose-save-manuscript').addEventListener('click', chooseSaveManuscript)
byId('choose-save-review').addEventListener('click', chooseSaveReview)
byId('metadata-form').addEventListener('submit', applyMetadata)
byId('metadata-form').addEventListener('input', updateMetadataDraft)
byId('summary-state').addEventListener('change', () => {
  updateSummaryState()
  updateMetadataDraft()
})
byId('add-screen-button').addEventListener('click', () => openScreenDialog('add'))
byId('empty-add-screen').addEventListener('click', () => openScreenDialog('add'))
byId('edit-screen-button').addEventListener('click', () => openScreenDialog('edit', currentScreen()))
byId('dismiss-notice').addEventListener('click', clearNotice)
for (const button of document.querySelectorAll('[data-close-dialog]')) {
  button.addEventListener('click', () => byId(button.dataset.closeDialog).close())
}

globalThis.addEventListener('beforeunload', event => {
  if (!isDirty() && !state.metadataDraft) return
  event.preventDefault()
  event.returnValue = ''
})
globalThis.addEventListener('keydown', event => {
  if (!(event.ctrlKey || event.metaKey)) return
  const key = event.key.toLowerCase()
  if (key === 's') {
    event.preventDefault()
    saveDocument(event.shiftKey)
  } else if (key === 'o') {
    event.preventDefault()
    openDocument()
  }
})

render()
