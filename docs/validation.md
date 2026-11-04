# BerryMark v0.1 — Validation, Preview, and Import (Working Draft)

**Status:** Approved workflow principles plus proposed, testable rule categories. The parser/importer does not exist yet.  
**See also:** [Language Specification](language-spec.md) · [Content Block Registry](block-registry.md)

## 1. Two operations, no more (approved)

### Validate

**Validate** analyzes one BerryMark source file without writing to Sanity or any other external service.

It should:

1. Parse YAML front matter and explicit SCREEN / CB / nested-section markers.
2. Validate IDs, nesting, ordering rules, content requirements, metadata, and formatting.
3. Verify that each Sanity-target field is either explicitly provided, covered by an agreed visible default, or accounted for by controlled generation.
4. Report **errors**, **warnings**, and unresolved **editorial annotations** separately.
5. Optionally produce a **read-only structural preview**: ordered screens, headings/labels, block types, stable IDs, and nested items.

Preview is an output mode of Validate, **not a third operation**. It is a structural interpretation, not a second rendering app or guarantee of final pixel layout. Exact CLI spelling and output format remain implementation decisions.

### Import

**Import** is a controlled one-way transition:

1. Revalidate the source and its warning overrides.
2. Reject any blocking errors and unauthorized warnings.
3. Confirm the target Challenge does not already exist under its stable identity.
4. Resolve required references and verify target schema compatibility.
5. Create **one new Sanity draft**. Never publish, approve, overwrite, or create a duplicate.
6. Record source-file/revision provenance and transferred review items.
7. Return the **direct Sanity Studio editing link** for the new draft.

After a successful import **Sanity owns the content**; the BerryMark source is a retained historical snapshot. There is no routine reimport, two-way diff, conflict resolution, or Markdown export requirement.

## 2. Validation severity

| Severity | Meaning | Effect on Validate | Effect on Import |
| --- | --- | --- | --- |
| **Error** | The document is malformed, unsafe, or cannot be reliably interpreted/mapped | Fails | Always blocks; cannot be overridden |
| **Warning** | The document is structurally valid but deserves explicit editorial or presentation examination | Reports with precise location | Blocks **by default**; a scoped, justified override can allow **draft** import |
| **Editorial note** | Non-reader-facing context, question, or work item | Reports by type | Never silently discarded; exact handling of unresolved TODO/REVIEW REQUIRED for draft import must be finalized |
| **Info** | Nonblocking fact: default used, optional field omitted, counts, reference-only Scripture, etc. | Reports | Does not grant approval |

A warning override **does not mean the warning was resolved or accepted**. It grants permission to inspect that issue in a real Sanity draft. Final editorial disposition in Sanity remains separate, and must account for changes to the imported content.

If source content changes materially after an override, the previous override cannot silently apply to the new revision.

## 3. Proposed error rules

These examples are proposed classes of unoverridable error; the stable machine-readable rule codes are not yet finalized.

### Parsing and structural errors

- Missing, malformed, or unparseable YAML front matter.
- Unknown BerryMark version, unsupported block code, unsupported or mismatched structural marker.
- Unclosed, overlapping, improperly nested, or anonymous SCREEN/CB containers.
- Duplicate screen IDs, duplicate CB instance IDs, or duplicate IDs in a repeatable nested collection.
- Missing SCREEN or missing content blocks inside a SCREEN.
- Missing mandatory parts of a registered CB: e.g., a CB4 without RIGHT, CB6 with fewer than two STEP entries, or a CB7 with exactly one CHOICE.
- A nested `[[SCRIPTURE id=...]]` outside CB8; an unclosed `[[/SCRIPTURE]]` marker; a missing, duplicate or unstable nested Scripture ID; or malformed nested Scripture data. CB8 may have zero such sections.
- Undefined required CB field or incompatible field type.
- **Approved field grammar violations:** unsupported/wrong-case field name or duplicate singular field; field declaration with leading indentation; stray text in a field-only zone; missing `Title:` followed by a blank-line header/body separator in CB4 LEFT/RIGHT or CB8; a would-be field in an unsupported phase of CB6 or CB7.
- **Approved multiline scalar violations:** malformed `Name: |` indentation, missing required nonempty value, bad Boolean or enum token, or an attempt to absorb the closing structural marker as text. Strict field handling must never consume Alexis's prose silently.
- **Literal marker ambiguity:** unescaped full reserved structural-marker line that would parse as syntax instead of intended prose, or unsupported marker escaping where the parser would drop the backslash or the line.
- A `cycle: true` sequence without `returnCaption`.

### Mapping and fidelity errors

- Supported Markdown cannot be reliably converted to the declared Portable Text field.
- Rich Markdown is placed in a plain-text-only field and would be silently lost or reinterpreted.
- Unknown directive or field that the compiler would otherwise discard.
- Any required Sanity-facing field is unmapped and has no explicit documented default or controlled generation path.
- A claim of confirmed Scripture rights contradicted by missing rights evidence or invalid Scripture status combination.
- `textStatus: provided` with missing passage text; `referenceOnly` with passage text; `practiceStatus: configured` without rights-cleared provided passage.
- Unsupported/invalid URL schemes for external links.
- An attempt to import a Challenge whose stable identity already exists in Sanity (whether published or drafted).
- An unresolved required Sanity reference or unavailable target schema, if an importer cannot safely produce its promised draft.
- During an explicitly requested **legacy pullQuote migration**, loss of a highlighted statement, duplication into both CB1 and CB3, alteration of its wording, or reordering without a recorded editorial decision. The accepted mapping is an adjacent `CB1` followed by a stand-alone `CB3` mapped to `statementBlock`. Ordinary author-created CB3 statements need not be adjacent to CB1.

**No “best-effort” data loss:** when source content cannot be faithfully represented, fail clearly rather than omit it.

### Nuances to settle before a compiler is built

- **Missing `releaseAt`:** valid to express `null` in a BerryMark working draft; Sanity's current schema requires a datetime. Never invent a date. Determine whether a draft import may proceed with a clearly flagged incomplete field or whether import must wait for a real timestamp. Publishing requires resolution.
- **Editorial review metadata:** BerryMark's proposed approval fields do not exactly match Sanity's existing review schema. Never synthesize an approved reviewer or review date. This mapping must be reconciled before adapter implementation.
- **Unknown HTML comments and other escapes:** the one-backslash escape for a literal full reserved marker line in prose is **approved**. Decide how unknown comments and other, non-marker escape forms should be reported without reader-visible leakage.
- **Source rights evidence:** define the provenance/confirmation procedure for `usageRightsConfirmed`; a Boolean assertion must be truthful, not automatically inferred.

### Field-declaration decision is approved, not a warning

A malformed or ambiguous field declaration is a **blocking error**, not a warning eligible for an override. Freeform manuscript prose that happens to begin with `Title:` or `Text:` is **valid prose** in an allowed freeform context. Do not issue a warning merely for that spelling. The grammar is normative in [language-spec.md](language-spec.md#field-declarations-and-literal-prose-approved-november-3-2026); stable machine-readable error codes remain to be implemented.

## 4. Proposed warnings

Warnings are for **valid but potentially suboptimal** authored content. Examples:

- Comparison sides are visually unbalanced or unusually long for the intended UI.
- A key statement is too long to read effectively as a callout.
- Several cards or sequence steps have overly dense plain-text descriptions.
- A reflection prompt is ambiguous or likely to invite a response that isn't supported by the UI.
- A proposed structured adaptation seems to condense meaningful theological nuance.
- A proposed deep study adds substantive claims requiring source verification.
- An unusually large visual block warrants live presentation review.

**Do not establish arbitrary screen count, screen height, CB1 paragraph, or teaching word limits.** Presentation review must follow the substance of the teaching, not truncate it to fit a template.

Exact per-field advisory thresholds and warning codes will be chosen after testing representative manuscripts. Warnings need target identifiers and descriptions, not just a generic message.

## 5. Warning overrides (approved principle)

For every warning overridden to permit a Sanity *draft*, capture:

- The **specific warning rule** being overridden.
- The **specific target** (screen ID, CB instance ID, or nested item ID).
- The **source file and revision** on which the override was granted.
- A human-readable **reason** why draft import is justified.
- A preserved review item that can be found and dispositioned in Sanity.

A broad “ignore all warnings” switch is **not allowed**.

The syntax for recording overrides inside BerryMark has **not been selected**; do not implement a guessed directive as an established language feature. Proposed data shape only:

~~~yaml
rule: visual-comparison-length
target: feeling-versus-practice
sourceRevision: review-2026-11-03
reason: "Inspect the complete wording in the real presentation before shortening."
~~~

The compiler can use a future per-file override section or another explicit mechanism after that syntax is approved.

Overrides must not conceal structural errors, copyright uncertainty, missing approvers, unapproved publication, or unverified facts.

### Sanity warning-review handoff

The current Bibleberry Sanity schema has `reviewStatus: proposed|approved` on CB4–CB8 and a general `editorialReview.reviewNotes` field, but **no dedicated structured per-warning disposition schema**. This is a confirmed integration design gap.

The BerryMark adapter must not silently mark an overridden warning resolved. Determine a truthful, visible mechanism in Sanity for its warning ID, reason, and post-import resolution, with revision awareness. This may require a separately approved Sanity schema change.

## 6. Editorial annotations and review gates

Recognize conventional HTML comments:

~~~markdown
<!-- EDITORIAL NOTE: Preserve this explanatory nuance. -->
<!-- TODO: Verify exact wording against the source manuscript. -->
<!-- REVIEW REQUIRED: Inspect this adapted visual in the reader. -->
~~~

All three are excluded from reader-facing content. **TODO** and **REVIEW REQUIRED** are active editorial work items, not approvals. The exact distinction between “blocks draft import” and “allowed only by a specific documented override” remains open for v0.1, but **unresolved work may never silently pass as publication-ready**.

Distinguish four separate gates:

1. **BerryMark preflight validation:** Can the source be interpreted and mapped without unsupported loss or risk?
2. **Sanity presentation/content review:** Does the imported draft read and render correctly, including overridden warning cases?
3. **Human editorial approval:** Has an actual Aaron or Alexis reviewed and approved the adaptation, with truthful attribution and date?
4. **Publication:** Has an authorized editor explicitly published the Challenge after resolving all publication blockers?

No preceding gate substitutes for the next. Creating a draft is *never* an approval or release event.

## 7. Structural preview (approved)

Optional output of Validate, for example:

~~~text
BerryMark structural preview — Rejoice Always
Source: rejoice-always.berry.md
Status: draft structure

SCREEN id=opening  ·  Encounter  ·  The Command
  CB2 id=opening-scripture  ·  Scripture
  CB1 id=opening-explanation  ·  Rich Teaching Text

SCREEN id=distinction  ·  Clarify  ·  Two Different Things
  CB1 id=distinguishing-joy  ·  Rich Teaching Text
  CB4 id=feeling-versus-practice  ·  Comparison
     LEFT, RIGHT, optional FOOTER

Validation: [errors] errors, [warnings] warnings
~~~

This is an **illustrative shape**, not a claim of implemented output or the final screen breakdown of Alexis's manuscript. A real report should include machine-readable IDs and sufficiently precise source locations (file, line/range where possible).

## 8. Pre-import report

An Import request must surface or make available an inspectable summary *before write*:

- Challenge title, slug, type, series, sequence.
- Source file and revision.
- Screen and Content Block counts and ordered structure.
- Blocking errors, warnings, and any scoped overrides.
- Missing/controlled defaults and unresolved metadata.
- Target environment, Sanity dataset, and **draft-only** outcome.

**Safety:** never expose privileged Sanity write tokens in the reader, GitHub repository content, or browser-facing client code. Write credentials belong in an appropriately secured execution environment. A successful import returns the draft's direct Studio link.

## 8A. Development-only test identification (agreed goal; presentation details proposed)

**Goal agreed November 3, 2026:** While inspecting BerryMark output in the running Bibleberry **developer lab**, it must be unmistakable which content source, test run, source revision, screen, and block are on display. Do not rely on visual memory or an unmarked side-by-side comparison.

**Recommended minimal presentation, not yet implemented:**

- A conspicuous **development-only banner on every screen**: `BERRYMARK TEST · Sanity draft · rejoice-always · rev <short SHA> · SCREEN 2/7 [posture-of-rejoicing]`. Use the truthful source name (e.g. `Local Prototype`, `Sanity CMS`, `BerryMark import`) rather than labeling an existing local prototype as BerryMark.
- A **diagnostic block-label toggle** for CB instance identifiers (e.g. `CB4 · feeling-versus-practice`), and nested IDs if troubleshooting a CARD, STEP, or CHOICE. Show the exact identifiers from the source/import report.
- Preserve a **test-run fingerprint** in the import/validation report: filename, revision/commit, target dataset, draft document ID and time, with no invented provenance. The developer view should refer to that fingerprint.
- Distinguish **real-manuscript adaptation tests** from **synthetic fixtures**. Synthetic fixtures can contain obvious unique sentinel text such as `BM-TEST-CB4-LEFT` to verify field mappings; such text must never be inserted into Alexis's actual source or adapted prose.
- A test must verify both what appeared **and what must not appear**: no leaked editorial comments, review overrides, unconfirmed Scripture passage text, unintended approvals, unpublished companion links, or completion requirements for optional material.

**Safety / boundary:** Test banners and block labels are generated by a development-only reader/debug presentation, **not serialized as reader-facing BerryMark prose or permanent Sanity teaching content**. Do not add `TEST` statements to Alexis's manuscript, prayer, or quotations. A production-facing reader must not render diagnostics. The current public-readable Sanity dataset is not a secure home for confidential draft manuscripts. No importer or debug overlay exists merely because this requirement is documented.

**Verification exercise:** On each of the seven existing Rejoice Always screens, confirm the source badge, screen ID and position, expected CB types/IDs, interactive choices, optional studies and final prayer. This is separate from theological editorial approval. Exact debug UI styling and implementation approach remain to be decided with the Bibleberry reader team.

## 9. Identity, duplicate detection, and versioning

- The BerryMark **Challenge slug** is the human-readable stable identity. Decide exact Sanity document-ID convention before implementation; do not guess solely from a title.
- On import, check for both a published document and a draft for the same identity. Refuse duplicates or overwrites.
- Screen, CB, CARD, STEP, and CHOICE semantic IDs must map consistently to stable Sanity keys.
- Preserve the imported BerryMark file/version as provenance. Subsequent direct Sanity edits are normal; they do not trigger automatic BerryMark sync.
- A one-off replacement pathway, if ever needed, is a separate design decision and **out of v0.1 scope**.

## 10. Tests required before calling the implementation complete

**Parser tests:** Valid YAML and nested markers; malformed closings; escaped/literal marker text; duplicate IDs; reordering; unsupported directives; CB8 with zero, one, or multiple stable-ID `SCRIPTURE` children; rejection of nested `SCRIPTURE` outside CB8; preserving array order and excluding Scripture directives from Portable Text. **Approved field grammar tests:** CB1/CB9 and CB4 FOOTER `Title:` as literal prose; strict field-only contexts, exact case-sensitive names, unknown/duplicate-field errors with source locations, CB4 LEFT/RIGHT and CB8 blank-line header separators, CB6 STEP and CB7 CHOICE phase detection, literal full marker line escaped with `\[[...]]`, scalar and two-space-indented multiline `Name: |` values, nested field-looking lines preserved in values, Boolean/enum validation, and no dropped or duplicated prose.

**Formatting tests:** Rich Markdown to Portable Text; plain-text fields; block quotes, lists, links; unsupported images/tables/code fences fail visibly. For legacy `teachingText.pullQuote` cases, verify exact text, one CB3 per source highlight, stable instance ID, adjacency/order after the corresponding CB1, separate `statementBlock` output, and retention of any source-vs-prototype ordering discrepancy as an editorial review item.

**Schema mapping tests:** Required fields and options for CB1–CB9 and nested objects; Scripture-rights truth table; `challenge` and `challengeSeries` reference rules.

**Review tests:** Errors never overridden; warnings block by default; scoped override records; revision-sensitive invalidation; proposed review statuses not transformed into approved.

**Import tests:** Fresh draft created once; direct edit URL returned; duplicate slug detected across draft and published forms; no accidental publish; missing reference/time behavior explicitly covered; failure paths do not pretend success.

**End-to-end proof:** Import a designated, rights-safe `hello-world.berry.md` development Challenge and inspect it in Sanity and the Bibleberry developer reader. Then validate with substantive Alexis manuscript adaptations before declaring the language fit for editorial use.

## 11. Open decisions (do not silently implement)

1. Exact CLI syntax/output formats for Validate, preview mode, and Import.
2. Remaining context-specific mapping/escaping details **outside the now-approved field syntax**; exact case-sensitive CB field names, one-blank-line CB4/CB8 headers, `Name: |` multiline text, literal full-marker `\[[...]]` escape, and CB8 nested `SCRIPTURE` markers are approved.
3. Warning-override syntax and storage; editorial TODO disposition for draft import.
4. Where Sanity stores visible per-warning review records.
5. How truthful Aaron-or-Alexis approval maps into the Sanity schema.
6. How absent `releaseAt` and unresolved series references affect draft import.
7. Deterministic Sanity ID/key algorithm, revision marker convention, and duplicate detection.
8. Concrete advisory length thresholds from real UI trials.

These are **open design items**, not authorization to invent behavior while coding.

---

**Status reminder:** Only the workflow and principles are approved. This document is a draft for joint editorial and technical review, not a statement that a working validator or importer already exists.
