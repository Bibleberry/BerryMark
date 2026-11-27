# BerryMark Studio Build 01 — Document Engine Architecture

**Status:** Build 01 implementation contract
**Scope:** Source-preserving programmatic editing only; no graphical application, server, filesystem abstraction, Sanity connection, import, or publication behavior

## Decision

Use a **hybrid concrete-syntax/source-range model**. The document engine owns the exact source string and a small structural index of existing BerryMark markers, HTML comments, YAML front-matter boundaries, line endings, and source offsets. It uses the existing `parseBerryMark` result for typed metadata, editable Content Block semantics, annotations, and validation diagnostics. It uses the existing YAML library's CST/document support for localized metadata updates.

The existing parser AST remains the semantic compatibility baseline. It is not a lossless concrete syntax tree: it normalizes line endings, trims body-edge blank lines, removes escape backslashes, and stores comments separately from their structural locations. Reconstructing a document only from that AST would violate the Build 01 fidelity contract.

## Editing strategy

- An unchanged document is returned from the same retained source string, byte for byte.
- Metadata edits use YAML document/CST manipulation and replace only the front-matter region.
- Field edits replace the located declaration (including its indented multiline value), leaving surrounding source untouched.
- Rich/plain body edits replace only the applicable body region while retaining HTML editorial comments.
- Insertion, removal, and reorder operations move or add exact source ranges. Existing semantic IDs are never regenerated.
- New source is serialized through one block/field serializer shared by document, screen, block, and nested-element construction. Full reserved-marker lines supplied as freeform text are escaped using the existing language rule.
- Every mutation is atomic. The engine re-indexes and reparses the candidate source; an unsafe structural result rejects the operation and restores the prior source. Semantic incompleteness remains permitted and visible through the unchanged validator.

## Working state versus validity

`openBerryMarkDocument` always preserves supplied source. Its status is:

- `valid`: structurally editable and the existing validator reports no blocking errors;
- `incomplete`: structurally editable, but the validator reports missing fields, empty required containers, or other semantic/authoring errors;
- `unsupported`: malformed markers, ambiguous/duplicate identities, unsafe YAML, unknown metadata extensions, or another condition for which safe targeted editing is not guaranteed. Unsupported documents are read-only and retain exact source plus diagnostics.

A successful `validate()` call means only what the existing BerryMark validator means. It does not imply compilation success, import readiness, editorial approval, Scripture rights, or publication readiness.

## Identity

Existing IDs come from source and remain attached to their source range during edits and moves. New IDs are validated against the existing grammar. Callers may supply an exact ID or a semantic hint; hint-derived IDs are deterministic kebab-case names with the smallest numeric suffix needed to avoid a collision. A missing meaningful hint is an explicit operation error rather than a positional ID. Numeric suffixes disambiguate identity; they do not encode array position.

## Editorial approval

The engine never clears, replaces, or invents approval metadata. If a document whose source was already approved is edited outside the explicit approval fields, it emits `BM_STUDIO_APPROVAL_STALE` for human review while preserving the authored approval claim. This warning is engine review state, not a new BerryMark validation or publication policy.

`serializeReviewState()` exports that warning as a versioned JSON string bound to the exact source SHA-256. A host that saves both source and review state can restore the warning with `openBerryMarkDocument(source, { reviewState })`; mismatched state is rejected. Source-only reopening cannot infer earlier edit history and therefore does not invent a stale warning. It also does not certify the source: the unchanged compiler continues to withhold Sanity approval transfer and publication readiness. Build 01 provides no operation that clears the warning or marks revised content human-approved.

## Tradeoffs and boundaries

- The structural index deliberately duplicates only marker/range recognition, not BerryMark field semantics or validation. The existing parser and validator remain authoritative.
- Moving a block moves its internal comments. A leading comment outside that block stays in place because the current language has no unambiguous comment-to-block association.
- Replacing a whole body is an intentional replacement of that body's prose, not a diff of individual paragraphs. Editorial comments in the affected region are preserved verbatim; prose elsewhere is untouched.
- YAML CST output preserves existing comments, quoting, key order, and unrelated values. Newly inserted values use the YAML library's presentation, and the specific replaced value may receive that library's current quoting/layout; no alternative style for the changed value itself is guaranteed. Semantically identical writes and absent deletes are exact no-ops. No body source is rewritten by metadata operations.
- Mixed line endings are preserved when unchanged. New text uses the document's first detected newline convention; existing unrelated ranges are not normalized.
- Filesystem access and browser file handling belong to a later build. Build 01 accepts and returns strings only.

## Verification contract

Tests cover exact LF/CRLF/BOM round trips, all CB1–CB9 fixtures, comments/annotations, literal markers, Unicode and multiline text; targeted metadata/body/field edits; screen/block/nested moves, insertion, removal, and cross-screen movement; incomplete documents; invalid operations; all-block construction, validation and compilation; compiler equivalence before/after unchanged round trips; source-fingerprint changes after edits; approval review-state persistence; and the complete pre-existing suite. Existing compiler goldens and parser/compiler public contracts remain unchanged.

The public API, usage examples, executable construction demonstration, save/reopen behavior, and reproduction commands are documented in [studio-document-engine-api.md](studio-document-engine-api.md).
