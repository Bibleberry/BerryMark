# Content Block Extension Procedure (CB10 and Beyond)

**Status:** Proposed engineering standard, for Aaron/Alexis review. Documentation only; no new CB is approved or implemented by this file.

**Purpose:** Adding an authored Content Block should be a predictable, auditable change across BerryMark, Sanity, and Bibleberry. The permanent type codes CB1–CB9 remain unchanged. New codes are **append-only**. Keep authored content, field meaning, semantic IDs, review status, and rendering consistent from source to reader.

**Authority:** [BerryMark block registry](../block-registry.md) · [language specification](../language-spec.md) · [compiler contract](../compiler-contract-v0.1.md) · Bibleberry Sanity schemas and CMS adapters. If implementations differ, explicitly resolve the inconsistency instead of silently choosing one.

## Decision gate: type, variant, or no new feature?

Before assigning CB10, write a one-page block proposal:
- Editorial purpose: what authored material requires the block, with a real Alexis use case.
- Why existing CB1–CB9 cannot already express it faithfully.
- Whether it is instead a new **presentation variant** for an existing type, an optional field, or a reusable renderer. Avoid type proliferation for purely cosmetic variation.
- Reader presentation and interaction, with mobile and accessibility behavior.
- Exact input fields, whether plain text, Portable Text, Scripture references, media, or nested objects.
- Optional versus required behavior and completion semantics. No optional expansion/reflection becomes a forced completion gate.
- Review policy: whether proposed/approved is required and what Alexis/Aaron must verify.
- Compatibility: what happens when an older reader encounters content with the new type; **never silently omit an unknown block**.
- Rights/source considerations for embedded Scripture or third-party materials.

**Approval gate:** Aaron approves the software scope; Alexis reviews editorial/teaching representation and ministry-facing visual choices. Do not begin implementation based on a speculative CB number alone.

## Implementation checklist (both repositories)

### A. Write a complete contract first

- [ ] Allocate next unused permanent code, e.g. `CB10`; never renumber or repurpose earlier codes.
- [ ] Add registry entry to BerryMark `docs/block-registry.md`: purpose, exact source syntax, grammar, field types, required/optional fields, field order, examples, Sanity destination, review and completion semantics.
- [ ] Update `docs/language-spec.md` and the compiler/validation contracts where needed; specify escapes and malformed-input behavior.
- [ ] Define stable author-chosen semantic IDs for block instances and nested repeatable items, key collision rules, and natural ordering.
- [ ] Choose a Sanity `_type`, field names, and deterministic mapping. Do not conflate an existing block's display name and its schema type.
- [ ] Define migration and compatibility behavior for older documents and older readers.

### B. BerryMark source and compiler

- [ ] Extend `src/parser.js` markers, context-sensitive field grammar, and AST shape.
- [ ] Update validation of required fields, allowed nesting, missing/duplicate IDs, literal prose, unsupported Markdown, rights constraints, and diagnostic source locations.
- [ ] Extend `src/compiler.js` to the new Sanity shape without silently rewriting, omitting, or inventing content.
- [ ] Update mapping/structural fingerprints and any importer candidate/readback-equivalence assumptions, including `src/import-planner.js` and the content fingerprint contract where applicable.
- [ ] Preserve repeatable-item order and semantic `_key` identities, and ensure deterministic compilation.
- [ ] Add negative and positive parser/compiler/CLI tests, including reorder determinism and failed-input diagnostics.

### C. Bibleberry Sanity and reader

- [ ] Add/update schema object under `studio/schemaTypes/objects/`, register via `studio/schemaTypes/index.ts`, and permit it in `challengeScreen`.
- [ ] Add review-status field and publication validation if the type requires human approval.
- [ ] Update runtime parsing in `src/cms/sanity/mapChallenge.ts` and `src/cms/sanity/berryMarkPreview.ts`; ensure published reader and local preview agree on the shape.
- [ ] Update types and discriminated unions in `src/cms/sanity/types.ts`.
- [ ] Implement the renderer in `src/cms/sanity/SanityChallengeLab.tsx` or an extracted reusable component; never rely only on a developer-only mock.
- [ ] Verify the public catalog projection and reader behavior when encountering an unknown/new block.
- [ ] Test optionality, interaction state, keyboard support, responsive typography, links, Scripture references, and completion semantics.
- [ ] If schemas change, account for Studio/editor deployment and reader compatibility before publishing content using CB10.

### D. Acceptance tests and evidence

- [ ] Add a rights-safe, `BM-TEST`-labeled source fixture that exercises all new fields plus representative edge cases.
- [ ] Run offline parser/validator/compilation tests, including expected errors and deterministic recompile.
- [ ] Test existing CB1–CB9 fixtures remain unchanged; keep tests for no unapproved content mutation.
- [ ] If separately authorized by Aaron, perform **staging-only** create/readback acceptance with a fresh unique identity and restricted credential; no production apply, reimport, or overwrite. Documentation or test work alone does not grant live write permission.
- [ ] Independently query Sanity for nested IDs, ordering, exact plain text, Portable Text marks and links, and editorial status.
- [ ] Preview through actual Bibleberry reader components; inspect visual behavior and interactions at mobile and desktop sizes.
- [ ] Document what is actually verified versus not tested. Do not claim CMS live-draft rendering from a local compiled JSON preview.
- [ ] Run repository CI/test gates as appropriate, then review, PR, Aaron merge.

## Automation plan (not implemented)

**Phase 1: Procedure now.** Use this checklist and a standard CB proposal template. Maintain a simple cross-repository change list.

**Phase 2: First genuine new block.** Implement CB10 using the procedure; note manual touchpoints and repeated code. Create test fixtures and expected screenshots.

**Phase 3: Mechanize repetition.** Consider:
- A **machine-readable block manifest** for type code, Sanity type, schema fields, source syntax metadata, and review semantics. Generate only what can be generated safely; do not declare a new single source of truth until both repositories' contracts and CI can enforce it.
- A scaffolder, conceptually `npm run block:new -- CB10`, that creates stubs, tests, fixture templates, a documentation checklist, and a PR plan. **This command does not exist yet.**
- An automated fidelity harness that compares source/AST, candidate JSON, stored Sanity objects, and renderer-visible content (including whitespace, keys, marks, links and ordering). Visual/a11y review remains necessary.
- A compatibility or schema-version contract so deploying CB10 content cannot break readers that only understand CB1–CB9.

**Avoid premature automation:** Experience from implementing the first new block should determine what the scaffolder actually generates.

## Completion / definition of done for a future block

A new CB is not accepted merely because parsing succeeds or a Sanity document stores it. Acceptance requires: approved editorial use and schema, robust parser/compiler support, importer/readback fidelity, correct reader rendering and interactions, backward-compatibility behavior, regression coverage, documentation, and reviewed PRs across affected repositories.

This checklist is a **planning artifact** and does not approve CB10 or relax any existing importer protection.
