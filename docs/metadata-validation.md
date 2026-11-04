# BerryMark v0.1 Metadata Validation (Phase 1)

**Status:** Experimental, read-only validation layer. It does not compile Portable Text, contact Sanity, verify a Scripture license, establish editorial approval, or determine import/publication readiness.

## Entry point and AST contract

Use the existing API:

```js
import { parseBerryMark } from './src/parser.js'
const result = parseBerryMark(source, { filename: 'challenge.berry.md' })
```

`result.ok` is true only when there are no blocking errors. Editorial items and informational/deferred diagnostics do not make a working document invalid.

The front-matter representation deliberately separates provenance from typed values:

- `document.frontmatter.raw`: original front-matter text, without the `---` delimiters.
- `document.frontmatter.startLine` / `endLine`: delimiter locations in the source file.
- `document.frontmatter.yamlValidated`: true when safe YAML parsing produced a mapping; this does not mean all semantic metadata checks passed.
- `document.metadata`: the separately parsed YAML 1.2 core-typed representation. It is `null` if YAML parsing or root-mapping validation failed. Values are preserved without coercion, including the distinction between an absent key and a key explicitly set to `null`.

The existing `document.screens`, `document.annotations`, block fields, and structural AST remain in place. `result.mode` is now `experimental-read-only-validation`, replacing `experimental-syntax-only` because malformed or semantically invalid metadata now blocks `ok: true`.

## Implemented v0.1 metadata contract

This is the bounded validator contract for Phase 1, grounded in the language specification. It is not a Sanity import schema.

| Path | Rule |
| --- | --- |
| `berrymark` | Required string exactly `"0.1"`. |
| `challenge` | Required mapping. `title`, author-supplied `slug`, and `type` are required nonempty strings. `type` is `teaching`, `discipline`, `reflection`, or `memorization`. `summary` is an optional nonempty string or `null`. No slug is derived. |
| `publishing` | Required mapping. `series`, `sequence`, and `releaseAt` may be absent or explicitly `null`. `series` is otherwise a nonempty string. `sequence` is otherwise a positive safe integer. `releaseAt` is otherwise a valid ISO 8601 datetime with `Z` or an explicit offset. Absent/null values produce informational unresolved diagnostics. |
| `scripture` | Required mapping. `reference` and `translation` are required nonempty strings. `textStatus` is `referenceOnly` or `provided`; `practiceStatus` is `notConfigured` or `configured`. `passage` is an optional nonempty string or `null`; `usageRightsConfirmed` is an optional strict Boolean. Shared consistency rules are described below. |
| `editorial` | Required mapping. `sourceTitle`, `sourceAuthor`, and `approvalStatus` are required. `sourceRevision`, `approvedBy`, and `approvedAt` may be absent or `null`. `approvalStatus` is `pending` or `approved`. Pending approval rejects non-null approver/date values; approved status requires both, with a timezone-aware `approvedAt`. |
| `companionLinks` | Optional array. Each item is a mapping with required `provider` and nonempty `label`; optional `description`, `url`, and `availability`. Providers are `social`, `patreon`, `podcast`, `walkingReel`, `youtube`, or `other`. URLs must be absolute HTTP(S) or absent/null. |

Unknown fields at these recognized paths are errors rather than silently discarded extensions. No default approval, release, URL, Scripture passage, or rights value is generated.

### Shared Scripture consistency

`src/scripture.js` is the single pure consistency implementation used by Challenge front matter, CB2, and nested CB8 SCRIPTURE:

- `referenceOnly` cannot carry passage text.
- `provided` requires nonempty passage text and `usageRightsConfirmed: true`.
- Configured practice requires rights-confirmed, provided passage text.

A true rights flag remains an author assertion, not independent evidence of a license. Front-matter validation reports an informational `BM_SCRIPTURE_RIGHTS_ASSERTION` when the flag is true. The validator performs no rights lookup.

## YAML safety and dependency

`yaml` **2.9.1** is pinned exactly in `package.json` and `package-lock.json`. It was selected because it is an established JavaScript YAML implementation with YAML 1.2 core-schema typing, duplicate-key detection, and source offsets used for diagnostics.

The accepted Phase 1 YAML subset uses the core schema with strict parsing and unique mapping keys. It rejects malformed YAML, non-mapping roots, non-string mapping keys, non-finite numbers, unresolved/custom/non-core tags, anchors, and aliases. Explicit core tags remain supported. Anchors and aliases are conservatively excluded so metadata remains acyclic and JSON-serializable without relying on alias-expansion limits. YAML timestamps remain strings; BerryMark performs its own timezone-aware datetime validation.

No YAML content is executed. Validation has no filesystem, HTTP, Sanity, or other write-side behavior.

## Diagnostics and CLI

Every diagnostic has `severity`, `code`, `message`, `filename`, `line`, and `column`. Metadata diagnostics also include a dotted/indexed `path`; shared block Scripture errors include the block `target` ID where available.

Severities are:

- `error`: malformed, unsafe, contradictory, or unsupported input; `ok` becomes false and all CLI modes exit 1.
- `warning`: reserved for valid but advisory content rules; no new thresholds or overrides are invented in this sprint.
- `editorial`: preserved `EDITORIAL NOTE`, `TODO`, and `REVIEW REQUIRED` annotations.
- `info`: truthful deferred state, such as unresolved publishing fields, pending approval, absent/null companion URLs, or an unverified rights assertion.

`result.summary` contains `errors`, `warnings`, `editorial`, and `info` counts. The existing commands remain:

```sh
node src/cli.js check <source.berry.md>
node src/cli.js preview <source.berry.md>
node src/cli.js json <source.berry.md>
```

A successful check means **valid working document**, not import-ready, approved, rights-cleared, or publication-ready.

## Decision requests and unresolved architecture

These items remain for Aaron/ChatGPT review; the implementation does not claim to settle the broader language or integration policy:

1. **Required metadata sections:** Phase 1 requires `challenge`, `publishing`, `scripture`, and `editorial`, while optional `companionLinks` may be omitted. Confirm this long-term contract or define a minimal-partial-document mode. Options: keep the complete-document contract, or explicitly version a separate partial-draft profile.
2. **YAML anchors/aliases:** They are rejected conservatively. If authors need reusable YAML values, approve a bounded policy with expansion limits and cycle handling; otherwise keep the simpler acyclic subset.
3. **Series identity:** `publishing.series` is preserved as an opaque string/null. Decide whether it is a stable series slug, another reference form, or something else before compiler/import work. No series lookup or creation occurs here.
4. **Editorial statuses and mapping:** Only `pending` and `approved` are accepted. Decide whether additional states are needed and how truthful Aaron-or-Alexis approval maps to Sanity without fabricating review fields.
5. **Companion availability:** `availability` remains a nonempty string/null because no enum is specified. Decide whether a controlled vocabulary is required.
6. **Unresolved draft fields:** Informational diagnostics expose absent/null publishing values and pending review. A future import gate must decide which may enter an unpublished Sanity draft; publication requirements remain separate.
7. **Warning rules and overrides:** No advisory thresholds, override syntax, storage, or post-import disposition is implemented.
8. **Unknown extension metadata:** Recognized trees currently reject unknown keys. If extensions are needed, define an explicit namespace and compatibility rules rather than silently ignoring them.

Portable Text conversion, deterministic Sanity keys, schema mapping, duplicate Challenge detection, protected draft preview, Sanity import, external rights verification, editorial approval, and publication remain unimplemented.
