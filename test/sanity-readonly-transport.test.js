import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { lookupSanityImportState } from '../src/sanity-readonly-transport.js'
import { compileBerryMark } from '../src/compiler.js'
import { planBerryMarkImport } from '../src/import-planner.js'
import { resolveBerryMarkOnlineImport } from '../src/online-import-planner.js'

const token = 'synthetic-read-only-token-not-a-credential'
const identity = {
  slug: '2026-11-02-rejoice-always',
  canonicalId: 'berrymark-challenge-2026-11-02-rejoice-always',
  draftId: 'drafts.berrymark-challenge-2026-11-02-rejoice-always',
  seriesSlug: 'bibleberry-development-tests',
  sequence: 2,
  token
}
const response = (result, status = 200) => ({
  status,
  headers: { get: () => null },
  text: async () => JSON.stringify({ result })
})
const publishedSeries = { _id: 'series-published-id', slug: 'bibleberry-development-tests' }
const schemaSnapshot = JSON.parse(readFileSync(new URL('./bibleberry-schema-v0.1.snapshot.json', import.meta.url), 'utf8'))
const eligibleSource = readFileSync(new URL('../examples/rejoice-always/rejoice-always.berry.md', import.meta.url), 'utf8')
  .replace('series: null', 'series: bibleberry-development-tests')
  .replace('sequence: null', 'sequence: 2')
const eligibleOfflineReport = planBerryMarkImport({
  compilation: compileBerryMark(eligibleSource, { filename: 'transport-malformed-response.berry.md' }),
  source: eligibleSource,
  schemaSnapshot
})

function fetchRecorder(results = [[publishedSeries], [], []]) {
  const calls = []
  let index = 0
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options })
    return response(results[index++] ?? [])
  }
  return { calls, fetchImpl }
}

test('transport uses only fixed parameterized non-CDN GET queries with raw perspective', async () => {
  const { calls, fetchImpl } = fetchRecorder()
  const result = await lookupSanityImportState({ ...identity, fetchImpl })
  assert.equal(calls.length, 3)
  assert.equal(result.series.status, 'complete')
  assert.equal(result.challenges.status, 'complete')
  assert.equal(result.sequence.status, 'complete')
  for (const call of calls) {
    const url = new URL(call.url)
    assert.equal(url.hostname, '80016lrq.api.sanity.io')
    assert.equal(url.pathname, '/v2026-11-01/data/query/production')
    assert.equal(url.searchParams.get('perspective'), 'raw')
    assert.equal(call.options.method, 'GET')
    assert.equal(call.options.body, undefined)
    assert.equal(call.options.headers.Authorization, `Bearer ${token}`)
    assert.match(url.searchParams.get('query'), /^(\*\[_type == "challengeSeries"|\*\[_type == "challenge")/)
  }
  assert.equal(new URL(calls[0].url).searchParams.get('$slug'), '"bibleberry-development-tests"')
  assert.equal(new URL(calls[2].url).searchParams.get('$seriesId'), '"series-published-id"')
  assert.equal(new URL(calls[2].url).searchParams.get('$sequence'), '2')
})

test('draft-only series is retained as raw evidence and skips inapplicable sequence lookup', async () => {
  const { calls, fetchImpl } = fetchRecorder([[{ ...publishedSeries, _id: 'drafts.series-published-id' }], []])
  const result = await lookupSanityImportState({ ...identity, fetchImpl })
  assert.equal(calls.length, 2)
  assert.equal(result.series.documents[0]._id, 'drafts.series-published-id')
  assert.equal(result.sequence.status, 'not-required')
})

test('missing credential performs no fetch and returns structured authentication failures', async () => {
  let calls = 0
  const result = await lookupSanityImportState({ ...identity, token: undefined, fetchImpl: async () => { calls += 1 } })
  assert.equal(calls, 0)
  assert.equal(result.series.error.code, 'BM_IMPORT_AUTH_REQUIRED')
  assert.equal(result.challenges.error.code, 'BM_IMPORT_AUTH_REQUIRED')
})

test('authentication and permission failures remain distinct and safe', async () => {
  for (const [status, code] of [[401, 'BM_IMPORT_AUTH_FAILED'], [403, 'BM_IMPORT_PERMISSION_DENIED']]) {
    const result = await lookupSanityImportState({ ...identity, fetchImpl: async () => response([], status) })
    assert.equal(result.challenges.status, 'failed')
    assert.equal(result.challenges.error.code, code)
    assert.equal(JSON.stringify(result).includes(token), false)
  }
})

test('malformed JSON and missing result arrays are not treated as empty result sets', async () => {
  const malformedJson = await lookupSanityImportState({
    ...identity,
    seriesSlug: null,
    fetchImpl: async () => ({ status: 200, headers: { get: () => null }, text: async () => '{not-json' })
  })
  assert.equal(malformedJson.challenges.error.code, 'BM_IMPORT_MALFORMED_RESPONSE')
  const missingResult = await lookupSanityImportState({
    ...identity,
    seriesSlug: null,
    fetchImpl: async () => ({ status: 200, headers: { get: () => null }, text: async () => '{}' })
  })
  assert.equal(missingResult.challenges.error.code, 'BM_IMPORT_MALFORMED_RESPONSE')
})

for (const [description, malformedDocument] of [
  ['null record', null],
  ['missing ID', { title: 'Malformed series' }],
  ['non-string ID', { _id: 42 }]
]) {
  test(`malformed series ${description} returns a structured failure and online unknown without throwing`, async () => {
    const { fetchImpl } = fetchRecorder([[malformedDocument], []])
    let result
    await assert.doesNotReject(async () => {
      result = await lookupSanityImportState({ ...identity, fetchImpl })
    })
    assert.equal(result.series.status, 'failed')
    assert.equal(result.series.error.code, 'BM_IMPORT_MALFORMED_RESPONSE')
    assert.equal(result.series.documents.length, 0)
    assert.equal(JSON.stringify(result).includes(token), false)

    const report = resolveBerryMarkOnlineImport({
      offlineReport: eligibleOfflineReport,
      lookupResults: result
    })
    assert.equal(report.proposedAction, 'unknown')
    assert.equal(report.importEligible, false)
    assert.ok(report.errors.some(item => item.code === 'BM_IMPORT_MALFORMED_RESPONSE'))
    assert.equal(report.writesAttempted, 0)
  })
}

test('oversized responses fail before being accepted as lookup evidence', async () => {
  const result = await lookupSanityImportState({
    ...identity,
    seriesSlug: null,
    fetchImpl: async () => ({ status: 200, headers: { get: () => '100001' }, text: async () => { throw new Error('must not read') } })
  })
  assert.equal(result.challenges.error.code, 'BM_IMPORT_MALFORMED_RESPONSE')
})

test('timeouts and network errors fail closed without leaking credentials or stacks', async () => {
  const timeout = await lookupSanityImportState({
    ...identity,
    seriesSlug: null,
    fetchImpl: async () => { throw Object.assign(new Error(`private ${token}`), { name: 'TimeoutError' }) }
  })
  assert.equal(timeout.challenges.error.code, 'BM_IMPORT_LOOKUP_TIMEOUT')
  assert.equal(JSON.stringify(timeout).includes(token), false)
  const network = await lookupSanityImportState({
    ...identity,
    seriesSlug: null,
    fetchImpl: async () => { throw new Error(`request header Authorization: Bearer ${token}`) }
  })
  assert.equal(network.challenges.error.code, 'BM_IMPORT_LOOKUP_FAILED')
  assert.equal(JSON.stringify(network).includes(token), false)
  assert.equal(JSON.stringify(network).includes('Authorization'), false)
})

test('transport contains no mutation API or arbitrary-query entry point', () => {
  const source = readFileSync(new URL('../src/sanity-readonly-transport.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]|\.create\(|\.patch\(|\.publish\(|\.delete\(/)
  assert.doesNotMatch(source, /process\.env/)
  const cli = readFileSync(new URL('../src/online-import-plan-cli.js', import.meta.url), 'utf8')
  assert.doesNotMatch(cli, /--apply|\.create\(|\.patch\(|\.publish\(/)
})

const cliPath = fileURLToPath(new URL('../src/online-import-plan-cli.js', import.meta.url))
const rejoicePath = fileURLToPath(new URL('../examples/rejoice-always/rejoice-always.berry.md', import.meta.url))
const invalidPath = fileURLToPath(new URL('../examples/invalid-duplicate-ids.berry.md', import.meta.url))

test('admin CLI without credentials preserves source verification and returns structured unknown', () => {
  const env = { ...process.env }
  delete env.BERRYMARK_SANITY_READ_TOKEN
  const result = spawnSync(process.execPath, [cliPath, rejoicePath], { encoding: 'utf8', env })
  assert.equal(result.status, 3, result.stderr)
  assert.equal(result.stderr, '')
  const report = JSON.parse(result.stdout)
  assert.equal(report.sourceVerification.verified, true)
  assert.equal(report.proposedAction, 'unknown')
  assert.equal(report.lookup.status, 'failed')
  assert.equal(report.writesAttempted, 0)
  assert.ok(report.errors.some(item => item.code === 'BM_IMPORT_AUTH_REQUIRED'))
})

test('admin CLI stops on local validation failure without attempting online lookup', () => {
  const result = spawnSync(process.execPath, [cliPath, invalidPath], { encoding: 'utf8', env: { ...process.env, BERRYMARK_SANITY_READ_TOKEN: token } })
  assert.equal(result.status, 1, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.proposedAction, 'reject')
  assert.equal(report.lookup.status, 'not-run')
  assert.equal(result.stdout.includes(token), false)
})

test('admin CLI rejects apply flags and unexpected arguments', () => {
  const result = spawnSync(process.execPath, [cliPath, rejoicePath, '--apply'], { encoding: 'utf8' })
  assert.equal(result.status, 2)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /Usage:/)
})
