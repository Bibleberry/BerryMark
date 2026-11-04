# BerryMark v0.1 — Pure Sanity JSON Compiler Contract

**Status:** Proposed implementation contract for Aaron's review; five governing decisions approved November 3, 2026. Do not treat this draft as authorization to import or publish.  
**Owner:** Aaron Waid, with ChatGPT architecture/design review  
**Implementer for next sprint:** Kimi  
**Repository:** `ContraPhilosophy/BerryMark`  
**Baseline:** `docs/berrymark-v0.1-specification` after PR #1 merge (`9b38948d52deec9868539514cd2ee480766047af`)  
**Reference Bibleberry schema:** `ContraPhilosophy/Bibleberry`, `main` at `c43b53146f3b4f6c1d5154e1ce0409a5aa3e4d3d`, especially `studio/schemaTypes/documents/challenge.ts`, `objects/*`, and `fields.ts`. Recheck if the schema changes.

## 1. Purpose and five approved requirements

BerryMark exists to preserve Alexis Waid's substantive theological teaching while transforming an author-reviewed, human-readable Challenge adaptation into the structured content understood by Bibleberry. The source manuscript remains distinct from the BerryMark adaptation. No arbitrary screen/paragraph/teaching length cap is allowed.

Aaron approved these governing decisions:

1. **Stable identity:** Preserve BerryMark's author-chosen semantic SCREEN, CB, and nested collection IDs as Sanity `_key` values wherever appropriate. Ordering is independent of identity.
2. **Truthful incompleteness:** Preserve missing and explicit `null` metadata as unresolved facts, rather than inventing series references, release dates, approvers, approval timestamps, URLs, or quotation rights.
3. **Real text conversion:** Convert the approved rich-Markdown subset into actual Sanity Portable Text, rather than flattening to plain text.
4. **Separate review trail:** Keep editorial comments out of reader-facing fields while preserving their original wording, location, and unresolved state in a separate structured review/compilation report.
5. **Fail rather than force:** If the source cannot be represented faithfully, compilation must produce a located blocking diagnostic rather than truncate, reword, silently drop, flatten, or cram content into an unsuitable target.

**Critical distinction:** Incomplete *editorial metadata* may still produce an inspectable **partial Sanity document candidate** and an explicit unresolved report. Unrepresentable *content* is a **compilation failure**. Neither condition grants permission to import, approve, publish, or expose unpublished content.

This document sets the Sprint 02 mapping target and identifies implementation details requiring explicit review. Approved BerryMark field grammar, CB1–CB9 meanings, and the one-way authoring model remain unchanged.

## 2. Scope and pure execution contract

Sprint 02 adds a **read-only, deterministic compiler** after the existing `parseBerryMark` validator. Consume only a document whose syntax/metadata validator returned `ok: true`; reject `ok: false` instead of recovering silently. Do not replace the parser, modify Alexis's manuscript, add a second editor, or change existing `check`, `preview`, and `json` CLI behaviors.

A proposed pure API (exact function names may be adjusted and documented by Kimi):

~~~js
const validation = parseBerryMark(source, { filename });
const compilation = compileValidatedBerryMark(validation, { source });
// compilation = { ok, sanityCandidate, reviewReport, diagnostics }
~~~

No network, Sanity client, browser, local filesystem write, credentials, current-clock-derived values, randomness, or persistent state within the compiler. A developer-only command may print compilation output to stdout; it is **not** a user-facing third publishing operation.

### Two outputs

**A. `sanityCandidate`:** JSON representing a `challenge` document **as far as deterministically expressible** under the target schema, including screen/block ordering, valid `_type` fields, Portable Text, and documented conservative review states. It is a *candidate payload*, **not** proof of Studio validity or an importable Sanity mutation. It may omit required unresolved Sanity fields with explicit report entries. It must not claim `schemaComplete: true` while required fields/references are missing. Never invent a draft `_id`.

**B. `reviewReport`:** A serializable sidecar containing source identity and fingerprint; structural counts; complete preserved editorial annotations; author-supplied and unresolved source metadata, including absent-versus-explicit-null distinction; controlled defaults and skipped destination fields; exact rule diagnostics; pending external lookups; compatibility assessment; and evidence needed for later review. Its existence does not mean its contents have been stored in Sanity.

Recommended explicit result state:

~~~json
{
  "ok": true,
  "sanityCandidate": {"_type": "challenge"},
  "reviewReport": {
    "schemaComplete": false,
    "importReady": false,
    "publicationReady": false,
    "unresolved": [],
    "editorialItems": [],
    "diagnostics": []
  },
  "diagnostics": []
}
~~~

`ok` means **content compilation succeeded without blocking loss**, *not* import readiness. `importReady` and `publicationReady` must remain `false` throughout Sprint 02; their gates do not exist yet. If validation or conversion fails, `ok: false`, with no ostensibly successful candidate document exposed (e.g., `sanityCandidate: null`), and located errors.

## 3. Challenge metadata mapping against the real schema

The v0.1 validator requires `challenge`, `publishing`, `scripture` and `editorial` mappings, even if declared values are unresolved; `companionLinks` is optional. This is the Sprint 02 **complete-document authoring profile**, not a policy that every publishing value must be set. YAML anchors/aliases remain unsupported. Do not add an extension namespace or partial-document profile in this sprint.

| BerryMark source | Sanity candidate | Rule |
| --- | --- | --- |
| `challenge.title` | `title` | Exact authored string. |
| `challenge.slug` | `slug: {_type: 'slug', current: value}` | Use the author-supplied stable slug; never derive from title. Validate target compatibility; report incompatible formats instead of rewriting. |
| `challenge.type` | `challengeType` | Same approved enum. |
| `challenge.summary` | `summary` | Include authored non-null value; preserve absent/null separately in report. |
| `publishing.series` | `series` reference | The value is a **series slug**, not a Sanity document ID. The pure compiler has no series lookup; preserve slug in report and leave unresolved `series` absent. Do not fabricate `_ref`, create a series, or fetch live Sanity. |
| `publishing.sequence` | `sequence` | Preserve positive integer if provided; leave unset if absent/null; report unresolved. |
| `publishing.releaseAt` | `releaseAt` | Preserve supplied timezone-aware datetime string verbatim; omit when absent/null and report unresolved. Never use now/current time. |
| `scripture.*` | `primaryScripture` | Inline `_type: 'scriptureReference'` using validated exact source values; do not invent passage or rights. |
| `editorial.sourceTitle` | `editorialReview.sourceTitle` | Exact source title. |
| `editorial.sourceRevision` | `editorialReview.sourceRevision` | Map when provided; preserve unresolved otherwise. |
| `editorial.sourceAuthor` | Sidecar only until schema reviewed | The current `editorialReview` schema has **no matching field**. Never drop from the total output or insert unknown properties in the candidate. |
| `editorial.approvalStatus`, `approvedBy`, `approvedAt` | Sidecar and conservative review mapping | See approval rules below. |
| `companionLinks[]` | `companionLinks[]` | Map allowed fields to `companionLink` objects; never invent links. Stable `_key` strategy below. |

### Publishing and series

The Sanity `challenge` schema currently requires `series`, `sequence` and `releaseAt`. Working BerryMark documents may legitimately lack all three. A *partial candidate* in that state is intentionally **not schema-complete** and **not ready for import**. Future import work must define a separately authorized reference-resolution and draft-incompleteness policy. Do not preempt that gate by inventing a reference or datetime.

`publishing.series` uses the stable slug of an **existing** `challengeSeries`. It must not be converted into `{_ref: 'series-slug'}`. Resolution and duplicate-document checks are out of scope. If an entirely offline, explicit lookup fixture is later useful for tests, propose its exact shape for approval rather than introducing an implicit mapping or API call.

### Editorial review and provenance

Current Sanity `editorialReview` fields are `sourceTitle`, optional `sourceRevision`, `adaptationReviewed`, optional `reviewedBy`/`reviewedAt` and `reviewNotes`. The schema's review labels refer specifically to Alexis, while the agreed human workflow can include Aaron. **A separate Bibleberry schema and review-policy decision is required before importing approval state.**

Sprint 02 conservative candidate mapping:

- Emit `editorialReview: {_type: 'editorialReview', sourceTitle, adaptationReviewed: false}`, with `sourceRevision` if supplied. Setting `false` is an explicit conservative **not-yet-transferred-review** state, *not* a claim that the original manuscript has never been reviewed.
- Preserve all BerryMark original editorial fields verbatim in the sidecar, including any truthful `approved` claim with named approver/date; **do not silently downgrade or erase that source claim**.
- Do **not** map an `approved` source assertion into Sanity `adaptationReviewed: true` or `reviewedBy`/`reviewedAt` without the separately approved approval-transfer contract. Record `BM_REVIEW_TRANSFER_UNRESOLVED` as needed.
- For CB4–CB8 emit `reviewStatus: 'proposed'` as the documented conservative target-schema status; record that controlled mapping in the report. Never emit `approved` merely because parsing or compilation succeeded.
- Do not put private review notes, provenance, or editorial annotations into public-facing prose fields or an unapproved extra Sanity field.

### Scripture and companion links

Preserve `reference`, `translation`, `textStatus`, `practiceStatus`, and explicit `usageRightsConfirmed`/`passage` if present and consistent. The flag `usageRightsConfirmed: true` is an **author assertion**, not independent license evidence. Do not infer it from NIV quotations in an old prototype. Reference-only Scripture must not generate passage text; configured memorization requires rights-confirmed provided text under existing shared rules.

For companion links, `url: null` or an absent URL stays absent in the candidate, with original state and source position recorded in the report. Sanity currently has no ID field in BerryMark `companionLinks`; its deterministic array-key strategy must not silently change the approved YAML language (see `5).

## 4. Complete Content Block mapping registry

Map precisely these nine registered CBs and their ordered/nested elements, using the **current Bibleberry schemas**, not guessed structures. The outer array items in `challenge.screens[]` and `challengeScreen.blocks[]` require the correct `_type` and `_key`.

| BerryMark | Sanity `_type` | Target data |
| --- | --- | --- |
| SCREEN | `challengeScreen` | `screenLabel`, `heading`, ordered `blocks[]`; `_key` from SCREEN ID |
| CB1 | `richTextBlock` | `body` as Portable Text |
| CB2 | `scriptureBlock` | `scripture` as inline `scriptureReference` |
| CB3 | `statementBlock` | Required plain `text`, optional `label` |
| CB4 | `comparisonBlock` | `left`/`right` `comparisonSide` with plain `title` and Portable Text `body`; optional plain `footer`, `reviewStatus: 'proposed'` |
| CB5 | `visualCardsBlock` | Ordered `cards[]` of `visualCard`, with required plain `title` and optional plain `body`; proposed review |
| CB6 | `connectedSequenceBlock` | Ordered `steps[]` of `sequenceStep`, optional Boolean `cycle`, `returnCaption`, `conclusion`; proposed review |
| CB7 | `reflectionBlock` | Plain `question`, optional 0 or 2+ ordered `choices[]` of `reflectionChoice`, optional `closing`; proposed review |
| CB8 | `optionalStudyBlock` | Plain `title`, Portable Text `body`, ordered optional `scriptures[]` of `scriptureReference`; proposed review |
| CB9 | `prayerBlock` | Authored plain `paragraphs[]`, preserving paragraph boundaries |

The `CB8 SCRIPTURE` elements are **structured references**, never serialized into the Portable Text study body. CB3 statements migrated from legacy `teachingText.pullQuote` are independent sibling blocks, in approved source order, never duplicated into the CB1 prose. Optional reflection/study/companion material must not acquire a mandatory-completion flag.

Object nesting must include Sanity `_type` in the places the actual schema expects it; outer array object members carry `_key`. A `prayerBlock.paragraphs` array contains primitive text values, not invented keyed objects.

## 5. Stable identity and deterministic keys

**Approved invariant:** use author-supplied semantic IDs directly for `challenge.screens[]._key`, `challengeScreen.blocks[]._key`, `cards[]._key`, `steps[]._key`, `choices[]._key` and CB8 `scriptures[]._key`. They are already constrained/checked by the parser. Do not derive structural identities from current array position. Preserve order exactly while allowing editorial reordering without changing those keys. Reused IDs in separate documents are independent; the current validator already rejects duplicates within a BerryMark document.

**Generated keys without author-supplied IDs:** Sanity Portable Text arrays and companion links need deterministic keys but have no BerryMark semantic identifiers. Proposed implementation policy for Kimi to document and test:

- Use a documented, deterministic key derivation based on stable parent identity plus canonical node identity/content, never randomness, clock time, process order, or an unstable hash seed.
- For Portable Text nodes, deterministic repeat compilation of identical source must yield byte-equivalent keys/output; limited `_key` churn *inside a rich body* after a genuine text edit is acceptable in v0.1. Preserve text, marks and node order; avoid collisions among siblings.
- For `companionLinks[]`, use a deterministic content-derived key with explicit collision/duplicate detection, not an index-only key. Note in the report/docs that editing a companion link can change this key; no stable ID was authored.
- If faithful deterministic keying cannot be guaranteed for a particular case, **fail visibly and raise a design question** instead of extending BerryMark grammar without approval.

No draft document ID or `_ref` is generated without an established, authoritative identity/reference rule. Key algorithm details and golden fixtures must be recorded before calling Sprint 02 complete.

## 6. Markdown → Portable Text and plain-text discipline

Convert **only** the approved rich Markdown subset in `CB1`, both `CB4` sides, and `CB8` bodies:

- Paragraphs and representable line breaks.
- `**strong**`, `*emphasis*`, and their supported combinations.
- `##` / `###` headings; no unsupported heading levels.
- Markdown block quotations.
- Bulleted and numbered lists, with correct Portable Text `listItem`/`level` semantics.
- External HTTP(S) links as Portable Text link annotations (`markDefs`, `marks`, `href`).
- Unicode, punctuation, text order, and emphasis must survive.

Use a maintained Markdown parser/AST or equivalent robust approach. Do not implement destructive regex-only conversion. Generated Portable Text blocks/spans/annotations must use the target schema: `_type: 'block'`, `style`, `children` spans, `markDefs`, and deterministic keys. Nested/mixed unsupported constructs must produce a located diagnostic with block ID, not a best-effort approximation.

Reject unsupported images, arbitrary HTML, tables, code fences, code spans, unsupported links, unrepresentable list structures, or any otherwise unsupported Markdown feature. In plain-text fields do not interpret Markdown as formatting or silently strip symbols; if authored rich markup cannot be faithfully handled as plain text, report it for editorial review rather than destroying it. Preserve literal `Title:` and `Text:` lines in rich prose, as already guaranteed by the parser.

A reliable regression should compare the readable text extracted from Portable Text against the source's intended visible wording, accounting only for explicitly documented Markdown syntax and whitespace semantics. Exact theological wording must not be paraphrased or shortened.

## 7. Source fidelity, editorial sidecar, diagnostics

The sidecar is *part of the compilation artifact*, not an optional console message. Preserve all existing `document.annotations[]` including `EDITORIAL NOTE`, `TODO`, and `REVIEW REQUIRED` with exact content and source line; preserve unresolved states and the current semantic target only if it can be unambiguously determined. Never invent an approver, an editorial resolution, a target block, or a source revision.

Record deterministic source fingerprint (e.g., SHA-256 over exact supplied source), filename, available authored source revision, validator summary, Challenge slug, and ordered screen/CB IDs. A missing source revision remains missing; a fingerprint is not an approval date or editor identity. Keep the original absent versus explicit `null` status available for each deferred metadata path.

Diagnostics must be machine-readable with severity, rule code, filename, source line/column, and relevant path or stable block ID. Blocking errors make `ok: false` and CLI exit nonzero. Advisory/warning policy is not expanded in this sprint; no guessed warning overrides or TODO disposition policy. The report must explicitly distinguish:

1. **Content compilation status:** successful faithful mapping or failed conversion.
2. **Schema completeness:** whether all required Sanity data/references have been supplied/resolved.
3. **Import readiness:** **not evaluated** in Sprint 02, always false.
4. **Publication readiness:** **not evaluated** in Sprint 02, always false.

Do not leak source editorial notes into `challenge.summary`, `body`, `statementBlock.text`, prayer paragraphs, or public projections.

## 8. Definition of done and test matrix

Kimi's implementation must demonstrate:

1. Existing 43 validator tests remain passing and current `check`/`preview`/`json` commands behave as before.
2. Every CB1–CB9 and nested variant is mapped with proper `_type`, required fields, sanctioned optional fields, and order; synthetic fixtures deliberately exercise all nine codes.
3. The complete *Rejoice Always* example compiles as an **incomplete but faithfully mapped candidate**, retaining **7 screens, 16 top-level CBs, 3 CB8 studies, 4 nested CB8 Scriptures, and 17 editorial annotations in the sidecar**; original incomplete publishing, rights and pending-review states remain truthful.
4. Rich Markdown positive tests cover paragraphs, headings, emphasis, quotations, bullet/number lists, HTTP(S) links, Unicode, and literal field-like text. Negative tests reject unsupported Markdown, unsafe links, and unrepresentable structure without producing a falsely successful candidate.
5. Stable semantic keys survive reorder; two compilations of the same source are deterministic; collision/duplicate and content-key change behavior are documented.
6. Tests verify source-visible teaching has not disappeared, been duplicated, changed, or leaked from editorial annotations into public content.
7. Required pending `series`, `releaseAt`, `sequence` and nontransferred approvals mark `schemaComplete: false` without manufacturing content or making `ok: false` solely for those unresolved editorial facts.
8. No Sanity calls, network writes, token handling, Bibleberry changes, import, publication or deployment. Negative tests instrument/forbid network calls.
9. Provide inspectable output and actual CI evidence. Do not call an incomplete candidate `valid for Sanity import`.

### Deliberately deferred

A production-grade preview, Sanity client and auth, series slug lookup, duplicate Challenge check, draft `_id` convention, controlled draft import, release scheduling, publish gates, Scripture license verification, warning overrides, review item storage inside Sanity, approval-transfer schema revision, and production reader changes all belong to later separately approved work.

## 9. Decisions still requiring explicit follow-up

These are not licenses for Kimi to improvise:

- **Before import:** approve Bibleberry `editorialReview` changes or a truthful transfer policy for Aaron/Alexis approval, including durable storage and disposition of review items.
- **Before import:** define series slug resolution, missing-required-field policy for unpublished drafts, unique Challenge ID/duplicate strategy, and what counts as import-ready.
- **Before import:** select warning-override syntax, revision binding and destination of editorial TODO/review dispositions.
- **If needed for Sprint 02:** propose a narrow spec change for unsupported Markdown or unexpected arrays, rather than silently rewriting authorial content.

**Principle:** BerryMark is a one-way authoring handoff. After a controlled future import, Sanity becomes authoritative; routine reimport or two-way synchronization is not planned.
