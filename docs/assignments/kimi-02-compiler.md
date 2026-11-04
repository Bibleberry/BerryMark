# Kimi Engineering Assignment 02 — BerryMark v0.1 Pure Sanity JSON Compiler

**Status:** Prepared for handoff after Aaron reviews/merges the compiler-contract documentation PR.  
**Lead / authorization:** Aaron Waid  
**Architecture and acceptance review:** Aaron + ChatGPT  
**Implementation:** Kimi  
**Scope:** Pure, read-only compiler and tests. **No Sanity writes, no Bibleberry modifications, no import or publication.**

## 1. Starting point and branch discipline

- Repository: https://github.com/ContraPhilosophy/BerryMark
- **Authoritative development baseline:** `docs/berrymark-v0.1-specification`, which now contains the merged Phase 1 parser/validator PR #1.
- **Before you branch:** Confirm that `docs/compiler-contract-v0.1.md` and this assignment have been reviewed and merged into that baseline; re-read current HEAD. Do not start from bare `main` (currently an older baseline).
- Create **`feat/berrymark-sanity-compiler`** from the *then-current HEAD* of `docs/berrymark-v0.1-specification`. If the branch already exists, inspect before reuse.
- Submit **one reviewable PR targeting `docs/berrymark-v0.1-specification`**. Do not merge or write to `main` without Aaron's approval. Keep commits small and descriptive.
- The reference target Sanity schemas live in `ContraPhilosophy/Bibleberry` under `studio/schemaTypes/`. This assignment does not authorize changing that repository or dataset.

Do not treat the prior compiler-contract *draft* as approved merely because its file exists; Aaron will accept the contract PR before sending this assignment for implementation. The five substantive compiler principles are already approved; follow the final merged contract.

## 2. Your mission

Extend the already working BerryMark parser and typed metadata validator with a **deterministic, side-effect-free transformation into a partial or complete Sanity-shaped Challenge document candidate plus a separate editorial/compilation report**.

This is the first compiled-output milestone. It is not a Sanity importer, draft creator, rights verifier, author-approval gate, or a reader-side preview.

The key acceptance exercise is the real `examples/rejoice-always/rejoice-always.berry.md`. It must produce a faithful structured candidate and an honest unresolved report while preserving all known editorial gaps. It is **not** expected to become import-ready.

## 3. Read before coding

Read these files at the **merged baseline** before making decisions:

1. `docs/compiler-contract-v0.1.md` — governing Sprint 02 contract.
2. `docs/language-spec.md` — approved syntax, metadata semantics, Markdown subset, and one-way workflow.
3. `docs/block-registry.md` — all nine CB types and exact Sanity target structures.
4. `docs/validation.md` — fidelity, severity, review gates, and import boundaries.
5. `docs/metadata-validation.md` and `docs/parser-alpha.md` — current validator AST and truthful limitations.
6. `docs/proposals/field-declarations-v0.1.md` — **approved** exact field grammar.
7. `src/parser.js`, `src/metadata.js`, `src/scripture.js`, `src/cli.js`, `package.json`, `package-lock.json`, both existing test suites, and existing fixtures.
8. `examples/rejoice-always/rejoice-always.berry.md`, the accompanying test plan and workshop notes.
9. In `ContraPhilosophy/Bibleberry`: `studio/schemaTypes/documents/challenge.ts`, `challengeSeries.ts`, `objects/challengeScreen.ts`, the nine CB-target object schemas and nested objects, `scriptureReference.ts`, `companionLink.ts`, `editorialReview.ts`, and `fields.ts`.

Treat the actual target schemas as the integration truth. If the current schema differs from the compiler contract, **report it as a design blocker** rather than inventing an undocumented mapping.

## 4. Required deliverables

### A. Pure compiler entry point and structured result

- Add one documented compiler module or minimal internal modules; reuse the existing validator AST. Preserve its current public API and diagnostic formats.
- Reject already-invalid parser/metadata results. A failed compile returns blocking located errors and no misleading valid candidate.
- Produce a serializable **`sanityCandidate`** and **`reviewReport`** (or equally explicit documented names), with `ok`/`schemaComplete` state **distinct** from import/publication readiness.
- No side effects: no `fetch`, file mutation, Sanity API, environment credential lookup, random key, current-time metadata, network calls, or database writes.
- Preserve source identity/fingerprint and exact authored metadata states. Reports must keep absent vs explicit `null` distinct.
- A developer CLI/output facility may print results to stdout, but it must not alter existing `check`, `preview`, and `json` semantics. It is a developer transform, not a public editorial operation.

### B. All screens and nine Content Block types

Map `SCREEN`, CB1–CB9, and every registered nested object per `docs/compiler-contract-v0.1.md`. Preserve order and identity. Implement exact Sanity `_type` fields, semantic `_key` fields on structural array objects, required values and genuinely optional values.

Required specifics:

- CB1, CB4 side bodies and CB8 bodies are **Portable Text**, not raw Markdown/plain text.
- CB2, CB8 nested Scripture and primary Scripture use the shared `scriptureReference` shape. Never invent passage text or quote rights.
- CB3 remains a separate ordered statement block, never duplicated in CB1.
- CB4–CB8 always remain `reviewStatus: 'proposed'` in the candidate with an explicit controlled-state entry in the report.
- CB7 reflection/choices and CB8 studies remain optional reader experiences. Do not inject completion gates.
- CB9 paragraphs retain the author's exact substantive prayer, without AI-generated replacement or Markdown styling.
- Do not silently discard annotations, extra text, unsupported directives, or nested content.

### C. Markdown → Portable Text

Implement the approved Markdown subset only: paragraphs and representable breaks, strong/emphasis, h2/h3, blockquotes, bullet/number lists and HTTP(S) links, with Unicode support. Use an appropriate maintained parsing library and document/license/pin dependencies with a lockfile. Regex-only or lossy conversion is not acceptable.

Build valid Sanity Portable Text blocks with spans/marks/link annotations and deterministic keys. For unsupported constructs (tables, images, code blocks/spans, arbitrary HTML, unsupported links/headings or unrepresentable nests), produce a located blocking failure with screen/CB ID and source location. Never reword or truncate to force a fit.

Plain-text-only fields must be preserved as plain text; unsupported rich markup must not be silently interpreted/stripped.

### D. Metadata, identity and honesty

- Map authored Challenge title/slug/type/summary accurately; do not derive slug from title.
- `publishing.series` is an existing **series slug**, **not** a ready Sanity `_ref`. Do not invent a target document ID. Preserve it as an unresolved lookup in `reviewReport`.
- Incomplete `series`/`sequence`/`releaseAt` must yield a faithfully **partial** candidate and `schemaComplete: false`; valid unfinished editorial information alone is not a content compilation error.
- Map truthful, safe editorial source fields. Preserve source `sourceAuthor` and original approval information in the sidecar; do not insert unsupported fields in Sanity or silently promote approval into `adaptationReviewed: true`.
- Generate the documented conservative candidate states (`adaptationReviewed: false` for nontransferred review; `reviewStatus: 'proposed'` for CB4–CB8) and report them as controlled mappings.
- Preserve explicit Scripture rights/assertion status without external license claims.
- Derive structural array `_key` values from the original semantic IDs, **not array positions**. For Portable Text and companion links, provide a documented deterministic method, tests for collisions/repeatability, and an explanation of any content-key churn. Do not change BerryMark syntax merely to create keys.
- Every unresolved review item, source annotation, optional URL and author-supplied metadata state must remain accessible in `reviewReport`. Do not put editor-only content into reader text.

### E. Tests, fixtures and compatibility evidence

Add focused automated tests beyond the 43 existing validator tests. Cover:

1. Structural mapping for **each of CB1 through CB9**, including all nested array/object varieties and optional fields.
2. Sanity-correct `_type`/`_key` and field names, mandatory Portable Text shapes, plain-text-versus-rich-text distinctions, and ordered arrays.
3. Approved Markdown features in combination; visible-text fidelity; malicious or unsupported content; link scheme rejection.
4. Stable semantic keys under sibling reorder and deterministic output from repeated identical source.
5. Duplicate/collision behavior and companion-link/Portable-Text generated-key behavior.
6. Reference-only Scripture, provided text/rights, and nested CB8 Scriptures; no fabricated passages.
7. Deferred publishing metadata, pending/approved source claims, missing/null companion URLs, lack of fabricated series `_ref`, approvers and dates.
8. Complete `Rejoice Always` structure: **7 screens, 16 top-level CBs, 3 optional studies, 4 nested Scriptures, and 17 preserved editorial annotations**. Compare content/ordering with the source, including exact CB3 pullQuote wording and placement.
9. Source comments absent from all reader-facing fields; visible unresolved review report retains source locations, original text and statuses.
10. Invalid validator input, unsupported Markdown/structures and unrepresentable fields produce nonzero output status and no apparently successful candidate.
11. Instrument/disable `globalThis.fetch`; ensure compiler makes no network requests and never calls any Sanity write path.
12. Test the final compiler-generated candidate's **schema-compatible portions** against the documented Bibleberry schema snapshot, without claiming schema completeness when required publishing data remains unresolved.

The regression suite and existing `npm run check`, `npm run preview` and real `Rejoice Always` validator check must remain green. Keep GitHub Actions passing. If a workflow change is blocked by credentials, explain rather than hiding it with unrelated architecture changes.

### F. Inspectable demonstration

Produce an inspectable machine-readable result (stdout/fixture/test artifact) from **both**:

- A synthetic rights-safe document exercising all nine CB types and the supported Markdown features.
- The complete `Rejoice Always` source, with a separate review report that calls out its unresolved series, sequence, release timestamp, pending approval, reference-only Scripture, and 17 editorial annotations.

For the real manuscript, verify that no substantive teaching or prayer has been silently altered, no quote duplicated, and no unresolved review marker leaked into the reader-facing candidate. Do not insert test identifiers into Alexis's source.

## 5. Boundaries and design escalation

**Not authorized in this sprint:**

- Change or add a Sanity schema in Bibleberry; alter its frontend or Developer Studio.
- Create, patch, publish, approve or delete Sanity documents or datasets.
- Create a draft importer, preview authentication, source synchronization or publication gate.
- Assign a synthetic `_id` or series `_ref`, automatically resolve a series by querying Sanity, or decide duplicate-identity policy.
- Turn an author assertion of Scripture rights into independently verified license evidence.
- Set `adaptationReviewed: true`, invented reviewer/date, or structured-block approval as an artifact of successful compilation.
- Hide/ignore warnings, TODOs or review conditions through a broad override.
- Extend the BerryMark grammar or compress Alexis's teaching merely because a destination field is inconvenient.

If a target mapping is genuinely ambiguous or cannot be losslessly expressed, document the smallest decision needed, provide two defensible options, and leave that case explicitly unresolved rather than inventing a policy. Continue with other independently safe compiler cases.

## 6. Engineering handback required

Submit a **PR to `docs/berrymark-v0.1-specification`** and provide:

1. Branch, commit SHA, PR URL, file-by-file summary and any new dependency choices.
2. Compiler API, exact result shape, sample successful/failed output and how to run the demonstration.
3. Exact test commands, counts, results, negative-case coverage and GitHub Actions URL.
4. Proof of `Rejoice Always` 7/16/3/4/17 invariants and content/text fidelity, with its legitimate unresolved state.
5. Explanation and fixtures for structural and generated deterministic keys.
6. Description of every compiler/report field that does **not** yet map into current Sanity and why, including review and series.
7. Any outstanding architectural decisions and proposed options. Identify what remains for future draft import, secure preview, external rights verification, editorial approval and publication.

**Definition of done:** A genuinely pure and deterministic compiler translates every supported BerryMark content block into correctly shaped local Sanity candidate JSON, converts approved Markdown without substantive loss, preserves source/editorial truth in a separate report, treats incomplete metadata honestly, rejects unsupported content visibly, and passes tests/CI. **It does not import anything.**

## 7. Suggested implementation sequence (not a mandate to overengineer)

1. Define candidate/report types and golden fixtures; add a read-only transform with no dependencies on Sanity APIs.
2. Map basic metadata and CB2/CB3/CB5/CB6/CB7/CB9 using exact fields; prove stable keys and safe default states.
3. Implement AST-based Markdown-to-Portable Text with positive and fail-loud negative tests, then wire CB1/CB4/CB8.
4. Complete real manuscript comparison and source/editorial report, review all mapping gaps, run full CI.
5. Submit reviewable PR; wait for Aaron's explicit acceptance before any merge.

**Project sequence remains:** Validate → **pure compiler (this sprint)** → sanctioned schema reconciliation → controlled unpublished-draft import and protected developer preview → distinct human approval and publication decisions.
