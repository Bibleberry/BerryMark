import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test as base, expect } from '@playwright/test'
import { installMemoryFileHarness } from './memory-file-harness.js'

const fixtureSource = await readFile(new URL('../examples/compiler-all-blocks.berry.md', import.meta.url), 'utf8')
const blockTypes = ['CB1', 'CB2', 'CB3', 'CB4', 'CB5', 'CB6', 'CB7', 'CB8', 'CB9']

const test = base.extend({
  page: async ({ page }, use) => {
    const runtimeErrors = []
    const failedRequests = []
    page.on('pageerror', error => runtimeErrors.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error') runtimeErrors.push(message.text())
    })
    page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()}`))
    await use(page)
    expect(runtimeErrors, 'browser runtime and console errors').toEqual([])
    expect(failedRequests, 'failed browser requests').toEqual([])
  }
})

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installMemoryFileHarness)
  await page.goto('/')
  await expect(page.locator('#document-name')).toHaveText('No document open')
})

async function openFiles(page, source, {
  manuscriptName = 'working.berry.md',
  companionName = null,
  companionText = null,
  acceptDiscard = false
} = {}) {
  await page.evaluate(({ source, manuscriptName, companionName, companionText }) => {
    const files = globalThis.__berryMarkTestFiles
    files.set(manuscriptName, source)
    const names = [manuscriptName]
    if (companionName) {
      files.set(companionName, companionText ?? '')
      names.push(companionName)
    }
    files.nextOpen(names)
  }, { source, manuscriptName, companionName, companionText })
  if (acceptDiscard) page.once('dialog', dialog => dialog.accept())
  await page.locator('#open-button').click()
  await expect(page.locator('#document-name')).toHaveText(manuscriptName)
}

async function createDocument(page, title = 'Working draft', filename = 'untitled.berry.md') {
  await page.locator('#new-button').click()
  await page.locator('#new-filename').fill(filename)
  await page.locator('#new-title').fill(title)
  await page.locator('#new-form button[type="submit"]').click()
  await expect(page.locator('#document-name')).toHaveText(filename)
  await expect(page.locator('#unsaved-indicator')).toBeVisible()
}

async function saveAs(page, manuscriptName, reviewName) {
  await page.evaluate(({ manuscriptName, reviewName }) => {
    globalThis.__berryMarkTestFiles.nextSave(manuscriptName, reviewName)
  }, { manuscriptName, reviewName })
  await page.locator('#save-as-button').click()
  await expect(page.locator('#save-dialog')).toBeVisible()
  await page.locator('#choose-save-manuscript').click()
  await expect(page.locator('#save-manuscript-name')).toHaveText(manuscriptName)
  await page.locator('#choose-save-review').click()
  await expect(page.locator('#save-review-name')).toHaveText(reviewName)
  await page.locator('#confirm-save-destinations').click()
  await expect(page.locator('#notice-text')).toContainText('Read-back verification passed')
  await expect(page.locator('#unsaved-indicator')).toBeHidden()
}

async function applyTitle(page, title) {
  await page.locator('#challenge-title').fill(title)
  await page.locator('#apply-metadata').click()
  await expect(page.locator('#notice-text')).toContainText('Applied 1 document information change')
}

async function addScreen(page, label, heading = '') {
  await page.locator('#add-screen-button').click()
  await page.locator('#screen-label-input').fill(label)
  await page.locator('#screen-heading-input').fill(heading)
  await page.locator('#screen-dialog-submit').click()
  await expect(page.locator('#screen-heading')).toHaveText(heading || label)
}

async function fileText(page, name) {
  return page.evaluate(name => globalThis.__berryMarkTestFiles.text(name), name)
}

test('open, inspect all blocks, edit, organize, save, and reopen with digest-bound review state', async ({ page }) => {
  await openFiles(page, fixtureSource)
  await expect(page.locator('#validation-text')).toHaveText('Valid working document')
  await expect(page.locator('#unsaved-indicator')).toBeHidden()
  await expect(page.locator('.content-block')).toHaveCount(9)
  for (const type of blockTypes) {
    await expect(page.locator(`.content-block[data-block-type="${type}"]`)).toHaveCount(1)
  }
  await expect(page.locator('#publishing-values')).toContainText('2026-11-04T12:00:00Z')
  await expect(page.locator('#publishing-values')).toContainText('pending')

  await applyTitle(page, 'Build 02 browser verification')
  await addScreen(page, 'Appendix', 'Appendix heading')
  const appendix = page.locator('.screen-item').filter({ hasText: 'Appendix' })
  const appendixId = await appendix.getAttribute('data-screen-id')
  expect(appendixId).toBeTruthy()

  await page.getByRole('button', { name: 'Move Appendix up', exact: true }).click()
  await expect(page.locator('.screen-primary')).toHaveText(['Appendix', 'Test'])
  await page.getByRole('button', { name: 'Edit Appendix', exact: true }).click()
  await page.locator('#screen-label-input').fill('Appendix renamed')
  await page.locator('#screen-heading-input').fill('Appendix heading renamed')
  await page.locator('#screen-dialog-submit').click()
  await expect(page.locator(`.screen-item[data-screen-id="${appendixId}"] .screen-primary`)).toHaveText('Appendix renamed')

  await addScreen(page, 'Disposable')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Remove Disposable', exact: true }).click()
  await expect(page.locator('.screen-primary')).toHaveText(['Appendix renamed', 'Test'])
  await expect(page.locator('#unsaved-indicator')).toBeVisible()

  await saveAs(page, 'saved.berry.md', 'saved.berry.md.review.json')
  const saved = await fileText(page, 'saved.berry.md')
  expect(saved).toContain('Build 02 browser verification')
  expect(saved).toContain('Appendix heading renamed')
  expect(saved).toContain('Unicode 🌿 中文')
  expect(saved).toContain('releaseAt: "2026-11-04T12:00:00Z"')
  expect(saved).toContain('[[CB9 id=compiler-prayer]]')
  expect(saved).not.toContain('Disposable')

  const companion = JSON.parse(await fileText(page, 'saved.berry.md.review.json'))
  const digest = createHash('sha256').update(saved, 'utf8').digest('hex')
  expect(companion.format).toBe('berrymark-studio-review-file-v1')
  expect(companion.transaction.phase).toBe('complete')
  expect(companion.sourceSha256).toBe(digest)
  expect(companion.reviewState.sourceSha256).toBe(digest)
  // This fixture is still pending; only an existing approval becomes stale.
  expect(companion.reviewState.approvalStale).toBe(false)

  await openFiles(page, saved, {
    manuscriptName: 'saved.berry.md',
    companionName: 'saved.berry.md.review.json',
    companionText: JSON.stringify(companion)
  })
  await expect(page.locator('#notice-text')).toContainText('matching review history')
  await expect(page.locator('#challenge-title')).toHaveValue('Build 02 browser verification')
  await expect(page.locator('.screen-primary')).toHaveText(['Appendix renamed', 'Test'])
  await page.getByRole('button', { name: 'Select Test', exact: true }).click()
  await expect(page.locator('.content-block')).toHaveCount(9)
  for (const type of blockTypes) {
    await expect(page.locator(`.content-block[data-block-type="${type}"]`)).toHaveCount(1)
  }
  await expect(page.locator('#unsaved-indicator')).toBeHidden()
})

base('metadata Apply rolls back a rejected group and retains form inputs for retry', async ({ page }) => {
  await page.addInitScript(installMemoryFileHarness)
  await page.goto('/')
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const source = fixtureSource
    .replace('approvalStatus: pending', 'approvalStatus: approved')
    .replace('approvedBy: null', 'approvedBy: Synthetic QA reviewer')
    .replace('approvedAt: null', 'approvedAt: "2026-11-20T12:00:00Z"')
  const openResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/documents')
  await openFiles(page, source)
  const original = await (await openResponse).json()
  const title = page.locator('#challenge-title')
  const slug = page.locator('#challenge-slug')
  const summary = page.locator('#challenge-summary')
  const notice = page.locator('#notice-text')
  const routePattern = '**/api/documents/*/operations'
  const requestOptions = { headers: { 'X-BerryMark-Studio': '1' } }
  const resource = `/api/documents/${original.id}`
  const current = async () => (await page.request.get(resource, requestOptions)).json()
  const requests = []
  let fault = 'stale-revision'
  await page.route(routePattern, async route => {
    const body = route.request().postDataJSON()
    requests.push(structuredClone(body))
    if (fault === 'stale-revision') body.revision -= 1
    if (fault === 'later-operation') body.operations[1].payload.path = 'challenge.invalid'
    await route.continue({ postData: JSON.stringify(body) })
  })

  await title.fill('Atomic browser title')
  await slug.fill('atomic-browser-slug')
  await summary.fill('Atomic browser summary')
  for (const [nextFault, status] of [['stale-revision', 409], ['later-operation', 422]]) {
    fault = nextFault
    const rejected = page.waitForResponse(response => response.url().endsWith('/operations'))
    await page.locator('#apply-metadata').click()
    expect((await rejected).status()).toBe(status)
    await expect(notice).toContainText('No document information changes were applied. Your inputs are still in the form.')
    await expect(title).toHaveValue('Atomic browser title')
    await expect(slug).toHaveValue('atomic-browser-slug')
    await expect(summary).toHaveValue('Atomic browser summary')
    await expect(page.locator('#metadata-draft-note')).toBeVisible()
    await expect(page.locator('#unsaved-indicator')).toBeHidden()
    await expect(page.locator('#validation-text')).toHaveText('Valid working document')
    await expect(page.locator('#diagnostic-list')).not.toContainText('BM_STUDIO_APPROVAL_STALE')
    expect(await current()).toEqual(original)
    expect(await fileText(page, 'working.berry.md')).toBe(source)
  }
  expect(requests).toHaveLength(2)
  for (const body of requests) {
    expect(body.revision).toBe(0)
    expect(body.operations.map(item => item.payload.path)).toEqual(['challenge.title', 'challenge.slug', 'challenge.summary'])
  }

  await page.getByRole('button', { name: 'Select Test', exact: true }).click()
  await expect(summary).toHaveValue('Atomic browser summary')
  await page.unroute(routePattern)
  await page.locator('#apply-metadata').click()
  await expect(notice).toContainText('Applied 3 document information changes')
  await expect(page.locator('#metadata-draft-note')).toBeHidden()
  await expect(page.locator('#unsaved-indicator')).toBeVisible()
  await expect(page.locator('#diagnostic-list')).toContainText('BM_STUDIO_APPROVAL_STALE')
  const updated = await current()
  expect(updated.revision).toBe(1)
  expect(updated.metadata.challenge).toMatchObject({
    title: 'Atomic browser title', slug: 'atomic-browser-slug', summary: 'Atomic browser summary'
  })
  expect(updated.metadata.editorial).toEqual(original.metadata.editorial)
  expect(errors).toEqual([])
})

test('unsupported source remains read-only, diagnosable, and byte-preserved through Save As', async ({ page }) => {
  const source = 'not a BerryMark document\n'
  await openFiles(page, source, { manuscriptName: 'broken.berry.md' })
  await expect(page.locator('#validation-text')).toHaveText('Unsupported · read-only')
  await expect(page.locator('#diagnostic-list .diagnostic-item')).not.toHaveCount(0)
  await expect(page.locator('#challenge-title')).toBeDisabled()
  await expect(page.locator('#add-screen-button')).toBeDisabled()
  await saveAs(page, 'broken-copy.berry.md', 'broken-copy.berry.md.review.json')
  expect(await fileText(page, 'broken-copy.berry.md')).toBe(source)
})

test('unsaved-work, picker, destination, and screen-removal cancellation preserve the working document', async ({ page }) => {
  await createDocument(page)
  await page.evaluate(() => globalThis.__berryMarkTestFiles.nextOpen(['other.berry.md']))
  page.once('dialog', dialog => dialog.dismiss())
  await page.locator('#open-button').click()
  await expect(page.locator('#document-name')).toHaveText('untitled.berry.md')
  await expect(page.locator('#unsaved-indicator')).toBeVisible()

  await page.evaluate(() => {
    globalThis.__berryMarkTestFiles.set('other.berry.md', 'not a BerryMark document\n')
    globalThis.__berryMarkTestFiles.cancelNextOpen()
  })
  page.once('dialog', dialog => dialog.accept())
  await page.locator('#open-button').click()
  await expect(page.locator('#document-name')).toHaveText('untitled.berry.md')
  await expect(page.locator('#unsaved-indicator')).toBeVisible()

  await page.evaluate(() => globalThis.__berryMarkTestFiles.nextSave(null, null))
  await page.locator('#save-as-button').click()
  await page.locator('#choose-save-manuscript').click()
  await expect(page.locator('#save-manuscript-name')).toHaveText('Not selected')
  await page.evaluate(() => globalThis.__berryMarkTestFiles.nextSave('cancelled.berry.md', null))
  await page.locator('#choose-save-manuscript').click()
  await page.locator('#choose-save-review').click()
  await expect(page.locator('#confirm-save-destinations')).toBeDisabled()
  expect(await fileText(page, 'cancelled.berry.md')).toBe('')
  expect(await page.evaluate(() => globalThis.__berryMarkTestFiles.has('cancelled.berry.md.review.json'))).toBe(false)
  await page.locator('[data-close-dialog="save-dialog"]').click()
  await expect(page.locator('#document-name')).toHaveText('untitled.berry.md')

  await page.evaluate(() => {
    globalThis.__berryMarkTestFiles.set('other.berry.md', 'not a BerryMark document\n')
    globalThis.__berryMarkTestFiles.nextOpen(['other.berry.md'])
  })
  page.once('dialog', dialog => dialog.accept())
  await page.locator('#open-button').click()
  await expect(page.locator('#document-name')).toHaveText('other.berry.md')
  // Open the valid fixture to exercise a real removal confirmation without
  // altering the source.
  await openFiles(page, fixtureSource)
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'Remove Test', exact: true }).click()
  await expect(page.locator('.screen-primary')).toHaveText(['Test'])
  await expect(page.locator('#unsaved-indicator')).toBeHidden()
})

test('an interrupted manuscript write remains unsaved and leaves prepared recovery information', async ({ page }) => {
  await createDocument(page, 'Interrupted save')
  await page.evaluate(() => globalThis.__berryMarkTestFiles.nextSave('interrupted.berry.md', 'interrupted.berry.md.review.json'))
  await page.locator('#save-as-button').click()
  await page.locator('#choose-save-manuscript').click()
  await page.locator('#choose-save-review').click()
  await page.evaluate(() => globalThis.__berryMarkTestFiles.failNextWrite('interrupted.berry.md'))
  await page.locator('#confirm-save-destinations').click()
  await expect(page.locator('#notice-text')).toContainText('manuscript write failed or was interrupted')
  await expect(page.locator('#unsaved-indicator')).toBeVisible()
  expect(await fileText(page, 'interrupted.berry.md')).toBe('')
  const companion = JSON.parse(await fileText(page, 'interrupted.berry.md.review.json'))
  expect(companion.transaction.phase).toBe('prepared')
  expect(companion.transaction.targetReviewState.sourceSha256).toBe(companion.transaction.targetSourceSha256)
})

test('denied file permission prevents writes and retains dirty state', async ({ page }) => {
  await createDocument(page, 'Permission check')
  await page.evaluate(() => globalThis.__berryMarkTestFiles.nextSave('denied.berry.md', 'denied.berry.md.review.json'))
  await page.locator('#save-as-button').click()
  await page.locator('#choose-save-manuscript').click()
  await page.locator('#choose-save-review').click()
  await page.evaluate(() => globalThis.__berryMarkTestFiles.permission('denied.berry.md', 'denied'))
  await page.locator('#confirm-save-destinations').click()
  await expect(page.locator('#notice-text')).toContainText('did not grant read/write permission')
  await expect(page.locator('#unsaved-indicator')).toBeVisible()
  expect(await fileText(page, 'denied.berry.md')).toBe('')
  expect(await fileText(page, 'denied.berry.md.review.json')).toBe('')
})

test('an externally changed manuscript is never silently overwritten', async ({ page }) => {
  await createDocument(page, 'Original title')
  await saveAs(page, 'external.berry.md', 'external.berry.md.review.json')
  const companionBefore = await fileText(page, 'external.berry.md.review.json')
  await applyTitle(page, 'Unsaved local title')
  await page.evaluate(() => globalThis.__berryMarkTestFiles.set('external.berry.md', 'external replacement\n'))
  await page.locator('#save-button').click()
  await expect(page.locator('#notice-text')).toContainText('changed outside Studio')
  await expect(page.locator('#unsaved-indicator')).toBeVisible()
  expect(await fileText(page, 'external.berry.md')).toBe('external replacement\n')
  expect(await fileText(page, 'external.berry.md.review.json')).toBe(companionBefore)
})

test('a malformed review companion requires explicit reset confirmation before either file changes', async ({ page }) => {
  const companionName = 'working.berry.md.review.json'
  await openFiles(page, fixtureSource, { companionName, companionText: '{ malformed' })
  await expect(page.locator('#review-recovery')).toContainText('malformed or unsupported')
  await applyTitle(page, 'Needs companion reset')
  const originalCompanion = await fileText(page, companionName)
  page.once('dialog', dialog => dialog.dismiss())
  await page.locator('#save-button').click()
  await expect(page.locator('#unsaved-indicator')).toBeVisible()
  expect(await fileText(page, 'working.berry.md')).toBe(fixtureSource)
  expect(await fileText(page, companionName)).toBe(originalCompanion)

  page.once('dialog', dialog => dialog.accept())
  await page.locator('#save-button').click()
  await expect(page.locator('#notice-text')).toContainText('Read-back verification passed')
  expect(await fileText(page, 'working.berry.md')).toContain('Needs companion reset')
  expect(JSON.parse(await fileText(page, companionName)).transaction.phase).toBe('complete')
})

test('authored HTML and script-like text render inert in titles, screens, and Content Blocks', async ({ page }) => {
  const source = `---\nberrymark: "0.1"\nchallenge:\n  title: '<img src=x onerror="globalThis.__pwned = 1">'\n---\n[[SCREEN id=injection-screen]]\nLabel: <svg onload="globalThis.__pwned = 2">\n# <img src=x onerror="globalThis.__pwned = 3">\n[[CB1 id=injection-block]]\n<script>globalThis.__pwned = 4</script>\n<img src=x onerror="globalThis.__pwned = 5">\n[[/CB1]]\n[[/SCREEN]]\n`
  await openFiles(page, source, { manuscriptName: 'injection.berry.md' })
  await expect(page.locator('#challenge-title')).toHaveValue('<img src=x onerror="globalThis.__pwned = 1">')
  await expect(page.locator('#screen-heading')).toHaveText('<img src=x onerror="globalThis.__pwned = 3">')
  await expect(page.locator('#block-list')).toContainText('<script>globalThis.__pwned = 4</script>')
  await expect(page.locator('#block-list script, #block-list img, #block-list svg, #screen-list svg')).toHaveCount(0)
  expect(await page.evaluate(() => globalThis.__pwned)).toBeUndefined()
})
