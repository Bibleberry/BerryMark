import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compileBerryMark } from '../src/compiler.js'

const snapshot = JSON.parse(readFileSync(new URL('./bibleberry-schema-v0.1.snapshot.json', import.meta.url), 'utf8'))

function assertShape(value, expectedType, incomplete = new Set()) {
  assert.equal(value._type, expectedType)
  const schema = snapshot.objects[expectedType]
  assert.ok(schema, `Snapshot contains ${expectedType}`)
  for (const key of Object.keys(value)) assert.ok(schema.fields.includes(key), `${expectedType}.${key} is schema-compatible`)
  for (const key of schema.required) {
    if (expectedType === 'challenge' && incomplete.has(key)) continue
    assert.ok(Object.hasOwn(value, key), `${expectedType}.${key} is present`)
  }
}

function assertPortableText(body) {
  assert.ok(Array.isArray(body) && body.length > 0)
  for (const block of body) {
    assert.deepEqual(Object.keys(block).sort(), ['_key', '_type', 'children', 'markDefs', ...(block.listItem ? ['level', 'listItem'] : []), 'style'].sort())
    assert.equal(block._type, 'block')
    assert.ok(['normal', 'h2', 'h3', 'blockquote'].includes(block.style))
    if (block.listItem) {
      assert.ok(['bullet', 'number'].includes(block.listItem))
      assert.equal(block.level, 1)
    }
    for (const definition of block.markDefs) {
      assert.deepEqual(Object.keys(definition).sort(), ['_key', '_type', 'href'])
      assert.equal(definition._type, 'link')
      assert.match(definition.href, /^https?:\/\//)
    }
    for (const span of block.children) {
      assert.deepEqual(Object.keys(span).sort(), ['_key', '_type', 'marks', 'text'])
      assert.equal(span._type, 'span')
      assert.equal(typeof span.text, 'string')
      for (const mark of span.marks) {
        assert.ok(['strong', 'em'].includes(mark) || block.markDefs.some(definition => definition._key === mark))
      }
    }
  }
}

function assertCandidate(candidate, report) {
  const incomplete = new Set(report.compatibility.missingRequiredFields)
  assertShape(candidate, 'challenge', incomplete)
  assertShape(candidate.primaryScripture, 'scriptureReference')
  assertShape(candidate.editorialReview, 'editorialReview')
  assert.ok(candidate.screens.length > 0)
  for (const screen of candidate.screens) {
    assertShape(screen, 'challengeScreen')
    assert.ok(screen.blocks.length > 0)
    for (const block of screen.blocks) {
      assertShape(block, block._type)
      if (block._type === 'richTextBlock') assertPortableText(block.body)
      if (block._type === 'scriptureBlock') assertShape(block.scripture, 'scriptureReference')
      if (block._type === 'comparisonBlock') {
        assertShape(block.left, 'comparisonSide')
        assertShape(block.right, 'comparisonSide')
        assertPortableText(block.left.body)
        assertPortableText(block.right.body)
      }
      if (block._type === 'visualCardsBlock') block.cards.forEach(card => assertShape(card, 'visualCard'))
      if (block._type === 'connectedSequenceBlock') block.steps.forEach(step => assertShape(step, 'sequenceStep'))
      if (block._type === 'reflectionBlock') block.choices?.forEach(choice => assertShape(choice, 'reflectionChoice'))
      if (block._type === 'optionalStudyBlock') {
        assertPortableText(block.body)
        block.scriptures?.forEach(reference => assertShape(reference, 'scriptureReference'))
      }
      if (block._type === 'prayerBlock') assert.ok(block.paragraphs.every(value => typeof value === 'string'))
    }
  }
  candidate.companionLinks?.forEach(link => assertShape(link, 'companionLink'))
}

for (const [name, path] of [
  ['synthetic all-block candidate', '../examples/compiler-all-blocks.berry.md'],
  ['partial Rejoice Always candidate', '../examples/rejoice-always/rejoice-always.berry.md']
]) {
  test(`${name} matches the documented Bibleberry schema snapshot in all supplied portions`, () => {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    const result = compileBerryMark(source, { filename: path })
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics))
    assert.equal(result.reviewReport.compatibility.targetRevision, snapshot.revision)
    assertCandidate(result.sanityCandidate, result.reviewReport)
    if (name.startsWith('partial')) {
      assert.equal(result.reviewReport.schemaComplete, false)
      assert.deepEqual([...incompleteRequired(result)].sort(), ['releaseAt', 'sequence', 'series'])
    }
  })
}

function incompleteRequired(result) {
  return result.reviewReport.compatibility.missingRequiredFields
}
