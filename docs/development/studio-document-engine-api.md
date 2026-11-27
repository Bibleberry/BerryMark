# BerryMark Studio Build 01 — Document Engine API

**Status:** Implemented source-preserving Build 01 API
**Module:** `src/studio/document-engine.js`
**Boundary:** Strings and immutable-by-copy values only. No graphical interface, filesystem access, network access, Sanity mutation, import, approval transfer, or publication behavior.

## Opening and creating documents

```js
import {
  createBerryMarkDocument,
  openBerryMarkDocument
} from '../src/studio/document-engine.js'

const document = openBerryMarkDocument(source, {
  filename: 'manuscript.berry.md'
})
```

`openBerryMarkDocument(source, options)` always retains the supplied source exactly. `filename` defaults to `<memory>` and is included in parser/compiler diagnostics; use the same filename when deterministic compiler results are compared.

The read-only `status` property has three values:

- `valid`: safe targeted editing is available and the existing validator has no blocking errors.
- `incomplete`: safe targeted editing is available, but required fields, required nested items, headers, or other semantic authoring rules remain unresolved.
- `unsupported`: malformed or ambiguous source is read-only. `serialize()` still returns the exact input.

`valid` does **not** mean import-ready, schema-complete, rights-cleared, approved, or publication-ready. `validate()` returns the existing `parseBerryMark` result, including its exact-source SHA-256 binding. `diagnostics` combines structural, parser, and Studio review diagnostics; `reviewDiagnostics` contains only Studio review state.

`createBerryMarkDocument({ metadata, screens, lineEnding, filename })` creates front matter and then uses the same screen/block/nested serializers as incremental edits. `lineEnding` is LF by default and may be CRLF. Semantic nested types are inherited from their parent collections, so a card needs an `id` and `fields`, not a redundant `type: 'CARD'`.

## Reading state

The following methods return copies rather than mutable engine internals:

```js
document.serialize()                 // exact current BerryMark source
document.dirty                       // whether any successful source change occurred
document.eol                         // first detected source newline convention
document.getMetadata()               // complete parsed metadata
document.getMetadata('challenge.title')
document.listScreens()
document.getScreen('screen-id')
document.getBlock('block-id')
document.getNested('nested-id')
```

Missing screen, block, or nested lookups return `null`. Missing metadata values return `undefined`; an entirely invalid metadata mapping can return `null`.

## Metadata edits

```js
document.setMetadata('challenge.title', 'Revised title')
document.setMetadata('publishing.sequence', 2)
document.setMetadata('companionLinks[0].url', 'https://example.com/resource')
document.setMetadata('companionLinks[1]', {
  provider: 'other',
  label: 'Second resource',
  description: null,
  url: null,
  availability: 'Unresolved'
})
document.deleteMetadata('challenge.summary')
```

Only paths already registered in the BerryMark metadata contract are accepted. Values must be finite JSON-compatible data; `undefined`, cyclic values, class instances, and unsupported paths are rejected. Explicit `null` remains distinct from deletion.

Metadata updates use the YAML CST rather than reconstructing front matter from parsed data. Existing comments, quoting, key order, collection style, and unrelated values are retained in the covered fixtures. Inserted values use YAML's standard presentation. A semantically identical `setMetadata()` call and deletion of an absent value are exact no-ops.

**Normalization limit:** YAML may choose quoting or layout for a newly inserted scalar/collection, and changing that same node again may use the library's current presentation. Build 01 does not promise preservation of an alternative style for the specific value being replaced. Unrelated front matter and all body source remain untouched.

## Screen and block edits

```js
const screenId = document.addScreen({
  id: 'response',
  label: 'Response',
  heading: 'Consider the teaching',
  blocks: []
}, 0)

document.updateScreen('response', {
  label: 'Reflection',
  heading: 'A revised heading'
})

const blockId = document.addBlock('response', {
  type: 'CB1',
  id: 'response-teaching',
  body: 'Rich **teaching** text.'
}, 0)

document.updateBlock('response-teaching', {
  body: 'Replacement rich teaching.'
})

document.moveBlock('response-teaching', 'another-screen', 1)
document.moveScreen('response', 2)
document.removeBlock('response-teaching')
document.removeScreen('response')
```

Insertion indexes are zero-based. An omitted block index appends to the destination screen. Moves preserve the exact moved marker/body range and semantic ID; compiler array keys therefore remain stable. Internal HTML comments move with their containing node. A leading comment outside that node stays in place because BerryMark has no unambiguous ownership rule for it.

CB1/CB9 use `text` or `body`; CB8 uses `title` and `body`; CB2/CB3/CB6/CB7 use `fields`; CB4 accepts `left`, `right`, and `footer` section changes. A `null` CB4 section removes it. Compound operations reacquire current structural positions after every sub-edit.

## Nested edits

```js
document.addNested('sequence', {
  type: 'STEP',
  id: 'practice',
  fields: { Title: 'Practice', Body: 'Exact plain-text explanation.' }
})

document.updateNested('sequence', 'practice', {
  fields: { Title: 'Revised title', Body: 'Revised explanation.' }
})
document.moveNested('sequence', 'practice', 0)
document.removeNested('sequence', 'practice')
```

Supported nested types are CB4 `LEFT`/`RIGHT`/`FOOTER`, CB5 `CARD`, CB6 `STEP`, CB7 `CHOICE`, and CB8 `SCRIPTURE`. Repeatable elements are referenced by semantic ID. Singular CB4 sections are referenced by their marker names.

STEP insertion/movement always stays before `Conclusion:`. CHOICE insertion/movement always stays before `Closing:` when choices exist. Removing all choices leaves a valid no-choice Closing phase; adding choices later moves new CHOICE source before that Closing. Singular CB4 insertion uses LEFT → RIGHT → FOOTER order. Semantic incompleteness during a transition, such as one CHOICE or one STEP, remains editable and visible as `incomplete`.

## Rich-body and comment behavior

A valid CB8/LEFT/RIGHT rich header is recognized only when its first nonblank, non-comment content line is `Title: ...`. Later `Title:` lines remain body prose. Adding a missing title inserts the title and required separator before all existing paragraphs; it does not treat the first authored paragraph as a disposable header.

Replacing a body intentionally replaces that body's prose. Full-line HTML editorial comments inside the affected range are retained verbatim and in order. Other blocks, nested Scripture ranges, and unrelated source are not rewritten. Full reserved marker lines supplied as freeform text receive the existing leading-backslash escape.

## Atomic operations and errors

Every public mutation is one transaction. The candidate is re-indexed and reparsed before it is accepted. If any sub-edit, range, type check, ID check, destination index, or resulting structural validation fails, the engine restores the prior source, structural index, validation result, review diagnostics, and dirty state.

```js
const checkpoint = document.serialize()
try {
  document.updateBlock('sequence', {
    fields: { Conclusion: 'Temporary', Unknown: 'Rejected' }
  })
} catch (error) {
  console.log(error.code) // BM_STUDIO_FIELD_UNSUPPORTED
  console.assert(document.serialize() === checkpoint)
}
```

Errors are `BerryMarkEditError` or `StudioSerializationError` instances with a stable `code`. Incomplete semantics allowed by the existing editing profile do not force a rollback; malformed/ambiguous structure does.

## Approval review-state lifecycle

An edit outside `editorial.approvalStatus`, `approvedBy`, and `approvedAt` adds `BM_STUDIO_APPROVAL_STALE` only when the source contained an `approved` claim before and after the edit. The engine does not clear or rewrite that authored claim and does not certify the revised source.

Review state can be saved explicitly as a source-hash-bound JSON string:

```js
const savedSource = document.serialize()
const savedReviewState = document.serializeReviewState()

// A later host application supplies both persisted strings.
const reopened = openBerryMarkDocument(savedSource, {
  filename: 'manuscript.berry.md',
  reviewState: savedReviewState
})
```

A mismatched, malformed, or unsupported review-state string is rejected. No filesystem persistence is implemented by Build 01; the host owns saving both strings.

**Source-only reopening limitation:** `openBerryMarkDocument(savedSource)` cannot infer whether an approved source was edited in an earlier process, so it does not fabricate a stale warning. This is not approval certification. The existing compiler still keeps `editorialReview.adaptationReviewed: false`, retains the source claim only in its review sidecar, and does not make the document publication-ready. Persist `serializeReviewState()` when the stale warning must survive reopening. There is no Build 01 operation that marks a revised document human-approved or clears its stale warning.

## Construction and verification demonstration

Run the synthetic all-block construction demonstration:

```sh
node examples/studio-document-engine-demo.js
node --test test/studio-document-engine.test.js test/studio-demonstration.test.js
```

The demonstration constructs CB1–CB9, validates the exact source, compiles it through the unchanged compiler, and prints inspectable JSON containing source, review state, and compilation. Its automated test executes the script, reopens the source, repeats compilation with the same filename, and compares the complete result.

Run the complete repository verification from the repository root:

```sh
npm test
npm run check
npm run compile > /tmp/compiler-all-blocks.json
npm run compile:rejoice > /tmp/rejoice-always.json
npm audit
```

On a filesystem that cannot create npm executable symlinks, use `npm_config_bin_links=false npm test`; this changes installation mechanics only, not dependencies or repository files. Compiler JSON can be compared with the committed goldens after parsing or with the existing demonstration tests, which perform exact deep comparisons.

## Deliberate limitations

- No Build 02 UI, browser file handling, storage adapter, graphical framework, or server is included.
- No BerryMark grammar, parser diagnostics, compiler goldens, Sanity schema, or integration behavior is changed.
- The parser AST remains semantic rather than lossless; unchanged source is never regenerated from it.
- Mixed existing line endings are preserved. New text uses the first detected newline convention.
- Rich-body replacement is not a paragraph-level diff. Comments are preserved, but their association with individual replaced paragraphs is not inferred.
- Unsupported documents require source-level repair before editing; the engine does not guess a recovery for malformed markers, duplicate IDs, unsafe YAML, or unknown fields.

Actual counts, commands, environment notes, and unverified surfaces are recorded in [studio-document-engine-build-01-verification.md](studio-document-engine-build-01-verification.md).
