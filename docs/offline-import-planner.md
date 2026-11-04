# Offline BerryMark → Sanity Import Planner

**Status:** Experimental dry-run planning only  
**Scope:** Complete compiler-result validation and human-readable reporting  
**Not included:** Authentication, network lookups, Sanity writes, publication, or approval transfer

## Local CLI

Run from the BerryMark repository root with Node.js 20 or later:

```bash
# Verify the exact manuscript and its complete compiled artifact
node src/import-plan-cli.js examples/compiler-all-blocks.compiled.json \
  --source examples/compiler-all-blocks.berry.md

# Inspect the artifact without claiming independent source verification
node src/import-plan-cli.js examples/compiler-all-blocks.compiled.json
```

The equivalent package scripts are `npm run plan` and `npm run plan:artifact`. The CLI prints the complete dry-run report as readable JSON. It uses the committed `test/bibleberry-schema-v0.1.snapshot.json` as the target-schema reference.

Exit statuses:

- `0`: The dry run completed. `proposedAction: "unknown"` is expected because authenticated identity, duplicate, and other external checks remain outstanding.
- `1`: Structural validation or source/artifact verification rejected the input.
- `2`: The command arguments, JSON input, or local files could not be read.

A zero exit status is not import authorization. No CLI option applies a mutation.

## Pure API

```js
import { planBerryMarkImport } from './src/import-planner.js'

const report = planBerryMarkImport({
  compilation,   // Complete parsed compiler result
  source,        // Optional exact source text; omit for artifact-only mode
  schemaSnapshot // Parsed existing Bibleberry schema snapshot
})
```

The planner performs no filesystem or network I/O. File access exists only in the CLI and tests. It reuses `compileBerryMark()`, the existing SHA-256/stable serialization utilities, Scripture consistency rules, and the existing schema snapshot.

## Verification states and gates

**Source-verified** mode recomputes SHA-256 over the exact, unmodified source and recompiles it using the artifact's recorded source filename. The candidate and all compiler-produced report data must match. Optional human `classification` and `reviewHistory` fields on editorial items are preserved as review overlays; they are not treated as compiler output. Any other mismatch produces `BM_IMPORT_ARTIFACT_MISMATCH`.

**Artifact-only** mode performs structural and internal-consistency checks only. It explicitly reports that independent source verification was not performed and always has `importEligible: false`.

Structural validity, source verification, local import eligibility, external authorization, editorial approval, publication, and reader release are distinct. Even a source-verified, locally eligible report retains:

- `lookup.status: "offline"`
- `proposedAction: "unknown"`
- Identity and slug duplicate-check dependencies
- Series-reference resolution when a series slug is supplied
- Independent rights-evidence requirements for provided passage text
- Conservative `adaptationReviewed: false` and proposed CB4–CB8 review states

The approved incomplete-draft policy allows unresolved publishing metadata and actionable editorial items to remain visible without making faithful teaching content structurally invalid. No missing value, approval, right, URL, or reference is invented.

## Editorial reporting

`TODO` and `REVIEW REQUIRED` items are actionable. An `EDITORIAL NOTE` is informational unless its optional explicit `classification` is `actionable`. Original category, text, source location, unresolved status, and available review history are retained. Informational notes do not automatically block publication. The planner never resolves an annotation or adds annotation text to reader-facing teaching.

Ordinary non-editorial `COMMENT` items remain in compiler counts and source verification but are not mislabeled as editorial decisions or notes in the dry-run report.

## Demonstrations

```bash
npm run plan
node src/import-plan-cli.js examples/rejoice-always/rejoice-always.compiled.json \
  --source examples/rejoice-always/rejoice-always.berry.md
```

The synthetic all-block demonstration validates all nine Content Block types and reports one outstanding independent Scripture-rights evidence requirement. *Rejoice Always* verifies against its exact manuscript, reports null series/sequence/release metadata without inventing replacements, and separates 11 actionable annotations from 6 informational notes. Both retain unknown offline actions and zero writes.
