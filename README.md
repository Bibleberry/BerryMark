# BerryMark

A Markdown-based domain-specific language for structured interactive content.

**Current stage:** BerryMark v0.1 has a **working experimental, read-only syntax and metadata validator** plus a **pure Sanity JSON compiler** that produces local candidate JSON and a separate review report. It is not a production compiler or Sanity importer.

## Get started (Node.js 20+)

```bash
npm ci
npm test
npm run check
npm run preview
node src/cli.js check examples/rejoice-always/rejoice-always.berry.md
npm run compile
npm run compile:rejoice
npm run plan
npm run plan:artifact
# Administrative read-only online dry run; requires a separately configured server token
npm run plan:online
# Administrative create-only draft dry run; apply requires separate explicit setup
npm run apply:draft
```

The validator uses the exactly pinned `yaml` dependency for safe YAML 1.2 parsing. Its `check` success verifies **experimental structure, field syntax, and supported metadata** only. The separate compiler uses the exactly pinned `marked` dependency to convert supported rich text into Sanity Portable Text without changing the parser API or validator commands. Compilation is deterministic and side-effect free; unresolved references, publishing values, rights evidence, approval, and editorial TODO/REVIEW REQUIRED annotations remain visible in the review report. A successful partial candidate is not schema-complete, import-ready, or publication-ready. The offline planner validates complete artifacts and produces zero-write dry-run reports. A separate experimental administrative CLI supports source-verified dry runs and explicitly configured create-only Challenge-draft apply; it never updates, deletes, publishes, or targets production. The only current Sanity datasets are `production` and private `staging`. By current owner-authorized policy, `staging` is the sole supported non-production apply target, and operators must configure both `BERRYMARK_SANITY_WRITE_DATASET=staging` and `BERRYMARK_SANITY_AUTHORIZED_WRITE_DATASET=staging`, with the approved project/API and a separate restricted credential. The existing code-level check validates an explicit, syntactically valid, matching non-production dataset and rejects `production`, but does not enforce the name `staging`; any other target remains outside policy and unauthorized. This issue grants **no live staging write permission**; further create-only acceptance requires Aaron's separate authorization. The online read-only planner intentionally remains pinned to `production`; that is not write approval.

Bibleberry R08A-4A monthly fixtures (`month-2096-02`, `month-2098-02`, `month-2098-03`, `month-2098-04`, and `r08a-stg-*` IDs) are Bibleberry-owned staging test documents. BerryMark's importer handles one-way Challenge drafts only; it does not handle `monthlyPublication`, month rosters, or fixture mutation.

## BerryMark Studio (Build 02)

Studio is a locally hosted Chromium workspace for creating, inspecting, organizing, and saving `.berry.md` manuscripts. Node.js 22 is the primary development and verification runtime; the package remains compatible with Node.js 20 or newer.

```bash
npm ci
npm run studio
```

Open the exact loopback address printed by the command in Chrome or Chromium. Stop Studio with **Ctrl+C**. No separate frontend process, database, account, external hosting service, AI service, or Sanity connection is used during ordinary editing.

The manuscript remains the authored product. Studio also saves a `<manuscript-name>.review.json` companion so source-digest-bound editorial review warnings survive reopening. Keep the two files together. Studio does not grant editorial or publication approval, and Build 02 intentionally provides read-only Content Block cards rather than specialized block editors.

- [Installation, startup, and author workflow](docs/development/studio-browser-application.md)
- [Architecture and API integration](docs/development/studio-application-architecture.md)
- [Review companion and interrupted-save recovery](docs/development/studio-review-companion.md)
- [Build 02 verification and manual-test record](docs/development/studio-build-02-verification.md)
- [Implementation handoff](docs/development/studio-build-02-handoff.md)

## Project references

- [Language specification](docs/language-spec.md)
- [Content Block registry](docs/block-registry.md)
- [Validation and import requirements](docs/validation.md)
- [Metadata validation contract and open decisions](docs/metadata-validation.md)
- [Manuscript editorial workshop](docs/manuscript-workshop.md)
- [Experimental parser and safety boundaries](docs/parser-alpha.md)
- [Pure Sanity JSON compiler](docs/sanity-compiler.md)
- [Compiler contract](docs/compiler-contract-v0.1.md)
- [Offline import planner and dry-run CLI](docs/offline-import-planner.md)
- [Authenticated read-only online dry-run planner](docs/online-import-planner.md)
- [Controlled create-only Sanity draft apply](docs/controlled-draft-apply.md)
- [Kimi Engineering Assignment 01: Read-Only Validation](docs/assignments/kimi-01-validation.md)
- [Kimi Engineering Assignment 02: Pure Sanity JSON Compiler](docs/assignments/kimi-02-compiler.md)
- [Synthetic all-block compiler example](examples/compiler-all-blocks.berry.md)
- [Rejoice Always working example](examples/rejoice-always/rejoice-always.berry.md)
- [Developer test plan](examples/rejoice-always/test-plan.md)

## Principles

Alexis's teaching determines the screen design. Preserve the original manuscript separately. Editor-approved BerryMark drafts eventually hand off **one way** to a new unpublished Sanity draft; they are never automatically published or reimported. Development diagnostics must be separate from reader-facing content.

BerryMark belongs in its own repository, separate from the Bibleberry app and Sanity schemas. All current implementation is experimental until the full validation and editorial gates are implemented and reviewed.
