# BerryMark v0.1 — Language Specification (Working Draft)

**Status:** Design draft for Aaron and Alexis to review. Not an implementation contract yet.  
**Project:** [ContraPhilosophy/BerryMark](https://github.com/ContraPhilosophy/BerryMark)  
**Companion documents:** [Content Block Registry](block-registry.md) · [Validation and Import](validation.md)

## 1. Purpose and boundaries

BerryMark is a human-readable, Markdown-based domain-specific language for turning an approved editorial adaptation of a Bibleberry Challenge into structured content. A Challenge may have as many ordered screens and Content Blocks as its teaching requires. Editorial substance, theological fidelity, and Alexis's authorial voice take precedence over arbitrary presentation limits.

BerryMark is an independent project. Its core parser and validator should not depend on the React reader, Cloudflare, or Sanity. A **Sanity adapter** translates validated BerryMark content into the *currently agreed Bibleberry Sanity schema*. That adapter is the initial output target, not a promise of general CMS portability in v0.1.

**Not in scope for v0.1:** a visual editor, bidirectional content sync, automatic publication, generalized CMS adapters, a second rendering application, or automatic rewriting of Alexis's teaching.

## 2. Editorial lifecycle (approved)

1. Alexis's **original manuscript** remains unmodified and distinct from the BerryMark adaptation.
2. Aaron and ChatGPT collaborate on a **human-readable BerryMark adaptation**, screen by screen. Alexis can inspect and edit it before import.
3. **Validate** checks its structure, metadata, formatting, and editorial exceptions. An optional read-only structure preview shows the interpreted screen/block order.
4. **Import** revalidates and performs one controlled handoff to **one new unpublished Sanity draft**, only if import conditions are satisfied.
5. **Sanity becomes authoritative immediately after successful import.** Aaron and Alexis make any final edits there, perform editorial/visual review, and separately decide whether to publish.
6. Preserve the original BerryMark file as a versioned historical snapshot. **No routine re-import, bidirectional reconciliation, or overwrite.** A pre-existing Challenge must not be silently replaced or duplicated.

The only agreed commands/operations are **Validate** and **Import**. Exact CLI command spelling and optional flags remain to be defined.

## 3. Document model

A BerryMark Challenge document has:

- YAML front matter between opening/closing `---` delimiters.
- One or more explicit **SCREEN** containers, in reading order.
- Each SCREEN has a permanent author-chosen `id`, optional small label and heading, and one or more ordered **CB** instances.
- Each Content Block has a permanent, semantic **instance ID** and one permanent **type code** (`CB1` through `CB9` in v0.1).
- Complex blocks may contain named nested sections (`LEFT`, `RIGHT`, `FOOTER`) or repeatable entries (`CARD`, `STEP`, `CHOICE`). Repeatable entries carry stable IDs.

**Identity is not position.** Reordering a screen or block must not require renaming its ID. Never use positional IDs such as `screen-1` merely because an element is currently first. The importer must preserve stable identities when generating Sanity array keys; the exact deterministic key algorithm is an implementation detail still to specify.

**Type-code registry is append-only.** `CB1` will always mean rich teaching text, even if a later code becomes more common. Never renumber, recycle, or silently redefine an existing code.

### Structural illustration

~~~text
[[SCREEN id=opening]]
Label: Encounter
# The Command

[[CB2 id=opening-scripture]]
Reference: 1 Thessalonians 5:16–18
Translation: NIV
Text Status: referenceOnly
Practice Status: notConfigured
[[/CB2]]

[[CB1 id=opening-explanation]]
Paul gives three commands, and the meaning of each deserves attention.

This paragraph can include **emphasis** and *italics*.
[[/CB1]]

[[/SCREEN]]
~~~

The opening/closing markers and stable `id` concept are approved. **The exact spelling of internal field lines** such as `Reference:` and `Text Status:` is provisional until tested against real manuscripts and frozen in the grammar.

### Screens

- Opening syntax: `[[SCREEN id=meaningful-name]]`.
- Closing syntax: `[[/SCREEN]]`.
- Optional label: `Label: Encounter` (small reader-facing screen label).
- Optional screen heading: a top-level Markdown `# Heading` at screen level.
- The order of SCREEN declarations determines reader order; screen count and teaching length are not capped.
- No anonymous or overlapping SCREEN containers.

### Content Blocks

- Opening syntax: `[[CBn id=meaningful-name]]`; matching closing syntax: `[[/CBn]]`.
- `CBn` must be a registered type. See [block-registry.md](block-registry.md).
- Content Block IDs must be stable across ordinary editorial rearrangements.
- For repeated nested items: `[[CARD id=...]]`, `[[STEP id=...]]`, `[[CHOICE id=...]]`, and **within CB8** `[[SCRIPTURE id=...]]`.
- For singular nested areas: `[[LEFT]]`, `[[RIGHT]]`, `[[FOOTER]]`; these do not need individual IDs.
- The exact content/field grammar *inside* most blocks is a **v0.1 design item**, not yet implementation-ready. The CB8 nested `SCRIPTURE` section form is approved; its internal field-label spellings are still provisional.

### CB8 nested Scripture references (approved November 3, 2026)

An Optional Deeper Study (`CB8`) may contain **zero or more** structured Scripture references using an explicitly opened and closed nested section:

~~~text
[[CB8 id=study-human-grief]]
Title: Explore Jesus and human grief

The optional study's rich teaching text goes here.

[[SCRIPTURE id=john-11-33-35]]
Reference: John 11:33–35
Translation: Not configured
Text Status: referenceOnly
Usage Rights Confirmed: false
Practice Status: notConfigured
[[/SCRIPTURE]]
[[/CB8]]
~~~

- `[[SCRIPTURE id=stable-semantic-id]]` must be closed with `[[/SCRIPTURE]]`, fully nested inside one CB8, and is **not** a new top-level Content Block code or a substitute for CB2.
- Each nested Scripture occurrence has a unique, stable ID; its order in the CB8 determines the resulting `optionalStudyBlock.scriptures[]` order.
- A nested `SCRIPTURE` maps to one existing Sanity `scriptureReference`, with the same reference, translation, text-availability, quotation-rights, and memorization-practice rules used by CB2.
- The nested section is **structured metadata**, not part of CB8's rich-text study body; its markers and field lines do not appear in reader prose. Ordinary prose surrounding a reference remains in the CB8 body.
- The **section markers and ID requirement are now approved**. The exact spellings of field labels (such as `Text Status:`), literal-marker escaping and other unfinalized parser rules remain open; examples do not declare them implementation-ready.

### Editorial comments

Standard Markdown/HTML comments can record non-reader-facing editorial work:

~~~markdown
<!-- EDITORIAL NOTE: Preserve the contrast in Alexis's source wording. -->
<!-- TODO: Confirm this passage's quotation rights. -->
<!-- REVIEW REQUIRED: Check whether this comparison distorts the argument. -->
~~~

Comments do not appear in the reader. TODO and REVIEW REQUIRED are not silently ignored: validation reports them, and they must be resolved before final approval/publication. Their precise draft-import disposition is tracked in [validation.md](validation.md).

## 4. Front matter

YAML front matter carries the editorially meaningful Challenge metadata. The following is a **working illustrative shape**, not a finalized parser schema. Unknown values must remain explicit (for example `null`); BerryMark must never manufacture approvals, Scripture permissions, URLs, or release times.

~~~yaml
---
berrymark: "0.1"

challenge:
  title: "Rejoice Always"
  slug: "2026-11-02-rejoice-always"
  type: teaching
  summary: null

publishing:
  series: "november-2026"
  sequence: 2
  releaseAt: null

scripture:
  reference: "1 Thessalonians 5:16–18"
  translation: NIV
  textStatus: referenceOnly
  usageRightsConfirmed: false
  practiceStatus: notConfigured

editorial:
  sourceTitle: "Rejoice Always"
  sourceAuthor: "Alexis Waid"
  sourceRevision: null
  approvalStatus: pending
  approvedBy: null
  approvedAt: null

companionLinks: []
---
~~~

### Intended metadata mapping

| BerryMark | Bibleberry Sanity field or action | Notes |
| --- | --- | --- |
| `challenge.title` | `challenge.title` | Required. |
| `challenge.slug` | `challenge.slug.current` | Stable, immutable identity once progress exists; do not derive from title during import. |
| `challenge.type` | `challenge.challengeType` | Existing values: `teaching`, `discipline`, `reflection`, `memorization`. |
| `challenge.summary` | `challenge.summary` | Optional. |
| `publishing.series` | `challenge.series` reference | Working convention: resolve an existing series by stable slug; do not fabricate a new series. |
| `publishing.sequence` | `challenge.sequence` | Positive integer; don't infer order from release dates. |
| `publishing.releaseAt` | `challenge.releaseAt` | Sanity requires explicit datetime. `null` can mean *not scheduled yet* during BerryMark drafting, but cannot be silently turned into a publication-ready value. |
| `scripture.*` | `challenge.primaryScripture` | Must conform to the shared `scriptureReference` structure. |
| ordered `SCREEN` blocks | `challenge.screens` | Ordered `challengeScreen` objects with stable array keys. |
| `companionLinks` | `challenge.companionLinks` | Optional metadata, never mandatory for Challenge completion. |
| `editorial.*` | `challenge.editorialReview` plus provenance | **Compatibility gap:** existing Sanity review fields do not map one-to-one to proposed BerryMark approval metadata. Do not claim a review occurred simply to satisfy a schema requirement. |

The Sanity schema currently calls a review field **“Adaptation reviewed by Alexis”**. The intended workflow permits review by **Alexis or Aaron**, with truthful attribution. Correcting this field and its publication validation is a **separate, deferred schema change**; it is *not* part of the present BerryMark documentation commit.

The current `editorialReview` schema has `sourceTitle`, optional `sourceRevision`, boolean `adaptationReviewed`, optional `reviewedBy`, `reviewedAt`, and `reviewNotes`. BerryMark's `sourceAuthor`, `approvalStatus`, `approvedBy`, and `approvedAt` cannot be assumed to have matching destinations without a deliberate adapter mapping/schema decision.

A publication time must use a timezone-aware datetime/offset before publishing. A missing value never means “publish now.” Sanity may flag an incomplete **draft** as invalid; the importer must distinguish draft creation from publication readiness.

### Shared Scripture data

The Sanity `scriptureReference` fields are: `reference`, `translation`, `textStatus` (`referenceOnly` or `provided`), optional `passage`, `usageRightsConfirmed`, and `practiceStatus` (`notConfigured` or `configured`). A provided passage requires confirmed app quotation rights; configured memorization practice requires rights-cleared passage text.

**A manuscript containing a Bible translation is not proof of app quotation rights.** Defaults are conservative: reference only, rights not confirmed, practice not configured. Other Scripture instances (e.g. CB2, optional-study references) follow the same rules.

### Companion links

Each Sanity companion link currently supports `provider` (`social`, `patreon`, `podcast`, `walkingReel`, `youtube`, `other`), required `label`, and optional `description`, verified HTTP(S) `url`, and `availability`. These are metadata, not required reading or completion steps. Do not invent URLs.

### Series records

A Challenge may point to an already-existing `challengeSeries` record. That schema contains required title and slug; optional description, start/end dates, cover image, and image alternative text. A separate BerryMark *series document format* was discussed conceptually, but its grammar and creation/import workflow are **not approved for v0.1 yet**. Until decided, resolve an existing Sanity series or report an unresolved-reference problem.

## 5. Supported text formatting

Where Sanity uses the project's Portable Text field, the approved Markdown subset is:

- Paragraphs and line breaks where representable.
- `**bold**`, `*italic*`.
- `##` and `###` headings.
- Markdown block quotations.
- Bulleted and numbered lists.
- External HTTP(S) Markdown links.

Portable Text currently supports normal, `h2`, `h3`, `blockquote`; bullet/number lists; `strong`, `em`; and HTTP(S) link annotations.

**Do not silently strip unsupported Markdown** (for example code fences, tables, images, or arbitrary inline HTML) from reader content. Report unsupported constructs and decide explicitly whether to extend the language or rewrite the adaptation.

Not every field is Portable Text. Titles, labels, statements, captions, choice prompts, sequence-step explanations, card bodies, prayers, and other plain-text fields must not be assumed to support rich Markdown. See the registry for exact field expectations.

## 6. Validation, preview, and import

**Validate** is side-effect free. It reports errors, warnings, editorial annotations, and optionally the interpreted screen/block tree. It does not create or alter Sanity content.

**Import** revalidates, rejects errors, and by default rejects unresolved warnings. A specific warning may be explicitly overridden with its target, rule, source revision, and rationale **only to permit review in a Sanity draft**. Imported warning overrides must be visible for Sanity editorial disposition, not treated as accepted content.

The importer must reject accidental duplicate Challenge identity, create **one unpublished draft**, return its direct Sanity edit link, and record source-file/version provenance. No import authorizes review, approval, or publication.

Details and example failure cases are maintained in [validation.md](validation.md).

## 7. Sanity compatibility and release discipline

The BerryMark repository owns language semantics, parser, validation, compiler, and the Sanity output adapter. The Bibleberry repository owns its Sanity schemas, React reader, editorial publication workflow, and deployment infrastructure.

Before importer implementation:

1. Lock precise grammar for all nine block bodies and YAML typing.
2. Agree on stable Sanity array-key generation and Challenge identity/duplicate detection.
3. Reconcile BerryMark editorial provenance and warning review items with Sanity without fabricating approval.
4. Decide how an incomplete draft timestamp and uncreated series are handled.
5. Test the adapter against the current Sanity schema and update compatibility tests when it changes.

**Design principle:** Keep the language lean. Do not build a synchronization platform for two editors who expect to finish roughly 95% of work in BerryMark and make final adjustments directly in Sanity.

## 8. First acceptance exercise

Use Alexis's original **November 2, 2026 “Rejoice Always”** manuscript as the first serious exercise, after preserving the source unchanged. Collaboratively adapt each screen, verify the theological argument, and inspect the full result for gaps in the grammar. A ceremonial `hello-world.berry.md` can later test end-to-end import, but illustrative samples are not evidence that an importer already exists.

**Working draft, not compiler-ready.** No parser or importer is claimed to exist as of this document.
