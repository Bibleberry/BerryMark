# Importer-Owned Content Fingerprints

**Status:** Pure fingerprint contract; no authentication, network access, Sanity writes, or publication.

`src/import-fingerprint.js` exposes `projectCandidateImportContent(compilation, schemaSnapshot)` and `candidateSha256(compilation, schemaSnapshot)` for a compiler result, and `projectSanityDraftImportContent(document)` and `lastImportedContentSha256(document)` for a Sanity Challenge document. Candidate functions first call `validateImportCompilation`; this is structural candidate validation, not independent source verification. The existing offline planner remains responsible for source/artifact comparison.

## Version and encoding

The version identifier is `berrymark-import-content-v1`. The exact bytes hashed are the UTF-8 encoding of:

```text
berrymark-import-content-v1\n + stableStringify(canonicalProjection)
```

The result is lowercase hexadecimal SHA-256. `stableStringify` recursively sorts object keys using JavaScript string ordering, emits compact JSON, and preserves array order. Thus object insertion order does not matter, while screen, block, Portable Text, Scripture, companion, and other nested array order does. A missing property is omitted; an explicit `null` is encoded as `null` and differs from omission. JSON number formatting follows `JSON.stringify` (for example, `-0` serializes as `0`); fingerprints reject non-finite numbers and non-JSON values before serialization. No clock, randomness, timestamps, `_rev`, or network data participates.

## Importer-owned allowlist

The projection includes only these Challenge fields:

- Root: `_type`, `title`, `slug` (`_type` and `current`), `challengeType`, optional `summary`, `primaryScripture`, ordered `screens`, optional ordered `companionLinks`, and `editorialReview`.
- `scriptureReference`: `_type`, optional `_key`, `reference`, `translation`, `textStatus`, optional `passage`, optional `usageRightsConfirmed`, and `practiceStatus`.
- `challengeScreen`: `_type`, `_key`, optional `screenLabel` and `heading`, and ordered `blocks`.
- CB1 `richTextBlock`: `_type`, `_key`, and `body`; Portable Text blocks include `_type`, `_key`, `children`, `markDefs`, `style`, and optional `listItem`/`level`. Spans include `_type`, `_key`, `marks`, `text`; link definitions include `_type`, `_key`, `href`.
- CB2 `scriptureBlock`: `_type`, `_key`, `scripture`.
- CB3 `statementBlock`: `_type`, `_key`, `text`, optional `label`.
- CB4 `comparisonBlock`: `_type`, `_key`, `left`, `right`, optional `footer`, `reviewStatus`; each `comparisonSide` includes `_type`, `title`, `body`.
- CB5 `visualCardsBlock`: `_type`, `_key`, ordered `cards`, `reviewStatus`; each `visualCard` includes `_type`, `_key`, `title`, optional `body`.
- CB6 `connectedSequenceBlock`: `_type`, `_key`, ordered `steps`, optional `cycle`, `returnCaption`, `conclusion`, and `reviewStatus`; each `sequenceStep` includes `_type`, `_key`, `title`, `body`.
- CB7 `reflectionBlock`: `_type`, `_key`, `question`, optional ordered `choices`, optional `closing`, and `reviewStatus`; each `reflectionChoice` includes `_type`, `_key`, `label`, `prompt`.
- CB8 `optionalStudyBlock`: `_type`, `_key`, `title`, `body`, optional ordered `scriptures`, and `reviewStatus`.
- CB9 `prayerBlock`: `_type`, `_key`, `paragraphs`.
- `companionLink`: `_type`, `_key`, `provider`, `label`, optional `description`, `url`, and `availability`.
- `editorialReview`: `_type`, `sourceTitle`, optional `sourceRevision`, and `adaptationReviewed`.

The conservative `editorialReview.adaptationReviewed: false` is included in the hash; it is not approval. The candidate must preserve that false value. Human `reviewedBy`, `reviewedAt`, and `reviewNotes` are excluded. Human-owned root fields `series`, `sequence`, and `releaseAt` are excluded, as are `_id`, `_rev`, `_createdAt`, `_updatedAt`, `importProvenance`, and all compiler/editorial report or sidecar fields.

The candidate projection is allowlist-based and relies on the existing strict compiler-result validator, which rejects unknown candidate subtree fields. For Sanity documents, root-level server or unrelated fields are not projected; unknown fields inside importer-owned objects (including nested blocks and Portable Text) are rejected rather than silently discarded. Known human review fields in `editorialReview` are stripped. This separates prospective candidate validation from projecting a stored document with Sanity metadata.

## Provenance compatibility and scope

`candidateSha256` fingerprints the structurally validated candidate projection. `lastImportedContentSha256` fingerprints the same allowlisted content projection as stored/read from Sanity. Equivalent inserted and read-back content therefore has the same digest, while server metadata and excluded human-owned publishing/review fields do not affect it.

For Bibleberry `importProvenance`, keep the meanings distinct: `sourceSha256` is the exact BerryMark source-text digest; `candidateSha256` is this versioned candidate-content digest; `lastImportedContentSha256` is the digest recomputed from imported document content. Equality can support later content-integrity checks, but does not authorize publication, review, or overwriting human changes. This PR adds only pure functions; it does not change Bibleberry or write provenance. The existing live read-only transport does **not** retrieve and verify current imported content.
