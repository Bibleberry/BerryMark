import { compileValidatedBerryMark } from '../src/compiler.js'
import { createBerryMarkDocument } from '../src/studio/document-engine.js'

const metadata = {
  berrymark: '0.1',
  challenge: {
    title: 'BM-TEST Studio construction demonstration',
    slug: 'bm-test-studio-construction',
    type: 'teaching',
    summary: 'Synthetic source-preserving editor demonstration'
  },
  publishing: {
    series: 'bm-test-series',
    sequence: 1,
    releaseAt: '2026-11-04T12:00:00Z'
  },
  scripture: {
    reference: 'John 11:35',
    translation: 'BM-TEST',
    textStatus: 'referenceOnly',
    usageRightsConfirmed: false,
    practiceStatus: 'notConfigured'
  },
  editorial: {
    sourceTitle: 'BM-TEST Studio source',
    sourceAuthor: 'BerryMark test fixture',
    sourceRevision: 'bm-test-studio-revision-1',
    approvalStatus: 'pending',
    approvedBy: null,
    approvedAt: null
  },
  companionLinks: []
}

const blocks = [
  { type: 'CB1', id: 'demo-teaching', body: 'Synthetic **rich teaching** with Unicode 🌿.' },
  {
    type: 'CB2', id: 'demo-scripture', fields: {
      Reference: 'John 11:35', Translation: 'BM-TEST', 'Text Status': 'referenceOnly',
      'Usage Rights Confirmed': false, 'Practice Status': 'notConfigured'
    }
  },
  { type: 'CB3', id: 'demo-statement', fields: { Label: 'Synthetic', Text: 'Exact **plain** statement text.' } },
  {
    type: 'CB4', id: 'demo-comparison',
    left: { title: 'Left', body: 'Synthetic left **body**.' },
    right: { title: 'Right', body: 'Synthetic right *body*.' },
    footer: 'Synthetic plain footer.'
  },
  {
    type: 'CB5', id: 'demo-cards', cards: [
      { id: 'demo-card-one', fields: { Title: 'One', Body: 'First synthetic card.' } },
      { id: 'demo-card-two', fields: { Title: 'Two' } }
    ]
  },
  {
    type: 'CB6', id: 'demo-sequence',
    fields: { Cycle: true, 'Return Caption': 'Return to one', Conclusion: 'Synthetic conclusion.' },
    steps: [
      { id: 'demo-step-one', fields: { Title: 'One', Body: 'First synthetic step.' } },
      { id: 'demo-step-two', fields: { Title: 'Two', Body: 'Second synthetic step.' } }
    ]
  },
  {
    type: 'CB7', id: 'demo-reflection', fields: { Question: 'Synthetic reflection?', Closing: 'Optional closing.' },
    choices: [
      { id: 'demo-choice-one', fields: { Label: 'One', Prompt: 'First synthetic prompt.' } },
      { id: 'demo-choice-two', fields: { Label: 'Two', Prompt: 'Second synthetic prompt.' } }
    ]
  },
  {
    type: 'CB8', id: 'demo-study', title: 'Synthetic study', body: 'Synthetic study **body**.',
    scriptures: [{
      id: 'demo-study-scripture', fields: {
        Reference: 'John 11:35', Translation: 'BM-TEST', 'Text Status': 'referenceOnly',
        'Usage Rights Confirmed': false, 'Practice Status': 'notConfigured'
      }
    }]
  },
  { type: 'CB9', id: 'demo-prayer', text: 'First synthetic prayer paragraph.\n\nSecond synthetic *plain* paragraph.' }
]

const document = createBerryMarkDocument({
  metadata,
  screens: [{ id: 'demo-screen', label: 'Demo', heading: 'Synthetic all-block construction', blocks }],
  filename: 'examples/studio-document-engine-demo.berry.md'
})

if (!document.valid) {
  throw new Error(`Synthetic demonstration is invalid: ${JSON.stringify(document.diagnostics)}`)
}

const source = document.serialize()
const compilation = compileValidatedBerryMark(document.validate(), { source })
if (!compilation.ok) {
  throw new Error(`Synthetic demonstration did not compile: ${JSON.stringify(compilation.diagnostics)}`)
}

process.stdout.write(`${JSON.stringify({
  demonstration: 'BerryMark Studio Build 01 synthetic all-block construction',
  source,
  reviewState: document.serializeReviewState(),
  compilation
}, null, 2)}\n`)
