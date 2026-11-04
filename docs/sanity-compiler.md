# BerryMark v0.1 Pure Sanity JSON Compiler

**Status:** Experimental, deterministic, read-only compiler. It produces local candidate JSON and a separate review report. It does not contact Sanity, resolve references, create drafts, verify Scripture licenses, transfer editorial approval, preview content, import, or publish.

## API

Compile an existing successful validator result without reparsing it:

```js
import { parseBerryMark } from './src/parser.js'
import { compileValidatedBerryMark } from './src/compiler.js'

const validation = parseBerryMark(source, { filename })
const compilation = compileValidatedBerryMark(validation, { source })
```

A convenience entry point performs both pure operations:

```js
import { compileBerryMark } from './src/compiler.js'
const compilation = compileBerryMark(source, { filename })
```

The exact original `source` string is required so the report can fingerprint the actual compiled input. The compiler rejects a missing source or any validator result with `ok: false`. It never attempts to repair invalid syntax or metadata.

Result shape:

```js
{
  ok,                       // faithful content compilation, not readiness
  mode: 'experimental-pure-sanity-compilation',
  sanityCandidate,          // challenge-shaped object, or null on blocking failure
  reviewReport: {
    schemaComplete,          // required Sanity fields/references all supplied
    importReady: false,
    publicationReady: false,
    source,
    challenge,
    validatorSummary,
    compilerSummary,
    counts,
    structure,
    authoredMetadata,
    metadataStates,
    unresolved,
    editorialItems,
    controlledMappings,
    pendingLookups,
    skippedDestinationFields,
    compatibility,
    diagnostics
  },
  diagnostics
}
```

`ok: true` means every supported source content item was represented without a blocking conversion failure. It does **not** mean schema-complete, import-ready, approved, licensed, previewed, or publication-ready. A failed conversion returns `sanityCandidate: null` and located error diagnostics. `importReady` and `publicationReady` remain false because those gates do not exist.

## Candidate mapping

The candidate follows Bibleberry `main@c43b53146f3b4f6c1d5154e1ce0409a5aa3e4d3d`, using the checked-in snapshot at `test/bibleberry-schema-v0.1.snapshot.json`.

| Source | Candidate |
| --- | --- |
| Challenge metadata | `title`, authored `slug.current`, `challengeType`, optional `summary` |
| Publishing | `sequence` and `releaseAt` when supplied; series remains an unresolved lookup |
| Primary Scripture | Inline `scriptureReference` |
| SCREEN | Keyed `challengeScreen` with optional `screenLabel`/`heading` and ordered blocks |
| CB1 | `richTextBlock.body` Portable Text |
| CB2 | `scriptureBlock.scripture` |
| CB3 | Separate `statementBlock` with exact plain `text` and optional `label` |
| CB4 | `comparisonBlock` with `comparisonSide` Portable Text bodies, optional plain footer |
| CB5 | `visualCardsBlock` with keyed ordered `visualCard` items |
| CB6 | `connectedSequenceBlock` with keyed ordered `sequenceStep` items and authored cycle options |
| CB7 | Optional `reflectionBlock` with keyed ordered `reflectionChoice` items |
| CB8 | Optional `optionalStudyBlock` with Portable Text body and keyed `scriptureReference` items |
| CB9 | `prayerBlock.paragraphs` as primitive plain-text strings |
| Companion links | Keyed `companionLink` objects with supplied fields only |
| Editorial source | `editorialReview.sourceTitle`, optional `sourceRevision`, conservative `adaptationReviewed: false` |

CB4–CB8 always receive `reviewStatus: 'proposed'`. Optional studies, reflections, and companions receive no completion gate. CB3 statements are never copied into adjacent CB1 prose. Plain-text fields remain exact strings; Markdown marker characters in those fields are not interpreted or stripped.

## Portable Text and unsupported input

`marked` **18.1.3** (MIT) is pinned exactly. Its block/inline token AST drives conversion; regular expressions are not used as a Markdown converter. Supported output includes:

- Normal paragraphs and representable hard/soft line breaks.
- `h2`, `h3`, and `blockquote` styles.
- Bullet and number list items at level 1.
- `strong` and `em` decorator marks, including supported combinations.
- HTTP(S) link annotations in `markDefs` with references from span `marks`.
- Unicode and literal field-looking prose.

Tables, images, code fences/spans, arbitrary HTML, unsupported headings, link titles, unsafe/relative links, task lists, nested or multi-block lists, non-1 ordered-list starts, and other unrepresentable constructs produce `BM_MARKDOWN_UNSUPPORTED` or `BM_MARKDOWN_LINK`. Diagnostics include filename, source line/column, rich-body path, and CB ID. Content is never reworded, truncated, or silently discarded to make conversion succeed.

## Deterministic identity and generated keys

Author-supplied semantic IDs are used directly as `_key` for screens, top-level blocks, cards, steps, choices, and CB8 nested Scriptures. Reordering those siblings changes order only, not identity.

Portable Text blocks, spans, and link annotations have no authored IDs. Their keys are:

```text
"bm" + first 24 hex characters of SHA-256(
  parent semantic ID + NUL + node kind + NUL + canonical node content + NUL + occurrence
)
```

Canonical content uses sorted object keys. `occurrence` disambiguates only repeated identical canonical siblings; it is not an array index. Distinct sibling reorder therefore leaves keys unchanged. Repeated compilation of identical source is byte-deterministic. Editing a rich-text node can change that node and its containing block key; unrelated nodes retain their keys. This limited rich-body key churn is accepted for v0.1.

Companion-link keys use the same SHA-256 format with the Challenge slug as parent, `companionLink` as kind, occurrence 1, and canonical original field states (including absent versus null). Editing a companion changes its key because BerryMark supplies no stable companion ID. Exact duplicate companion content produces `BM_KEY_COLLISION` rather than silently disambiguating two indistinguishable links.

No random values, clock values, array-position structural keys, Sanity document IDs, or series references are generated. The committed compiler JSON files are golden determinism fixtures.

## Honest partial candidates and review sidecar

`reviewReport.authoredMetadata` retains the complete typed source metadata. `metadataStates` records `absent`, `null`, or `value` for optional/deferred fields, including each companion URL. Other report sections preserve:

- Exact source filename and SHA-256, plus source revision state.
- Ordered screen/block/nested IDs and source lines.
- Validator and compiler diagnostic counts.
- Every source annotation's original text, line, kind, and `unresolved` status.
- Controlled mappings for `adaptationReviewed: false` and every proposed structured block.
- Pending series lookups and unresolved publishing, URL, rights-assertion, and approval-transfer items.
- Bibleberry schema revision and missing required candidate fields.

A supplied `publishing.series` is a series **slug**, not a document ID. The candidate always omits `series` in Sprint 02 and records a pending lookup. Consequently `schemaComplete` is false while that required reference is unresolved. Missing sequence/release values also remain omitted and listed. These facts do not by themselves make content compilation fail.

### Fields intentionally outside the current Sanity candidate

- `editorial.sourceAuthor`: current `editorialReview` has no matching field.
- `editorial.approvalStatus`, `approvedBy`, `approvedAt`: no approved transfer policy exists; source claims remain verbatim in the sidecar.
- `publishing.series`: requires a later authorized series-slug lookup before a `_ref` can exist.
- Source annotations and unresolved review records: no approved structured destination exists in Sanity.
- Source fingerprint, structural inventory, and compiler diagnostics: compilation evidence, not reader-facing Challenge content.

Successful compilation never sets `adaptationReviewed: true`, invents reviewer/date fields, promotes CB4–CB8 to approved, verifies a rights assertion, or manufactures a URL/passage/publication value.

## Developer demonstration

The existing validator CLI is unchanged. Use the separate compiler CLI:

```bash
npm ci
npm run compile
npm run compile:rejoice

# Or compile any source file:
node src/compiler-cli.js path/to/source.berry.md
```

The command writes JSON to stdout only. It exits 0 for faithful content compilation (including an honestly partial candidate), 1 for validation/compiler errors, and 2 for arguments/read failure.

Committed inspectable results:

- `examples/compiler-all-blocks.compiled.json`: rights-safe synthetic all-nine-CB and Markdown demonstration.
- `examples/rejoice-always/rejoice-always.compiled.json`: partial real-manuscript candidate plus all unresolved editorial state.

The real result preserves 7 screens, 16 top-level CBs, 3 optional studies, 4 nested Scriptures, and 17 editorial annotations. Its source teaching and prayer are compared with the validator AST in automated tests. Editorial comments are absent from reader-facing candidate fields.

## Verification and remaining decisions

```bash
npm test
npm run check
npm run preview
node src/cli.js check examples/rejoice-always/rejoice-always.berry.md
```

Tests cover CB1–CB9, nested/optional shapes, Portable Text, malicious/unsupported Markdown, deterministic/colliding keys, reorder stability, metadata states, source approval claims, schema-snapshot compatibility, CLI status, no-network execution, demonstrations, and complete real-manuscript fidelity.

Still deferred for separately authorized work:

1. Series slug resolution and Challenge identity/duplicate policy before draft import.
2. Missing-required-field policy for unpublished drafts and the definition of import readiness.
3. Truthful Aaron/Alexis approval transfer and durable review-item disposition in Sanity.
4. Warning override syntax, revision binding, and storage.
5. Controlled unpublished-draft import and protected developer preview.
6. External Scripture rights verification, human editorial approval, and publication gates.
