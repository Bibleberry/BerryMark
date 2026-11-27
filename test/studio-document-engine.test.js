import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compileBerryMark, compileValidatedBerryMark } from '../src/compiler.js'
import { candidateSha256 } from '../src/import-fingerprint.js'
import { sha256 } from '../src/keys.js'
import {
  BerryMarkEditError,
  createBerryMarkDocument,
  openBerryMarkDocument
} from '../src/studio/document-engine.js'

const allBlocksSource = readFileSync(new URL('../examples/compiler-all-blocks.berry.md', import.meta.url), 'utf8')
const schemaSnapshot = JSON.parse(readFileSync(new URL('./bibleberry-schema-v0.1.snapshot.json', import.meta.url), 'utf8'))
const metadata = `---
berrymark: "0.1"
challenge:
  title: "Studio test"
  slug: studio-test
  type: teaching
  summary: null
publishing:
  series: studio-series
  sequence: 1
  releaseAt: "2026-11-04T12:00:00Z"
scripture:
  reference: "John 11:35"
  translation: BM-TEST
  textStatus: referenceOnly
  usageRightsConfirmed: false
  practiceStatus: notConfigured
editorial:
  sourceTitle: "Studio test source"
  sourceAuthor: "BerryMark test fixture"
  sourceRevision: "studio-revision-1"
  approvalStatus: pending
  approvedBy: null
  approvedAt: null
companionLinks: []
---
`

function sourceWith(body, screenId = 'studio-screen') {
  return `${metadata}[[SCREEN id=${screenId}]]\nLabel: Test\n# Studio test screen\n\n${body}[[/SCREEN]]\n`
}

const cb1 = (id = 'teaching', text = 'Authored teaching paragraph.') => `[[CB1 id=${id}]]\n${text}\n[[/CB1]]\n`
const cb6 = () => `[[CB6 id=sequence]]\nCycle: true\nReturn Caption: Return\n[[STEP id=step-one]]\nTitle: One\nBody: First.\n[[/STEP]]\n[[STEP id=step-two]]\nTitle: Two\nBody: Second.\n[[/STEP]]\nConclusion: Finished.\n[[/CB6]]\n`
const cb7WithoutChoices = () => `[[CB7 id=reflection]]\nQuestion: Reflect?\nClosing: Optional closing.\n[[/CB7]]\n`
const choice = id => ({ type: 'CHOICE', id, fields: { Label: id, Prompt: `${id} prompt.` } })

function blockTypes(document) {
  return document.listScreens().flatMap(screen => screen.blocks.map(block => block.type))
}

function assertUnchangedOutside(source, edited, before, after) {
  const start = source.indexOf(before)
  const end = source.indexOf(after)
  assert.ok(start >= 0 && end > start)
  assert.equal(edited.slice(0, start), source.slice(0, start))
  assert.equal(edited.slice(edited.indexOf(after)), source.slice(end))
}

const constructionSpecs = [
  { type: 'CB1', id: 'constructed-cb1', body: 'Rich **teaching** with Unicode 🌿.' },
  { type: 'CB2', id: 'constructed-cb2', fields: { Reference: 'John 11:35', Translation: 'BM-TEST', 'Text Status': 'referenceOnly', 'Usage Rights Confirmed': false, 'Practice Status': 'notConfigured' } },
  { type: 'CB3', id: 'constructed-cb3', fields: { Label: 'Statement', Text: 'Exact **plain** statement.' } },
  { type: 'CB4', id: 'constructed-cb4', left: { title: 'Left', body: 'Left **body**.' }, right: { title: 'Right', body: 'Right *body*.' }, footer: 'Exact footer.' },
  { type: 'CB5', id: 'constructed-cb5', cards: [{ id: 'constructed-card-one', fields: { Title: 'One', Body: 'First card.' } }, { id: 'constructed-card-two', fields: { Title: 'Two' } }] },
  { type: 'CB6', id: 'constructed-cb6', fields: { Cycle: true, 'Return Caption': 'Return', Conclusion: 'Done.' }, steps: [{ id: 'constructed-step-one', fields: { Title: 'One', Body: 'First.' } }, { id: 'constructed-step-two', fields: { Title: 'Two', Body: 'Second.' } }] },
  { type: 'CB7', id: 'constructed-cb7', fields: { Question: 'Reflect?', Closing: 'Optional.' }, choices: [{ id: 'constructed-choice-one', fields: { Label: 'One', Prompt: 'First?' } }, { id: 'constructed-choice-two', fields: { Label: 'Two', Prompt: 'Second?' } }] },
  { type: 'CB8', id: 'constructed-cb8', title: 'Study', body: 'Study **body**.', scriptures: [{ id: 'constructed-scripture', fields: { Reference: 'John 11:35', Translation: 'BM-TEST', 'Text Status': 'referenceOnly', 'Usage Rights Confirmed': false, 'Practice Status': 'notConfigured' } }] },
  { type: 'CB9', id: 'constructed-cb9', text: 'First prayer paragraph.\n\nSecond *plain* prayer paragraph.' }
]

for (const spec of constructionSpecs) {
  test(`${spec.type} construction preserves its registered fields, body, and nested identity`, () => {
    const document = createBerryMarkDocument({
      metadata: openBerryMarkDocument(allBlocksSource).getMetadata(),
      screens: [{ id: `screen-${spec.type.toLowerCase()}`, label: 'Test', heading: spec.type, blocks: [spec] }]
    })
    assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
    assert.deepEqual(blockTypes(document), [spec.type])
    assert.equal(document.getBlock(spec.id).id, spec.id)
    assert.equal(openBerryMarkDocument(document.serialize()).serialize(), document.serialize())
    const compilation = compileValidatedBerryMark(document.validate(), { source: document.serialize() })
    assert.equal(compilation.ok, true, JSON.stringify(compilation.diagnostics))
    assert.equal(compilation.sanityCandidate.screens[0].blocks[0]._key, spec.id)
  })
}

test('all existing BerryMark manuscripts round-trip byte for byte, including unsupported fixtures', () => {
  for (const path of [
    '../examples/hello-world.berry.md',
    '../examples/invalid-duplicate-ids.berry.md',
    '../examples/compiler-all-blocks.berry.md',
    '../examples/acceptance/milestone-3-all-blocks.berry.md',
    '../examples/rejoice-always/rejoice-always.berry.md'
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    const document = openBerryMarkDocument(source, { filename: path })
    assert.equal(document.serialize(), source, path)
    assert.equal(document.validate().sourceSha256, sha256(source), path)
    if (path.includes('invalid-duplicate')) assert.equal(document.status, 'unsupported')
  }
})

test('BOM, CRLF, mixed line endings, and absent final newline survive unchanged serialization', () => {
  for (const source of [
    `\uFEFF${allBlocksSource.replace(/\n/g, '\r\n')}`,
    allBlocksSource.replace(/\n/g, '\r\n'),
    allBlocksSource.replace('berrymark: "0.1"\n', 'berrymark: "0.1"\r\n'),
    allBlocksSource.replace(/\n$/, '')
  ]) {
    const document = openBerryMarkDocument(source)
    assert.equal(document.serialize(), source)
  }
})

test('unchanged round trips are compiler-equivalent and retain exact source fingerprints', () => {
  for (const path of ['../examples/compiler-all-blocks.berry.md', '../examples/rejoice-always/rejoice-always.berry.md']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    const document = openBerryMarkDocument(source)
    const direct = compileBerryMark(source)
    const roundTripped = compileBerryMark(document.serialize())
    assert.deepEqual(roundTripped, direct)
    assert.equal(roundTripped.reviewReport.source.sha256, sha256(source))
  }
})

test('metadata scalar edits replace only the targeted YAML line and never rewrite the manuscript', () => {
  const document = openBerryMarkDocument(allBlocksSource)
  document.setMetadata('challenge.title', 'BM-TEST Revised Title')
  const edited = document.serialize()
  const bodyOffset = allBlocksSource.indexOf('---\n\n<!-- EDITORIAL')
  assert.equal(edited.slice(edited.indexOf('---\n\n<!-- EDITORIAL')), allBlocksSource.slice(bodyOffset))
  const originalLines = allBlocksSource.split('\n')
  const editedLines = edited.split('\n')
  assert.equal(originalLines.length, editedLines.length)
  assert.deepEqual(editedLines.map((line, index) => line === originalLines[index] ? null : index + 1).filter(Boolean), [4])
  assert.equal(editedLines[3], '  title: "BM-TEST Revised Title"')
})

test('metadata collection insertion and deletion preserve unrelated YAML formatting and source', () => {
  const added = openBerryMarkDocument(allBlocksSource)
  added.setMetadata('companionLinks[2]', { provider: 'other', label: 'Third', url: null })
  assert.ok(added.serialize().includes('  - provider: other\n    label: Third\n    url: null\n---\n'))
  assert.ok(added.serialize().includes('    label: "BM-TEST HTTPS companion"'))
  assert.ok(added.serialize().endsWith(allBlocksSource.slice(allBlocksSource.indexOf('---\n\n<!-- EDITORIAL'))))

  const removed = openBerryMarkDocument(allBlocksSource)
  removed.deleteMetadata('companionLinks[1]')
  assert.equal(removed.getMetadata('companionLinks').length, 1)
  assert.ok(!removed.serialize().includes('BM-TEST unresolved companion'))
  assert.ok(removed.serialize().includes('    label: "BM-TEST HTTPS companion"'))
  assert.ok(removed.serialize().endsWith(allBlocksSource.slice(allBlocksSource.indexOf('---\n\n<!-- EDITORIAL'))))
})

test('semantically identical metadata writes and absent deletes are exact no-ops', () => {
  const original = openBerryMarkDocument(allBlocksSource)
  const document = openBerryMarkDocument(allBlocksSource)
  document.setMetadata('companionLinks', original.getMetadata('companionLinks'))
  document.setMetadata('challenge.title', original.getMetadata('challenge.title'))
  document.deleteMetadata('companionLinks[4]')
  assert.equal(document.serialize(), allBlocksSource)
  assert.equal(document.dirty, false)
})

test('YAML comments, quoting, collection style, and unrelated key order survive a targeted edit', () => {
  const source = allBlocksSource
    .replace('challenge:\n', '# Keep this challenge comment.\nchallenge:\n')
    .replace('  slug: bm-test-compiler-all-blocks', "  slug: 'bm-test-compiler-all-blocks'")
    .replace('  sequence: 1', '  sequence: 1 # Keep sequence comment.')
  const document = openBerryMarkDocument(source)
  document.setMetadata('publishing.sequence', 2)
  assert.ok(document.serialize().includes('# Keep this challenge comment.\nchallenge:'))
  assert.ok(document.serialize().includes("  slug: 'bm-test-compiler-all-blocks'"))
  assert.ok(document.serialize().includes('  sequence: 2 # Keep sequence comment.'))
  assert.equal(document.serialize().split('\n').length, source.split('\n').length)
})

test('CRLF metadata editing retains the document newline convention and BOM', () => {
  const source = `\uFEFF${allBlocksSource.replace(/\n/g, '\r\n')}`
  const document = openBerryMarkDocument(source)
  document.setMetadata('challenge.title', 'CRLF title')
  assert.ok(document.serialize().startsWith('\uFEFF---\r\n'))
  assert.ok(document.serialize().includes('  title: "CRLF title"\r\n'))
  assert.equal(document.serialize().replace(/\r\n/g, '').includes('\n'), false)
})

test('compound CB6 field updates use refreshed source positions for every field', () => {
  const document = openBerryMarkDocument(sourceWith(cb6()))
  document.updateBlock('sequence', { fields: { Cycle: false, 'Return Caption': null, Conclusion: 'A much longer revised conclusion.' } })
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
  assert.deepEqual(document.getBlock('sequence').fields, { Cycle: 'false', Conclusion: 'A much longer revised conclusion.' })
  assert.deepEqual(document.getBlock('sequence').steps.map(step => step.id), ['step-one', 'step-two'])
})

test('compound CB8 title and body updates retain nested Scripture byte ranges', () => {
  const document = openBerryMarkDocument(allBlocksSource)
  const nestedStart = allBlocksSource.indexOf('[[SCRIPTURE id=compiler-study-reference-only]]')
  const nestedEnd = allBlocksSource.indexOf('[[/CB8]]', nestedStart)
  const nestedSource = allBlocksSource.slice(nestedStart, nestedEnd)
  document.updateBlock('compiler-study', { title: 'A revised and substantially longer study title', body: 'Replacement study body with **strong text**.' })
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
  assert.equal(document.getBlock('compiler-study').title, 'A revised and substantially longer study title')
  assert.equal(document.getBlock('compiler-study').body, 'Replacement study body with **strong text**.')
  assert.ok(document.serialize().includes(nestedSource))
})

test('compound nested field and rich-section updates never reuse stale nodes', () => {
  const document = openBerryMarkDocument(allBlocksSource)
  document.updateNested('compiler-sequence', 'compiler-step-one', { fields: { Title: 'Revised step title', Body: 'Revised step body with a longer explanation.' } })
  assert.deepEqual(document.getNested('compiler-step-one').fields, { Title: 'Revised step title', Body: 'Revised step body with a longer explanation.' })
  document.updateBlock('compiler-comparison', {
    left: { title: 'Revised left', body: 'Revised left body.' },
    right: { title: 'Revised right', body: 'Revised right body.' },
    footer: 'Revised footer.'
  })
  const block = document.getBlock('compiler-comparison')
  assert.equal(block.left.title, 'Revised left')
  assert.equal(block.left.body, 'Revised left body.')
  assert.equal(block.right.title, 'Revised right')
  assert.equal(block.right.body, 'Revised right body.')
  assert.equal(block.footer, 'Revised footer.')
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
})

test('CB6 insertion and movement always precede Conclusion and preserve step identity', () => {
  const document = openBerryMarkDocument(sourceWith(cb6()))
  document.addNested('sequence', { type: 'STEP', id: 'step-three', fields: { Title: 'Three', Body: 'Third.' } })
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
  assert.deepEqual(document.getBlock('sequence').steps.map(step => step.id), ['step-one', 'step-two', 'step-three'])
  assert.ok(document.serialize().indexOf('[[STEP id=step-three]]') < document.serialize().indexOf('Conclusion: Finished.'))
  document.moveNested('sequence', 'step-three', 0)
  assert.deepEqual(document.getBlock('sequence').steps.map(step => step.id), ['step-three', 'step-one', 'step-two'])
  assert.ok(document.serialize().indexOf('Conclusion: Finished.') > document.serialize().indexOf('[[/STEP]]'))
  document.removeNested('sequence', 'step-three')
  assert.deepEqual(document.getBlock('sequence').steps.map(step => step.id), ['step-one', 'step-two'])
  assert.equal(document.getBlock('sequence').fields.Conclusion, 'Finished.')
})

test('CB7 transitions between no choices and choices keep Closing in the correct phase', () => {
  const document = openBerryMarkDocument(sourceWith(cb7WithoutChoices()))
  document.addNested('reflection', choice('choice-one'))
  assert.equal(document.status, 'incomplete')
  assert.ok(document.serialize().indexOf('[[CHOICE id=choice-one]]') < document.serialize().indexOf('Closing: Optional closing.'))
  assert.equal(document.diagnostics.some(item => item.code === 'BM_CHOICE_CLOSING'), false)
  document.addNested('reflection', choice('choice-two'))
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
  assert.deepEqual(document.getBlock('reflection').choices.map(item => item.id), ['choice-one', 'choice-two'])
  document.moveNested('reflection', 'choice-two', 0)
  assert.deepEqual(document.getBlock('reflection').choices.map(item => item.id), ['choice-two', 'choice-one'])
  assert.ok(document.serialize().indexOf('Closing: Optional closing.') > document.serialize().lastIndexOf('[[/CHOICE]]'))
  document.removeNested('reflection', 'choice-one')
  assert.equal(document.status, 'incomplete')
  document.removeNested('reflection', 'choice-two')
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
  assert.equal(document.getBlock('reflection').choices.length, 0)
  assert.equal(document.getBlock('reflection').fields.Closing, 'Optional closing.')
  document.addNested('reflection', choice('choice-one'))
  document.addNested('reflection', choice('choice-two'))
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
})

test('CB4 singular insertion restores LEFT, RIGHT, FOOTER structural order', () => {
  const source = sourceWith('[[CB4 id=comparison]]\n[[FOOTER]]\nFooter.\n[[/FOOTER]]\n[[/CB4]]\n')
  const document = openBerryMarkDocument(source)
  assert.equal(document.status, 'incomplete')
  document.addNested('comparison', { type: 'RIGHT', title: 'Right', body: 'Right body.' })
  document.addNested('comparison', { type: 'LEFT', title: 'Left', body: 'Left body.' })
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
  const edited = document.serialize()
  assert.ok(edited.indexOf('[[LEFT]]') < edited.indexOf('[[RIGHT]]'))
  assert.ok(edited.indexOf('[[RIGHT]]') < edited.indexOf('[[FOOTER]]'))
})

test('CB5 and CB8 nested insertion, removal, and movement preserve ordering and parent content', () => {
  const document = openBerryMarkDocument(allBlocksSource)
  const studyBody = document.getBlock('compiler-study').body
  document.addNested('compiler-cards', { type: 'CARD', id: 'compiler-card-three', fields: { Title: 'Three' } }, 1)
  assert.deepEqual(document.getBlock('compiler-cards').cards.map(card => card.id), ['compiler-card-full', 'compiler-card-three', 'compiler-card-title-only'])
  document.moveNested('compiler-cards', 'compiler-card-three', 2)
  document.removeNested('compiler-cards', 'compiler-card-three')
  assert.deepEqual(document.getBlock('compiler-cards').cards.map(card => card.id), ['compiler-card-full', 'compiler-card-title-only'])

  document.addNested('compiler-study', { type: 'SCRIPTURE', id: 'compiler-study-third', fields: { Reference: 'Synthetic 1:2', Translation: 'BM-TEST', 'Text Status': 'referenceOnly', 'Usage Rights Confirmed': false, 'Practice Status': 'notConfigured' } }, 0)
  assert.deepEqual(document.getBlock('compiler-study').scriptures.map(item => item.id), ['compiler-study-third', 'compiler-study-reference-only', 'compiler-study-provided'])
  document.moveNested('compiler-study', 'compiler-study-third', 2)
  document.removeNested('compiler-study', 'compiler-study-third')
  assert.equal(document.getBlock('compiler-study').body, studyBody)
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
})

test('adding a missing CB8 title preserves every authored paragraph and later literal Title line', () => {
  const source = sourceWith('[[CB8 id=incomplete-study]]\nFirst authored paragraph.\n\nTitle: Later literal prose.\n\nFinal authored paragraph.\n[[/CB8]]\n')
  const document = openBerryMarkDocument(source)
  assert.equal(document.status, 'incomplete')
  document.updateBlock('incomplete-study', { title: 'Recovered study title' })
  const block = document.getBlock('incomplete-study')
  assert.equal(block.title, 'Recovered study title')
  assert.equal(block.body, 'First authored paragraph.\n\nTitle: Later literal prose.\n\nFinal authored paragraph.')
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
  document.updateBlock('incomplete-study', { body: 'Replacement body.\n\nTitle: Still literal prose.' })
  assert.equal(document.getBlock('incomplete-study').title, 'Recovered study title')
  assert.equal(document.getBlock('incomplete-study').body, 'Replacement body.\n\nTitle: Still literal prose.')
})

test('body replacement without a valid CB8 title does not retain a mistaken trailing fragment', () => {
  const source = sourceWith('[[CB8 id=incomplete-study]]\nFirst authored paragraph.\n\nSecond authored paragraph.\n[[/CB8]]\n')
  const document = openBerryMarkDocument(source)
  document.updateBlock('incomplete-study', { body: 'Intentional complete body replacement.' })
  const edited = document.serialize()
  assert.ok(!edited.includes('First authored paragraph.'))
  assert.ok(!edited.includes('Second authored paragraph.'))
  assert.ok(edited.includes('Intentional complete body replacement.'))
  document.updateBlock('incomplete-study', { title: 'Added after body replacement' })
  assert.equal(document.getBlock('incomplete-study').body, 'Intentional complete body replacement.')
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
})

test('incomplete LEFT and RIGHT title recovery preserves independent authored bodies', () => {
  const source = sourceWith('[[CB4 id=incomplete-comparison]]\n[[LEFT]]\nLeft first paragraph.\n\nLeft second paragraph.\n[[/LEFT]]\n[[RIGHT]]\nRight first paragraph.\n\nTitle: Right literal prose.\n[[/RIGHT]]\n[[/CB4]]\n')
  const document = openBerryMarkDocument(source)
  document.updateBlock('incomplete-comparison', { left: { title: 'Left title' }, right: { title: 'Right title' } })
  const block = document.getBlock('incomplete-comparison')
  assert.equal(block.left.body, 'Left first paragraph.\n\nLeft second paragraph.')
  assert.equal(block.right.body, 'Right first paragraph.\n\nTitle: Right literal prose.')
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
  document.updateNested('incomplete-comparison', 'LEFT', { body: 'New left body.' })
  assert.equal(document.getBlock('incomplete-comparison').right.body, 'Right first paragraph.\n\nTitle: Right literal prose.')
})

test('rich-body edits retain exact editorial comments and unrelated block source', () => {
  const source = sourceWith(`${cb1('before', 'Unrelated before.') }[[CB8 id=commented-study]]\nTitle: Commented study\n\n<!-- EDITORIAL NOTE: Keep this comment exactly. -->\nOriginal body.\n<!-- TODO: Keep this too. -->\n[[/CB8]]\n${cb1('after', 'Unrelated after.')}`)
  const document = openBerryMarkDocument(source)
  document.updateBlock('commented-study', { body: 'Replacement body.' })
  assert.ok(document.serialize().includes('Title: Commented study\n\nReplacement body.\n<!-- EDITORIAL NOTE: Keep this comment exactly. -->\n<!-- TODO: Keep this too. -->\n[[/CB8]]'))
  assert.ok(document.serialize().includes(cb1('before', 'Unrelated before.')))
  assert.ok(document.serialize().includes(cb1('after', 'Unrelated after.')))
  assert.deepEqual(document.validate().document.annotations.map(item => item.text), ['<!-- EDITORIAL NOTE: Keep this comment exactly. -->', '<!-- TODO: Keep this too. -->'])
})

test('screen and cross-screen block moves preserve exact moved source and stable IDs', () => {
  const movingBlock = '[[CB1 id=moving-block]]\n<!-- EDITORIAL NOTE: Move with the block. -->\nMoving **body**.\n[[/CB1]]\n'
  const source = `${metadata}[[SCREEN id=screen-one]]\n${cb1('stationary-one', 'Stationary one.')}${movingBlock}[[/SCREEN]]\n[[SCREEN id=screen-two]]\n${cb1('stationary-two', 'Stationary two.')}[[/SCREEN]]\n`
  const document = openBerryMarkDocument(source)
  document.moveBlock('moving-block', 'screen-two', 0)
  assert.deepEqual(document.listScreens().map(screen => screen.id), ['screen-one', 'screen-two'])
  assert.deepEqual(document.getScreen('screen-two').blocks.map(block => block.id), ['moving-block', 'stationary-two'])
  assert.ok(document.serialize().includes(movingBlock))
  assert.equal(document.getBlock('moving-block').text, 'Moving **body**.')
  document.moveScreen('screen-two', 0)
  assert.deepEqual(document.listScreens().map(screen => screen.id), ['screen-two', 'screen-one'])
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
})

test('same-position moves and same-value field writes are exact no-ops', () => {
  const document = openBerryMarkDocument(allBlocksSource)
  document.moveScreen('compiler-fixture-screen', 0)
  document.moveBlock('compiler-rich-teaching', 'compiler-fixture-screen', 0)
  document.moveNested('compiler-sequence', 'compiler-step-one', 0)
  document.updateBlock('compiler-rich-teaching', { body: document.getBlock('compiler-rich-teaching').text })
  assert.equal(document.serialize(), allBlocksSource)
  assert.equal(document.dirty, false)
})

test('body serialization escapes full reserved marker lines without altering other prose', () => {
  const document = openBerryMarkDocument(sourceWith(cb1()))
  document.updateBlock('teaching', { body: 'Before\n[[SCREEN id=literal]]\nTitle: literal field prose\nAfter' })
  assert.ok(document.serialize().includes('Before\n\\[[SCREEN id=literal]]\nTitle: literal field prose\nAfter'))
  assert.equal(document.getBlock('teaching').text, 'Before\n[[SCREEN id=literal]]\nTitle: literal field prose\nAfter')
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
})

test('malformed and ambiguous documents are read-only and retain exact source after rejected edits', () => {
  const malformed = [
    readFileSync(new URL('../examples/invalid-duplicate-ids.berry.md', import.meta.url), 'utf8'),
    sourceWith('[[CB1 id=broken]]\nText\n'),
    sourceWith('[[CB3 id=broken]]\nUnknown: value\n[[/CB3]]\n'),
    allBlocksSource.replace('berrymark: "0.1"', 'berrymark: ['),
    'not a BerryMark document'
  ]
  for (const source of malformed) {
    const document = openBerryMarkDocument(source)
    assert.equal(document.status, 'unsupported')
    assert.throws(() => document.updateScreen('anything', { heading: 'No' }), error => error instanceof BerryMarkEditError && error.code === 'BM_STUDIO_READ_ONLY')
    assert.equal(document.serialize(), source)
  }
})

test('incomplete but structurally editable documents can be repaired without source reconstruction', () => {
  const source = sourceWith('[[CB3 id=incomplete-statement]]\nLabel: Keep this label\n[[/CB3]]\n')
  const document = openBerryMarkDocument(source)
  assert.equal(document.status, 'incomplete')
  document.updateBlock('incomplete-statement', { fields: { Text: 'Added required statement.' } })
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
  assert.deepEqual(document.getBlock('incomplete-statement').fields, { Label: 'Keep this label', Text: 'Added required statement.' })
})

test('a failed compound edit rolls back source, AST, diagnostics, and dirty state exactly', () => {
  const document = openBerryMarkDocument(sourceWith(cb6()))
  const before = document.serialize()
  const validation = document.validate()
  const diagnostics = document.diagnostics
  assert.throws(() => document.updateBlock('sequence', { fields: { Conclusion: 'Temporarily changed', Unknown: 'Invalid' } }), error => error.code === 'BM_STUDIO_FIELD_UNSUPPORTED')
  assert.equal(document.serialize(), before)
  assert.equal(document.validate(), validation)
  assert.deepEqual(document.diagnostics, diagnostics)
  assert.equal(document.dirty, false)
})

test('unsafe metadata and invalid movement operations are atomic', () => {
  const document = openBerryMarkDocument(allBlocksSource)
  const before = document.serialize()
  assert.throws(() => document.setMetadata('berrymark', '9.9'), error => error.code === 'BM_STUDIO_EDIT_UNSAFE')
  assert.equal(document.serialize(), before)
  assert.throws(() => document.moveBlock('compiler-rich-teaching', 'compiler-fixture-screen', 99), error => error.code === 'BM_STUDIO_INDEX')
  assert.equal(document.serialize(), before)
  assert.throws(() => document.addScreen({ id: 'compiler-fixture-screen', blocks: [] }), error => error.code === 'BM_STUDIO_ID_COLLISION')
  assert.equal(document.serialize(), before)
  assert.equal(document.dirty, false)
})

test('failed edits after prior successful work restore the prior checkpoint, not the original source', () => {
  const document = openBerryMarkDocument(allBlocksSource)
  document.setMetadata('challenge.title', 'Checkpoint title')
  const checkpoint = document.serialize()
  assert.throws(() => document.updateBlock('compiler-study', { title: 'Temporary', body: 42 }), error => error.code === 'BM_STUDIO_VALUE_TYPE')
  assert.equal(document.serialize(), checkpoint)
  assert.equal(document.getMetadata('challenge.title'), 'Checkpoint title')
  assert.equal(document.dirty, true)
})

test('validation snapshots isolate interpreted content and source-bound compilation from callers', () => {
  const source = allBlocksSource
  const document = openBerryMarkDocument(source)
  const validation = document.validate()
  const originalTitle = document.getMetadata('challenge.title')
  const originalBlock = document.getBlock('compiler-rich-teaching')
  const originalDiagnostics = structuredClone(document.diagnostics)
  const expected = compileBerryMark(source)

  assert.throws(() => { validation.ok = false }, TypeError)
  assert.throws(() => { validation.document.metadata.challenge.title = 'Forged title' }, TypeError)
  assert.throws(() => { validation.document.screens[0].blocks[0].text = 'Forged teaching' }, TypeError)
  assert.throws(() => { validation.document.screens[0].blocks.pop() }, TypeError)
  assert.throws(() => { validation.diagnostics[0].severity = 'error' }, TypeError)
  assert.throws(() => { validation.sourceSha256 = 'forged digest' }, TypeError)

  const locations = validation.metadataLocations
  const locationPath = JSON.stringify(['companionLinks', 1, 'url'])
  const location = locations.get(locationPath)
  assert.ok(location)
  assert.ok(locations instanceof Map)
  assert.throws(() => { location.line = 999 }, TypeError)
  locations.clear()
  locations.set(locationPath, { line: 999, column: 1 })
  assert.deepEqual(validation.metadataLocations.get(locationPath), location)
  assert.equal(Object.keys(validation).includes('metadataLocations'), false)
  assert.equal(Object.keys(validation).includes('sourceSha256'), false)

  document.diagnostics[0].severity = 'error'
  assert.deepEqual(document.diagnostics, originalDiagnostics)
  assert.equal(document.getMetadata('challenge.title'), originalTitle)
  assert.deepEqual(document.getBlock('compiler-rich-teaching'), originalBlock)
  assert.equal(document.status, 'valid')
  assert.equal(document.dirty, false)
  assert.equal(document.serialize(), source)
  assert.equal(document.validate().sourceSha256, sha256(source))
  assert.deepEqual(compileValidatedBerryMark(validation, { source }), expected)

  document.setMetadata('challenge.title', 'Authorized title')
  assert.equal(document.getMetadata('challenge.title'), 'Authorized title')
  assert.equal(document.dirty, true)
  assert.equal(validation.document.metadata.challenge.title, originalTitle)
  assert.equal(validation.sourceSha256, sha256(source))
})

test('editing gates are unaffected by externally modified diagnostics', () => {
  const source = sourceWith(cb1() + cb1())
  const document = openBerryMarkDocument(source)
  assert.equal(document.status, 'unsupported')
  for (const item of document.diagnostics) item.severity = 'info'
  assert.ok(document.diagnostics.some(item => item.code === 'BM_ID_DUPLICATE' && item.severity === 'error'))
  assert.equal(document.status, 'unsupported')
  assert.throws(() => document.setMetadata('challenge.title', 'Disallowed edit'),
    error => error.code === 'BM_STUDIO_READ_ONLY')
  assert.equal(document.dirty, false)
  assert.equal(document.serialize(), source)
})

test('edits change the exact source SHA-256 and compiler content fingerprint', () => {
  const baseline = compileBerryMark(allBlocksSource)
  const document = openBerryMarkDocument(allBlocksSource)
  document.updateBlock('compiler-rich-teaching', { body: 'Edited teaching with a different fingerprint.' })
  const source = document.serialize()
  const compilation = compileValidatedBerryMark(document.validate(), { source })
  assert.equal(compilation.ok, true, JSON.stringify(compilation.diagnostics))
  assert.notEqual(compilation.reviewReport.source.sha256, baseline.reviewReport.source.sha256)
  assert.equal(compilation.reviewReport.source.sha256, sha256(source))
  assert.notEqual(candidateSha256(compilation, schemaSnapshot), candidateSha256(baseline, schemaSnapshot))
})

test('moving semantic blocks preserves their compiler keys while changing ordered content', () => {
  const document = openBerryMarkDocument(allBlocksSource)
  const before = compileBerryMark(allBlocksSource)
  document.moveBlock('compiler-statement', 'compiler-fixture-screen', 0)
  const after = compileBerryMark(document.serialize())
  assert.equal(after.ok, true, JSON.stringify(after.diagnostics))
  assert.equal(after.sanityCandidate.screens[0].blocks[0]._key, 'compiler-statement')
  assert.notEqual(candidateSha256(after, schemaSnapshot), candidateSha256(before, schemaSnapshot))
})

test('approved-source edits emit stale review state that survives explicit save and reopen', () => {
  const document = openBerryMarkDocument(allBlocksSource)
  document.setMetadata('editorial.approvalStatus', 'approved')
  document.setMetadata('editorial.approvedBy', 'Alexis Waid')
  document.setMetadata('editorial.approvedAt', '2026-11-20T12:00:00Z')
  assert.equal(document.reviewDiagnostics.length, 0)
  document.updateBlock('compiler-rich-teaching', { body: 'Edited after the authored approval claim.' })
  assert.equal(document.reviewDiagnostics.length, 1)
  assert.equal(document.reviewDiagnostics[0].code, 'BM_STUDIO_APPROVAL_STALE')

  const savedSource = document.serialize()
  const savedReviewState = document.serializeReviewState()
  const reopened = openBerryMarkDocument(savedSource, { reviewState: savedReviewState })
  assert.equal(reopened.reviewDiagnostics[0].code, 'BM_STUDIO_APPROVAL_STALE')
  assert.equal(reopened.getMetadata('editorial.approvalStatus'), 'approved')
  const compilation = compileBerryMark(reopened.serialize())
  assert.equal(compilation.sanityCandidate.editorialReview.adaptationReviewed, false)
  assert.equal(compilation.reviewReport.publicationReady, false)
  assert.throws(() => openBerryMarkDocument(allBlocksSource, { reviewState: savedReviewState }), error => error.code === 'BM_STUDIO_REVIEW_STATE_MISMATCH')
})

test('stale approval survives a pending save and reopen followed by reapproval in metadata', () => {
  const document = openBerryMarkDocument(allBlocksSource)
  document.setMetadata('editorial.approvalStatus', 'approved')
  document.setMetadata('editorial.approvedBy', 'Alexis Waid')
  document.setMetadata('editorial.approvedAt', '2026-11-20T12:00:00Z')
  document.updateBlock('compiler-rich-teaching', { body: 'Revision requiring human review.' })
  document.setMetadata('editorial.approvalStatus', 'pending')
  const savedSource = document.serialize()
  const reviewState = document.serializeReviewState()
  const stale = document.reviewDiagnostics
  assert.deepEqual(stale.map(item => item.code), ['BM_STUDIO_APPROVAL_STALE'])

  const reopened = openBerryMarkDocument(savedSource, { reviewState })
  assert.equal(reopened.getMetadata('editorial.approvalStatus'), 'pending')
  assert.deepEqual(reopened.reviewDiagnostics, stale)
  assert.equal(reopened.serializeReviewState(), reviewState)

  reopened.setMetadata('editorial.approvalStatus', 'approved')
  assert.equal(reopened.getMetadata('editorial.approvalStatus'), 'approved')
  assert.deepEqual(reopened.reviewDiagnostics, stale)
  const compilation = compileValidatedBerryMark(reopened.validate(), { source: reopened.serialize() })
  assert.equal(compilation.ok, true)
  assert.equal(compilation.sanityCandidate.editorialReview.adaptationReviewed, false)
  assert.equal(compilation.reviewReport.publicationReady, false)
})

test('source-only reopen neither invents edit history nor transfers an approval certification', () => {
  const document = openBerryMarkDocument(allBlocksSource)
  document.setMetadata('editorial.approvalStatus', 'approved')
  document.setMetadata('editorial.approvedBy', 'Alexis Waid')
  document.setMetadata('editorial.approvedAt', '2026-11-20T12:00:00Z')
  document.updateBlock('compiler-rich-teaching', { body: 'Revision requiring human review.' })
  const reopened = openBerryMarkDocument(document.serialize())
  assert.equal(reopened.reviewDiagnostics.length, 0)
  assert.equal(reopened.getMetadata('editorial.approvalStatus'), 'approved')
  const compilation = compileBerryMark(reopened.serialize())
  assert.equal(compilation.sanityCandidate.editorialReview.adaptationReviewed, false)
  assert.equal(compilation.reviewReport.publicationReady, false)
})

test('synthetic all-block construction validates, compiles, and round-trips without changing identity', () => {
  const document = createBerryMarkDocument({
    metadata: openBerryMarkDocument(allBlocksSource).getMetadata(),
    screens: [{ id: 'constructed-all-blocks', label: 'Synthetic', heading: 'All nine blocks', blocks: constructionSpecs }]
  })
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
  assert.deepEqual(blockTypes(document), constructionSpecs.map(spec => spec.type))
  const source = document.serialize()
  const compilation = compileValidatedBerryMark(document.validate(), { source })
  assert.equal(compilation.ok, true, JSON.stringify(compilation.diagnostics))
  assert.deepEqual(compilation.sanityCandidate.screens[0].blocks.map(block => block._key), constructionSpecs.map(spec => spec.id))
  assert.deepEqual(compileBerryMark(openBerryMarkDocument(source).serialize()), compilation)
})

test('screen and block insertion, header updates, and removal restore unrelated source exactly', () => {
  const document = openBerryMarkDocument(allBlocksSource)
  document.updateScreen('compiler-fixture-screen', { label: 'Updated label', heading: 'Updated heading with more text' })
  assert.equal(document.getScreen('compiler-fixture-screen').label, 'Updated label')
  assert.equal(document.getScreen('compiler-fixture-screen').heading, 'Updated heading with more text')
  const checkpoint = document.serialize()

  document.addBlock('compiler-fixture-screen', { type: 'CB1', id: 'temporary-block', body: 'Temporary body.' }, 0)
  assert.equal(document.getScreen('compiler-fixture-screen').blocks[0].id, 'temporary-block')
  document.removeBlock('temporary-block')
  assert.equal(document.getBlock('temporary-block'), null)

  document.addScreen({ id: 'temporary-screen', label: 'Temporary', blocks: [{ type: 'CB1', id: 'temporary-screen-block', body: 'Temporary.' }] })
  assert.equal(document.listScreens().at(-1).id, 'temporary-screen')
  document.removeScreen('temporary-screen')
  assert.equal(document.getScreen('temporary-screen'), null)
  assert.equal(document.serialize(), checkpoint)
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
})

test('multiline plain-field edits remain localized and preserve literal field-looking content', () => {
  const source = sourceWith('[[CB3 id=multiline-statement]]\nLabel: Keep\nText: |\n  First line.\n  Text: Literal second line.\n[[/CB3]]\n')
  const document = openBerryMarkDocument(source)
  document.updateBlock('multiline-statement', { fields: { Text: 'Replacement first line.\nText: Replacement literal line.', Label: 'Kept label' } })
  assert.deepEqual(document.getBlock('multiline-statement').fields, {
    Label: 'Kept label',
    Text: 'Replacement first line.\nText: Replacement literal line.'
  })
  assert.ok(document.serialize().includes('Text: |\n  Replacement first line.\n  Text: Replacement literal line.\n[[/CB3]]'))
  assert.equal(document.status, 'valid', JSON.stringify(document.diagnostics))
})

test('generated semantic IDs are deterministic, collision-safe, and never positional', () => {
  const document = openBerryMarkDocument(allBlocksSource)
  const first = document.addBlock('compiler-fixture-screen', { type: 'CB1', idHint: 'Repeated Teaching', body: 'First.' })
  const second = document.addBlock('compiler-fixture-screen', { type: 'CB1', idHint: 'Repeated Teaching', body: 'Second.' })
  assert.equal(first, 'repeated-teaching')
  assert.equal(second, 'repeated-teaching-2')
  document.moveBlock(second, 'compiler-fixture-screen', 0)
  assert.equal(document.getScreen('compiler-fixture-screen').blocks[0].id, second)
  assert.throws(() => document.addBlock('compiler-fixture-screen', { type: 'CB1', id: 'not valid', body: 'Invalid ID.' }), error => error.code === 'BM_STUDIO_ID_INVALID')
})
