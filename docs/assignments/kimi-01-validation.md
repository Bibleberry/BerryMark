# Kimi Engineering Assignment 01: BerryMark v0.1 Read-Only Validation

**Status:** Ready for engineering handoff, November 3, 2026  
**Owner / design review:** Aaron + ChatGPT  
**Implementer:** Kimi  
**Priority:** First bounded implementation sprint; **no import or CMS write access**  
**Repository:** https://github.com/ContraPhilosophy/BerryMark  
**Existing baseline branch:** \`docs/berrymark-v0.1-specification\`  
**Implementation branch:** Create \`feat/berrymark-metadata-validation\` **from the current HEAD of the baseline branch**, not from \`main\`. If the branch already exists, inspect its history/status before reuse. Propose a PR **back into the baseline branch** for review. Do not merge or modify protected \`main\` on your own.

## 1. Your mission

Extend the **existing**, working Node.js BerryMark parser into a **side-effect-free, read-only validation pipeline** that correctly parses YAML front matter, validates its supported metadata, reconciles metadata with existing structural checks, and reports useful, source-located diagnostics. The pipeline must preserve authored content and be safe as the eventual input to the compiler. It must **not** create Sanity documents or claim publication readiness.

This is **not** an assignment to design a replacement language, rewrite everything in Rust, build the Sanity compiler, add a visual editor, or integrate the Bibleberry app. Keep the implementation small and testable.

## 2. Read before changing code

Read these **from the baseline branch**, not the bare \`main\` branch:

1. \`README.md\`
2. \`docs/language-spec.md\` (especially §4 front matter, shared Scripture data, approved field grammar)
3. \`docs/block-registry.md\` (CB1–CB9 and type-specific constraints)
4. \`docs/validation.md\` (error/warning/editorial-info distinctions, import safeguards)
5. \`docs/parser-alpha.md\` (current behavior and limitations)
6. \`docs/proposals/field-declarations-v0.1.md\` (already approved, **not** merely an unaccepted idea)
7. \`src/parser.js\`, \`src/cli.js\`, \`package.json\`, \`test/parser.test.js\`
8. \`examples/hello-world.berry.md\`, \`examples/invalid-duplicate-ids.berry.md\`
9. \`examples/rejoice-always/rejoice-always.berry.md\`, \`examples/rejoice-always/test-plan.md\`, \`examples/rejoice-always/workshop-notes.md\`

The existing source is **already executable**. On the baseline, 23 Node.js regression tests and both real/synthetic syntax checks passed in GitHub Actions. Do **not** throw it away without a separately explained, test-supported reason.

## 3. Required implementation

### A. Actual YAML parsing and typed front matter

- Replace the current delimiter-only treatment of YAML with **real, safe YAML parsing**. You may select a maintained, established JavaScript YAML library, justify the selection, and commit a reproducible lockfile. Use Node.js 20+ and the existing ESM project.
- Reject malformed YAML, non-mapping root values, duplicate keys, unsupported/custom tags and unsafe constructs. Do not execute anything from YAML. Ensure nested YAML strings (including \`:\`, punctuation, multiline descriptions and Unicode), booleans, numeric fields, arrays and explicit \`null\` are faithfully interpreted.
- Preserve the existing front-matter raw text and source spans as useful provenance. Expose **separately** a parsed, typed representation in the AST, rather than discarding the original. The exact AST property name is an implementation choice; document it.
- Keep source file/line/column locations for malformed YAML and semantic errors. If the YAML library reports offsets, translate them to locations within the original \`.berry.md\` source.

### B. Validate supported BerryMark metadata

Implement a clearly documented v0.1 subset grounded in \`docs/language-spec.md\`; use strict types and **never coerce or invent values**:

- Version: \`berrymark: "0.1"\` must be present and exactly supported; reject missing/unsupported versions.
- \`challenge\`: validate the declared fields \`title\`, stable author-supplied \`slug\`, \`type\` (currently \`teaching\`, \`discipline\`, \`reflection\`, \`memorization\`) and optional \`summary\`. Never derive a slug from the title.
- \`publishing\`: preserve \`series\`, \`sequence\`, \`releaseAt\` as explicitly given. Check supplied \`sequence\` is a positive integer, and validate supplied \`releaseAt\` as a timezone-aware datetime. \`null\` / unscheduled values are allowed in a **working draft**, but must be visibly marked as unresolved for publication, **not** silently filled in or interpreted as “now”.
- \`scripture\`: validate \`reference\`, \`translation\`, \`textStatus\`, optional \`passage\`, \`usageRightsConfirmed\`, and \`practiceStatus\` using the same consistency rules as CB2/nested CB8 SCRIPTURE. Never infer quotation rights from the manuscript. A \`true\` rights flag is a user assertion, **not independent proof of a license**.
- \`editorial\`: preserve \`sourceTitle\`, \`sourceAuthor\`, \`sourceRevision\`, \`approvalStatus\`, \`approvedBy\`, \`approvedAt\` truthfully; reject impossible types/contradictory combinations, but **do not invent a reviewer or approval date**. \`pending\` must remain pending.
- \`companionLinks\`: array semantics; validate known \`provider\` values, required \`label\`, optional \`description\`, optional HTTP(S)-only \`url\`, and \`availability\`. A missing/null URL is legitimate, especially for editorial metadata; do not invent URLs.
- Unknown or misspelled **recognized** field paths must not be silently dropped. Prefer a source-located diagnostic. Where the current spec does not unambiguously establish whether an item is mandatory or how it maps to Sanity, **record a decision request**, rather than inventing language policy.

**Important real example:** \`Rejoice Always\` has \`publishing.series: null\`, \`sequence: null\`, \`releaseAt: null\`, \`editorial.approvalStatus: pending\`, reference-only Scripture and companion links with \`url: null\`. It should remain a valid **working document**, with truthful incomplete/review state, **not** magically become import-ready or publication-ready.

### C. Integrate, don't bypass, the existing syntax parser

- Preserve approved context-sensitive \`Name: value\` fields, multiline \`Name: |\`, blank-line rich title headers, \`[[SCRIPTURE id=...]]\`, CB1 prose, stable semantic IDs, CB3 pullQuote mapping, and existing marker nesting.
- Retain the current seven-screen, 16-CB \`Rejoice Always\` structure. Do not change Alexis's teaching, split screens, remove editorial comments, add synthetic TEST strings to her content or copy NIV passages into the output.
- Ensure the **same authoritative Scripture consistency checks** apply to front matter and block-level Scripture, preferably through shared pure helper logic rather than duplicated rules.
- Preserve explicit \`<!-- TODO: ... -->\` and \`<!-- REVIEW REQUIRED: ... -->\` annotations as **unresolved editorial items**. They must not disappear because structural validation succeeds.

### D. Diagnostics, CLI and honest status

- Keep read-only \`check\`, \`preview\`, and \`json\` CLI entry points working, with nonzero exit status on blocking errors. You may improve the names/output and add an internal validation module without changing the approved external workflow.
- Diagnostics must clearly distinguish **error**, **warning**, **editorial item**, and **informational/deferred state**, with rule identifier, filename, line/column and ideally a metadata path or block ID. Avoid generic “invalid document” errors.
- A clean **syntax + metadata** check must **not** be labeled “safe to import” or “approved to publish”. A separate future readiness gate is planned; do not fake it.
- Preserve the existing experimental parser output/diagnostics where reasonable; any breaking change needs a documented migration and tests.
- Do not build warning overrides in this sprint: their format/storage and post-import disposition remain open architecture decisions.

## 4. Automated acceptance tests (non-exhaustive)

**Preserve the existing 23 tests**, updating expectations where a test intentionally relied on invalid YAML being accepted. Add regression cases for:

1. Valid real \`Rejoice Always\` metadata with explicit \`null\` release, sequence and series; correct pending editorial status.
2. A legitimate **complete synthetic** Hello World document with safe metadata; preserve its obvious \`BM-TEST\` markers as development-only content.
3. Malformed YAML, duplicate YAML keys, non-object YAML root, unknown version, missing required metadata, unsupported enum, mistyped booleans/arrays/numbers.
4. YAML strings with colons, apostrophes, Unicode, multiline scalar text; source line/column diagnostics on errors.
5. Explicit \`null\` versus absent fields; ensure neither silently becomes \`true\`, an approval, a release date, or a fabricated URL.
6. Invalid \`sequence\`, invalid/timezone-less \`releaseAt\`; valid offset-aware datetime.
7. \`scripture\` status-rights-practice combinations, including reference-only with prohibited passage, provided-without-passage, and configured practice lacking rights-cleared provided text.
8. Editorial metadata that is \`pending\` and contains \`approvedBy: null\`; rejection of fabricated/inconsistent approvals without approving anything automatically.
9. Companion links with absent/null URL (valid); \`javascript:\`, \`file:\` and non-HTTP(S) URL (invalid).
10. CB1 \`Title:\` remains prose; CB3 multiline fields; all seven real screens remain structurally intact; nesting/duplicate-ID failures remain caught.
11. Verify errors yield nonzero CLI exit codes; JSON diagnostics are useful to a downstream build tool; editorial TODOs do not vanish.
12. No Sanity network calls or writes occur in the validation process.

Add fixture(s) as needed and amend \`test/parser.test.js\` or split it into focused test files. Test *actual CLI behavior*, not only internals. Re-run \`npm test\`, \`npm run check\`, and \`node src/cli.js check examples/rejoice-always/rejoice-always.berry.md\`.

**CI:** Keep \`.github/workflows/parser-tests.yml\` green; update it only to support the new test suite/dependency installation. The baseline currently has no runtime dependencies, so any YAML dependency is a deliberate addition.

## 5. Explicit non-goals / safety boundaries

**Do NOT:**

- Implement the Sanity adapter/compiler, importer, schema writes, draft-preview auth, or automatic publication.
- Modify \`ContraPhilosophy/Bibleberry\`, its Sanity schema, production dataset, reader UI or deployments.
- Add Sanity API tokens or any secret to repository contents, client-side code, or tests.
- Make data-loss “best effort” transformations, silent defaults for rights/approval/release, or broad “ignore errors” switches.
- Remove the development/test distinction or embed diagnostic UI strings in Alexis's manuscript adaptation.
- Change approved language syntax because it is inconvenient to parse; submit an explicit proposed change for discussion if needed.
- Treat passing parsing tests as a theological/editorial approval.

## 6. Deliverables and handback

Submit **one reviewable PR targeting \`docs/berrymark-v0.1-specification\`** (or, if you cannot create a PR, provide the branch name, commit SHA, and a concise change report). Do not merge without Aaron's review.

Hand back:

1. Summary of files added/changed and dependency choice.
2. The new validation entry point/API and sample CLI output for a valid document and an invalid one.
3. Automated test counts and exact commands run, plus GitHub Actions result/link if available.
4. Evidence that \`Rejoice Always\` retains seven screens, sixteen CBs, pending review markers, and its deliberate \`null\`/reference-only metadata.
5. List of **open architectural decisions** encountered, with proposed options rather than unauthorized policy decisions.
6. A short note identifying what is still unimplemented, especially Portable Text conversion, Sanity import, protected preview, and publication/rights approvals.

**Definition of done:** Real YAML is parsed and typed, supported metadata is validated without fabrication, source locations are useful, existing content/structure is retained, negative cases reliably fail, tests and CI pass, and no write-side infrastructure was introduced.

## 7. Work style

Make small, inspectable commits and use the existing code and docs as the source of truth. Prefer extending the tested parser to replacing it. If a spec is genuinely ambiguous, isolate that rule as an explicit decision item; keep the remainder of the sprint moving rather than improvising a permanent policy.

This is BerryMark's **first validator sprint**, not a mandate to finish the language in one PR. The bigger roadmap is **Validate → pure Sanity JSON compiler → protected visual inspection → controlled unpublished-draft Import**, each separately reviewed.
