import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { parseBerryMark } from '../src/parser.js'
import { compileBerryMark, compileValidatedBerryMark } from '../src/compiler.js'

const fixturePath = new URL('../examples/compiler-all-blocks.berry.md', import.meta.url)
const rejoicePath = new URL('../examples/rejoice-always/rejoice-always.berry.md', import.meta.url)
const fixtureSource = readFileSync(fixturePath, 'utf8')
const rejoiceSource = readFileSync(rejoicePath, 'utf8')
const compile = (source, filename = 'compiler-test.berry.md') => compileBerryMark(source, { filename })
const fixture = () => compile(fixtureSource, 'compiler-all-blocks.berry.md')
const validYaml = `berrymark: "0.1"
challenge:
  title: "Synthetic Challenge"
  slug: synthetic-challenge
  type: teaching
  summary: null
publishing:
  series: null
  sequence: null
  releaseAt: null
scripture:
  reference: "John 11:35"
  translation: BM-TEST
  textStatus: referenceOnly
  usageRightsConfirmed: false
  practiceStatus: notConfigured
editorial:
  sourceTitle: "Synthetic Source"
  sourceAuthor: "Synthetic Author"
  sourceRevision: null
  approvalStatus: pending
  approvedBy: null
  approvedAt: null
companionLinks: []`
const wrap = (body, yaml = validYaml) => `---\n${yaml}\n---\n${body}`
const screen = (blocks, header = 'Label: Test\n# Synthetic screen') => `[[SCREEN id=synthetic-screen]]\n${header}\n${blocks}\n[[/SCREEN]]`
const cb1 = (text = 'Synthetic teaching.', id = 'synthetic-teaching') => `[[CB1 id=${id}]]\n${text}\n[[/CB1]]`
const success = (blocks, yaml) => {
  const body = screen(blocks, '').replace('[[SCREEN id=synthetic-screen]]\n\n', '[[SCREEN id=synthetic-screen]]\n')
  return compile(wrap(body, yaml))
}
const codes = result => result.diagnostics.map(item => item.code)
const portableText = blocks => blocks.map(block => block.children.map(span => span.text).join('')).join('\n\n')

test('all nine CB types map in source order with semantic structural keys', () => {
  const result = fixture()
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics))
  const candidate = result.sanityCandidate
  const screen = candidate.screens[0]
  assert.equal(candidate._type, 'challenge')
  assert.equal(screen._type, 'challengeScreen')
  assert.equal(screen._key, 'compiler-fixture-screen')
  assert.deepEqual(screen.blocks.map(block => block._type), [
    'richTextBlock', 'scriptureBlock', 'statementBlock', 'comparisonBlock',
    'visualCardsBlock', 'connectedSequenceBlock', 'reflectionBlock',
    'optionalStudyBlock', 'prayerBlock'
  ])
  assert.deepEqual(screen.blocks.map(block => block._key), [
    'compiler-rich-teaching', 'compiler-scripture', 'compiler-statement',
    'compiler-comparison', 'compiler-cards', 'compiler-sequence',
    'compiler-reflection', 'compiler-study', 'compiler-prayer'
  ])
  assert.equal(Object.hasOwn(candidate, '_id'), false)
  assert.equal(result.reviewReport.importReady, false)
  assert.equal(result.reviewReport.publicationReady, false)
})

test('Markdown AST conversion preserves approved blocks, marks, links, breaks, and Unicode', () => {
  const result = fixture()
  const body = result.sanityCandidate.screens[0].blocks[0].body
  assert.deepEqual(body.filter(block => block.style === 'h2' || block.style === 'h3').map(block => block.style), ['h2', 'h3'])
  assert.equal(body.find(block => block.style === 'blockquote').children.at(-1).text, '.')
  assert.deepEqual(body.filter(block => block.listItem).map(block => [block.listItem, block.level]), [
    ['bullet', 1], ['bullet', 1], ['number', 1], ['number', 1]
  ])
  const rich = body[1]
  assert.ok(rich.children.some(span => span.marks.includes('strong')))
  assert.ok(rich.children.some(span => span.marks.includes('em')))
  assert.ok(rich.children.some(span => span.marks.includes('strong') && span.marks.includes('em')))
  const linked = rich.children.find(span => span.text === 'an HTTPS link')
  assert.deepEqual(linked.marks, [rich.markDefs[0]._key])
  assert.deepEqual(rich.markDefs[0], { _type: 'link', _key: rich.markDefs[0]._key, href: 'https://example.com/teaching' })
  assert.match(portableText(body), /Unicode 🌿 中文/)
  assert.match(portableText(body), /representable break\.\nThe next line/)
  assert.match(portableText(body), /Title: This field-looking sentence remains literal prose\./)
  for (const block of body) {
    assert.equal(block._type, 'block')
    assert.ok(block._key)
    assert.ok(block.children.every(span => span._type === 'span' && span._key && typeof span.text === 'string'))
  }
})

test('CB2 and primary Scripture share the exact scriptureReference shape without passage invention', () => {
  const result = fixture()
  const candidate = result.sanityCandidate
  const scripture = candidate.screens[0].blocks[1].scripture
  for (const value of [candidate.primaryScripture, scripture]) {
    assert.equal(value._type, 'scriptureReference')
    assert.equal(value.textStatus, 'referenceOnly')
    assert.equal(value.usageRightsConfirmed, false)
    assert.equal(value.practiceStatus, 'notConfigured')
    assert.equal(Object.hasOwn(value, 'passage'), false)
  }
  assert.equal(Object.hasOwn(scripture, '_key'), false)
})

test('CB3 remains a separate plain-text statement and never duplicates into CB1', () => {
  const result = fixture()
  const blocks = result.sanityCandidate.screens[0].blocks
  const statement = blocks[2]
  assert.equal(statement.text, 'Preserve **literal marker characters** as plain statement text.')
  assert.equal(statement.label, 'BM-TEST statement')
  assert.equal(blocks.filter(block => block._type === 'statementBlock').length, 1)
  assert.doesNotMatch(portableText(blocks[0].body), /literal marker characters/)
})

test('CB4 maps comparisonSide Portable Text, literal footer, and proposed review', () => {
  const block = fixture().sanityCandidate.screens[0].blocks[3]
  assert.equal(block.left._type, 'comparisonSide')
  assert.equal(block.right._type, 'comparisonSide')
  assert.equal(block.left.title, 'BM-TEST left')
  assert.equal(portableText(block.left.body), 'Left body with strong formatting.')
  assert.equal(block.left.body[0].children[1].marks[0], 'strong')
  assert.equal(portableText(block.right.body), 'Right body with emphasis.')
  assert.equal(block.footer, 'Footer remains exact plain text, including *literal asterisks*.')
  assert.equal(block.reviewStatus, 'proposed')
})

test('CB5 cards preserve order, IDs, required titles, and genuinely optional bodies', () => {
  const block = fixture().sanityCandidate.screens[0].blocks[4]
  assert.deepEqual(block.cards.map(card => [card._type, card._key]), [
    ['visualCard', 'compiler-card-full'], ['visualCard', 'compiler-card-title-only']
  ])
  assert.equal(block.cards[0].body, 'Card body remains plain text.')
  assert.equal(Object.hasOwn(block.cards[1], 'body'), false)
  assert.equal(block.reviewStatus, 'proposed')
})

test('CB6 maps cycle fields, conclusion, ordered steps, and proposed review', () => {
  const block = fixture().sanityCandidate.screens[0].blocks[5]
  assert.equal(block.cycle, true)
  assert.equal(block.returnCaption, 'Return to the synthetic first step')
  assert.equal(block.conclusion, 'Synthetic sequence conclusion.')
  assert.deepEqual(block.steps.map(step => [step._type, step._key]), [
    ['sequenceStep', 'compiler-step-one'], ['sequenceStep', 'compiler-step-two']
  ])
  assert.equal(block.reviewStatus, 'proposed')
})

test('CB7 maps optional choices and closing without completion gates', () => {
  const block = fixture().sanityCandidate.screens[0].blocks[6]
  assert.equal(block.question, 'BM-TEST optional reflection?')
  assert.deepEqual(block.choices.map(choice => [choice._type, choice._key]), [
    ['reflectionChoice', 'compiler-choice-one'], ['reflectionChoice', 'compiler-choice-two']
  ])
  assert.equal(block.closing, 'Optional reflection closing.')
  assert.equal(block.reviewStatus, 'proposed')
  assert.equal(Object.hasOwn(block, 'required'), false)
  assert.equal(Object.hasOwn(block, 'completionRequired'), false)
})

test('CB8 keeps rich body separate from keyed nested Scripture references', () => {
  const block = fixture().sanityCandidate.screens[0].blocks[7]
  assert.equal(block.reviewStatus, 'proposed')
  assert.match(portableText(block.body), /Study body with HTTPS reference and strong text\./)
  assert.equal(block.body[0].markDefs[0].href, 'https://example.com/study')
  assert.deepEqual(block.scriptures.map(item => item._key), ['compiler-study-reference-only', 'compiler-study-provided'])
  assert.equal(block.scriptures[1].passage, 'Rights-safe synthetic passage written only for this fixture.')
  assert.equal(block.scriptures[1].usageRightsConfirmed, true)
  assert.equal(block.scriptures[1].practiceStatus, 'configured')
  assert.doesNotMatch(portableText(block.body), /Rights-safe synthetic passage|Reference: John/)
})

test('CB9 preserves exact plain-text prayer paragraphs without Markdown conversion', () => {
  const block = fixture().sanityCandidate.screens[0].blocks[8]
  assert.deepEqual(block.paragraphs, [
    'BM-TEST first authored prayer paragraph with *literal plain-text markers*.',
    'BM-TEST second authored prayer paragraph, preserved exactly.'
  ])
  assert.equal(block.paragraphs.every(paragraph => typeof paragraph === 'string'), true)
})

test('all CB4–CB8 controlled states are explicit in the review report', () => {
  const result = fixture()
  const proposed = result.reviewReport.controlledMappings.filter(item => item.code === 'BM_REVIEW_STATE_PROPOSED')
  assert.deepEqual(proposed.map(item => item.target), [
    'compiler-comparison', 'compiler-cards', 'compiler-sequence', 'compiler-reflection', 'compiler-study'
  ])
  assert.ok(proposed.every(item => item.value === 'proposed'))
  assert.ok(result.reviewReport.controlledMappings.some(item => item.code === 'BM_ADAPTATION_REVIEW_NOT_TRANSFERRED' && item.value === false))
})

test('metadata maps exactly and source fingerprint is deterministic SHA-256', () => {
  const result = fixture()
  const candidate = result.sanityCandidate
  assert.equal(candidate.title, 'BM-TEST Complete Compiler Fixture')
  assert.deepEqual(candidate.slug, { _type: 'slug', current: 'bm-test-compiler-all-blocks' })
  assert.equal(candidate.challengeType, 'teaching')
  assert.equal(candidate.summary, 'Synthetic rights-safe compiler demonstration')
  assert.equal(candidate.sequence, 1)
  assert.equal(candidate.releaseAt, '2026-11-04T12:00:00Z')
  assert.equal(candidate.editorialReview.sourceTitle, 'BM-TEST Compiler Fixture')
  assert.equal(candidate.editorialReview.sourceRevision, 'bm-test-revision-1')
  assert.equal(candidate.editorialReview.adaptationReviewed, false)
  assert.equal(result.reviewReport.source.sha256, createHash('sha256').update(fixtureSource).digest('hex'))
  assert.equal(result.reviewReport.source.revision, 'bm-test-revision-1')
})

test('series slug stays a pending lookup and never becomes a fabricated reference', () => {
  const result = fixture()
  assert.equal(Object.hasOwn(result.sanityCandidate, 'series'), false)
  assert.equal(result.reviewReport.schemaComplete, false)
  assert.deepEqual(result.reviewReport.compatibility.missingRequiredFields, ['series'])
  assert.deepEqual(result.reviewReport.pendingLookups, [{
    type: 'challengeSeriesSlug',
    slug: 'bm-test-series',
    sourcePath: 'publishing.series',
    destinationPath: 'series',
    status: 'unresolved',
    reason: 'A series slug is not a Sanity document ID; offline compilation cannot create a truthful _ref'
  }])
  assert.ok(codes(result).includes('BM_SERIES_LOOKUP_REQUIRED'))
})

test('absent and explicit null optional metadata remain distinct in the sidecar', () => {
  const absentYaml = validYaml.replace('  releaseAt: null\n', '').replace('companionLinks: []', 'companionLinks:\n  - provider: other\n    label: "No URL"')
  const result = success(cb1(), absentYaml)
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics))
  assert.equal(result.reviewReport.metadataStates['publishing.releaseAt'].state, 'absent')
  assert.equal(result.reviewReport.metadataStates['publishing.series'].state, 'null')
  assert.equal(result.reviewReport.metadataStates['companionLinks[0].url'].state, 'absent')
  assert.equal(Object.hasOwn(result.sanityCandidate, 'releaseAt'), false)
  assert.equal(Object.hasOwn(result.sanityCandidate.companionLinks[0], 'url'), false)
  const explicitNull = compile(rejoiceSource)
  assert.equal(explicitNull.reviewReport.metadataStates['publishing.releaseAt'].state, 'null')
  assert.equal(explicitNull.reviewReport.metadataStates['companionLinks[0].url'].state, 'null')
})

test('approved source claims remain truthful in the sidecar without Sanity approval transfer', () => {
  const yaml = validYaml
    .replace('approvalStatus: pending', 'approvalStatus: approved')
    .replace('approvedBy: null', 'approvedBy: "Synthetic Reviewer"')
    .replace('approvedAt: null', 'approvedAt: "2026-11-04T12:00:00Z"')
  const result = success(cb1(), yaml)
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics))
  assert.equal(result.reviewReport.authoredMetadata.editorial.approvalStatus, 'approved')
  assert.equal(result.reviewReport.authoredMetadata.editorial.approvedBy, 'Synthetic Reviewer')
  assert.equal(result.sanityCandidate.editorialReview.adaptationReviewed, false)
  assert.equal(Object.hasOwn(result.sanityCandidate.editorialReview, 'reviewedBy'), false)
  assert.equal(Object.hasOwn(result.sanityCandidate.editorialReview, 'reviewedAt'), false)
  assert.ok(codes(result).includes('BM_REVIEW_TRANSFER_UNRESOLVED'))
})

test('repeated compilation is byte-deterministic and semantic keys survive sibling reorder', () => {
  const firstSource = wrap(screen(`${cb1('First teaching.', 'first-teaching')}\n${cb1('Second teaching.', 'second-teaching')}`))
  const reorderedSource = wrap(screen(`${cb1('Second teaching.', 'second-teaching')}\n${cb1('First teaching.', 'first-teaching')}`))
  const first = compile(firstSource)
  const reordered = compile(reorderedSource)
  assert.deepEqual(compile(firstSource), first)
  const firstKeys = Object.fromEntries(first.sanityCandidate.screens[0].blocks.map(block => [block._key, block.body[0]._key]))
  const reorderedKeys = Object.fromEntries(reordered.sanityCandidate.screens[0].blocks.map(block => [block._key, block.body[0]._key]))
  assert.deepEqual(reorderedKeys, firstKeys)
  assert.deepEqual(reordered.sanityCandidate.screens[0].blocks.map(block => block._key), ['second-teaching', 'first-teaching'])
})

test('generated Portable Text keys disambiguate duplicates and churn only with edited content', () => {
  const original = compile(wrap(screen(cb1('Repeated text.\n\nRepeated text.'))))
  const edited = compile(wrap(screen(cb1('Repeated text.\n\nEdited text.'))))
  const originalBody = original.sanityCandidate.screens[0].blocks[0].body
  const editedBody = edited.sanityCandidate.screens[0].blocks[0].body
  assert.notEqual(originalBody[0]._key, originalBody[1]._key)
  assert.equal(originalBody[0]._key, editedBody[0]._key)
  assert.notEqual(originalBody[1]._key, editedBody[1]._key)
  const companion = fixture().sanityCandidate.companionLinks[0]
  const changed = compile(fixtureSource.replace('https://example.com/berrymark', 'https://example.com/changed'))
  assert.notEqual(changed.sanityCandidate.companionLinks[0]._key, companion._key)
})

test('identical companion-link content fails collision detection without a candidate', () => {
  const yaml = validYaml.replace('companionLinks: []', `companionLinks:
  - provider: other
    label: "Duplicate"
    url: "https://example.com"
  - provider: other
    label: "Duplicate"
    url: "https://example.com"`)
  const result = success(cb1(), yaml)
  assert.equal(result.ok, false)
  assert.equal(result.sanityCandidate, null)
  assert.ok(codes(result).includes('BM_KEY_COLLISION'))
})

test('optional zero-choice studies and absent screen headers remain omitted rather than fabricated', () => {
  const blocks = `${cb1()}\n[[CB7 id=plain-reflection]]\nQuestion: Optional question?\nClosing: Optional close.\n[[/CB7]]\n[[CB8 id=plain-study]]\nTitle: Optional study\n\nStudy body.\n[[/CB8]]\n[[CB6 id=plain-sequence]]\nCycle: false\n[[STEP id=plain-step-one]]\nTitle: One\nBody: First.\n[[/STEP]]\n[[STEP id=plain-step-two]]\nTitle: Two\nBody: Second.\n[[/STEP]]\n[[/CB6]]`
  const result = success(blocks)
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics))
  const candidateScreen = result.sanityCandidate.screens[0]
  assert.equal(Object.hasOwn(candidateScreen, 'screenLabel'), false)
  assert.equal(Object.hasOwn(candidateScreen, 'heading'), false)
  const [, reflection, study, sequence] = candidateScreen.blocks
  assert.equal(Object.hasOwn(reflection, 'choices'), false)
  assert.equal(Object.hasOwn(study, 'scriptures'), false)
  assert.equal(sequence.cycle, false)
  assert.equal(Object.hasOwn(sequence, 'returnCaption'), false)
  assert.equal(Object.hasOwn(sequence, 'conclusion'), false)
})

test('invalid validator input is rejected with located diagnostics and no candidate', () => {
  const validation = parseBerryMark('not a BerryMark document', { filename: 'invalid.berry.md' })
  const result = compileValidatedBerryMark(validation, { source: 'not a BerryMark document' })
  assert.equal(result.ok, false)
  assert.equal(result.sanityCandidate, null)
  assert.equal(result.diagnostics[0].code, 'BM_COMPILER_INVALID_INPUT')
  assert.equal(result.diagnostics[0].filename, 'invalid.berry.md')
  assert.equal(result.reviewReport.importReady, false)
  const missingSource = compileValidatedBerryMark(parseBerryMark(wrap(screen(cb1()))))
  assert.equal(missingSource.diagnostics[0].code, 'BM_COMPILER_SOURCE_REQUIRED')
})

test('unsupported or malicious Markdown fails loudly with target, path, and source location', () => {
  const cases = [
    ['table', '| A | B |\n| - | - |\n| 1 | 2 |'],
    ['image', '![alternative](https://example.com/image.png)'],
    ['code fence', '```js\nconst unsafe = true\n```'],
    ['code span', 'Teaching with `code`.'],
    ['HTML', 'Teaching with <span>HTML</span>.'],
    ['heading 1', '# Unsupported heading'],
    ['heading 4', '#### Unsupported heading'],
    ['unsafe link', '[unsafe](javascript:alert(1))'],
    ['relative link', '[relative](/somewhere)'],
    ['nested list', '- parent\n  - child'],
    ['task list', '- [ ] unfinished']
  ]
  for (const [name, markdown] of cases) {
    const result = compile(wrap(screen(cb1(markdown))), `${name}.berry.md`)
    assert.equal(result.ok, false, name)
    assert.equal(result.sanityCandidate, null, name)
    const diagnostic = result.diagnostics.find(item => item.severity === 'error')
    assert.ok(['BM_MARKDOWN_UNSUPPORTED', 'BM_MARKDOWN_LINK'].includes(diagnostic.code), `${name}: ${JSON.stringify(diagnostic)}`)
    assert.equal(diagnostic.target, 'synthetic-teaching', name)
    assert.equal(diagnostic.path, 'screens.synthetic-screen.blocks.synthetic-teaching.body', name)
    assert.ok(diagnostic.line > 1 && diagnostic.column > 0, name)
  }
})

test('incompatible Challenge slugs fail rather than being rewritten', () => {
  const yaml = validYaml.replace('slug: synthetic-challenge', 'slug: "Not A Valid Slug!"')
  const result = success(cb1(), yaml)
  assert.equal(result.ok, false)
  assert.equal(result.sanityCandidate, null)
  assert.ok(codes(result).includes('BM_SLUG_INCOMPATIBLE'))
  assert.equal(result.reviewReport.authoredMetadata.challenge.slug, 'Not A Valid Slug!')
})

test('developer compiler CLI emits JSON and returns nonzero without a success candidate on failure', () => {
  const cli = new URL('../src/compiler-cli.js', import.meta.url).pathname
  const valid = spawnSync(process.execPath, [cli, fixturePath.pathname], { encoding: 'utf8' })
  assert.equal(valid.status, 0, valid.stderr)
  assert.equal(JSON.parse(valid.stdout).reviewReport.counts.contentBlocks, 9)
  const invalid = spawnSync(process.execPath, [cli, new URL('../examples/invalid-duplicate-ids.berry.md', import.meta.url).pathname], { encoding: 'utf8' })
  assert.equal(invalid.status, 1)
  const invalidResult = JSON.parse(invalid.stdout)
  assert.equal(invalidResult.ok, false)
  assert.equal(invalidResult.sanityCandidate, null)
})

test('compiler performs no network or Sanity write path', () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => { throw new Error('Network access forbidden during compilation') }
  try {
    const result = compile(rejoiceSource, 'offline.berry.md')
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics))
    assert.equal(result.reviewReport.counts.screens, 7)
  } finally {
    globalThis.fetch = originalFetch
  }
  for (const file of ['compiler.js', 'portable-text.js', 'keys.js']) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /@sanity|sanityClient|\.create\(|\.patch\(|\.publish\(|process\.env/)
  }
})

test('Rejoice Always compiles with 7/16/3/4/17 and truthful incomplete metadata', () => {
  const result = compile(rejoiceSource, 'rejoice-always.berry.md')
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics))
  assert.deepEqual(result.reviewReport.counts, {
    screens: 7,
    contentBlocks: 16,
    optionalStudies: 3,
    nestedScriptures: 4,
    editorialAnnotations: 17
  })
  assert.equal(result.reviewReport.schemaComplete, false)
  assert.deepEqual(result.reviewReport.compatibility.missingRequiredFields, ['series', 'sequence', 'releaseAt'])
  assert.equal(result.reviewReport.authoredMetadata.editorial.approvalStatus, 'pending')
  assert.equal(result.reviewReport.authoredMetadata.scripture.textStatus, 'referenceOnly')
  assert.equal(Object.hasOwn(result.sanityCandidate.primaryScripture, 'passage'), false)
  assert.equal(result.sanityCandidate.editorialReview.adaptationReviewed, false)
  assert.deepEqual(result.sanityCandidate.companionLinks.map(link => Object.hasOwn(link, 'url')), [false, false])
})

test('Rejoice Always visible wording, order, statements, nested data, and prayer match the validator AST', () => {
  const validation = parseBerryMark(rejoiceSource, { filename: 'rejoice-always.berry.md' })
  const result = compileValidatedBerryMark(validation, { source: rejoiceSource })
  const sourceScreens = validation.document.screens
  const outputScreens = result.sanityCandidate.screens
  assert.deepEqual(outputScreens.map(screen => screen._key), sourceScreens.map(screen => screen.id))
  for (const [screenIndex, sourceScreen] of sourceScreens.entries()) {
    const outputScreen = outputScreens[screenIndex]
    assert.deepEqual(outputScreen.blocks.map(block => block._key), sourceScreen.blocks.map(block => block.id))
    for (const [blockIndex, sourceBlock] of sourceScreen.blocks.entries()) {
      const outputBlock = outputScreen.blocks[blockIndex]
      if (sourceBlock.type === 'CB1') assert.equal(portableText(outputBlock.body), sourceBlock.text)
      if (sourceBlock.type === 'CB3') assert.equal(outputBlock.text, sourceBlock.fields.Text)
      if (sourceBlock.type === 'CB4') {
        assert.equal(portableText(outputBlock.left.body), sourceBlock.left.body)
        assert.equal(portableText(outputBlock.right.body), sourceBlock.right.body)
        assert.equal(outputBlock.footer, sourceBlock.footer)
      }
      if (sourceBlock.type === 'CB5') assert.deepEqual(outputBlock.cards.map(card => [card._key, card.title, card.body]), sourceBlock.cards.map(card => [card.id, card.fields.Title, card.fields.Body]))
      if (sourceBlock.type === 'CB6') assert.deepEqual(outputBlock.steps.map(step => [step._key, step.title, step.body]), sourceBlock.steps.map(step => [step.id, step.fields.Title, step.fields.Body]))
      if (sourceBlock.type === 'CB7') {
        assert.equal(outputBlock.question, sourceBlock.fields.Question)
        assert.equal(outputBlock.closing, sourceBlock.fields.Closing)
      }
      if (sourceBlock.type === 'CB8') {
        assert.equal(outputBlock.title, sourceBlock.title)
        assert.equal(portableText(outputBlock.body), sourceBlock.body)
        assert.deepEqual(outputBlock.scriptures.map(item => item.reference), sourceBlock.scriptures.map(item => item.fields.Reference))
      }
      if (sourceBlock.type === 'CB9') assert.deepEqual(outputBlock.paragraphs, sourceBlock.paragraphs)
    }
  }
  const third = outputScreens[2].blocks
  assert.equal(third[1].text, 'So how can we rejoice in a world filled with so much pain and difficulty?')
  assert.doesNotMatch(portableText(third[0].body), /So how can we rejoice/)
  const fourth = outputScreens[3].blocks
  assert.equal(fourth[2].text, "And that's where our rejoicing comes from.")
  assert.doesNotMatch(portableText(fourth[1].body), /where our rejoicing comes from/)
  assert.match(outputScreens[6].blocks[0].paragraphs[0], /^Lord, help me choose actively|^Lord, help me choose to actively/)
})

test('source editorial comments stay out of every reader-facing field and remain exact in report', () => {
  const result = compile(rejoiceSource)
  const candidateJson = JSON.stringify(result.sanityCandidate)
  assert.doesNotMatch(candidateJson, /EDITORIAL NOTE:|REVIEW REQUIRED:|TODO:/)
  const sourceAnnotations = parseBerryMark(rejoiceSource).document.annotations
  assert.deepEqual(result.reviewReport.editorialItems.map(item => ({ line: item.line, text: item.text })), sourceAnnotations)
  assert.ok(result.reviewReport.editorialItems.every(item => item.status === 'unresolved'))
  assert.equal(result.reviewReport.editorialItems.filter(item => item.kind === 'REVIEW REQUIRED').length, 11)
})
