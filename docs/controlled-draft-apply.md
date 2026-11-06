# Controlled BerryMark → Sanity Draft Creation

**Status:** Experimental administrative implementation; first development-dataset live creation and zero-write repeat verified on November 5, 2026 (see acceptance record below)  
**Scope:** Source-verified dry run, authenticated development-dataset preflight, create-only draft mutation, and readback verification  
**Not included:** Draft updates, publication, deletion, automatic synchronization, browser UI, reader changes, or production writes

## Command and default behavior

```bash
# Local source-verified dry run: no credential, target lookup, network request, or write
node src/sanity-draft-apply-cli.js path/to/source.berry.md

# Explicit administrative apply; requires the separate setup below
node src/sanity-draft-apply-cli.js path/to/source.berry.md \
  --apply --operator aaron.development
```

The package script `npm run apply:draft` runs the Rejoice Always example in the default dry-run mode. It does not apply a mutation.

The CLI accepts a manuscript, not a browser-supplied compiler artifact. Every invocation recompiles the exact source and runs the existing offline validator/planner. Structural validity, source verification, import eligibility, editorial approval, publication, and reader release remain distinct. Provided passage text still requires independent rights evidence; the compiler's rights Boolean is not sufficient.

Dry-run output has `mode: "dry-run"`, `writesAttempted: 0`, and normally `proposedAction: "unknown"` because no online lookup is performed. An offline dry run is not a reservation or write authorization.

## Separate administrative configuration

Apply requires all of these environment variables in the protected Node.js process:

```bash
export BERRYMARK_SANITY_WRITE_PROJECT_ID=80016lrq
export BERRYMARK_SANITY_WRITE_DATASET=<separately-authorized-development-dataset>
export BERRYMARK_SANITY_AUTHORIZED_WRITE_DATASET=<exact-same-development-dataset>
export BERRYMARK_SANITY_WRITE_API_VERSION=2026-11-01
read -rsp "Restricted Sanity write token: " BERRYMARK_SANITY_WRITE_TOKEN
export BERRYMARK_SANITY_WRITE_TOKEN
echo
```

Kimi does not create or configure the token or dataset. The token must be a restricted administrative write credential, not the existing read-only Viewer token. The CLI rejects an identical `BERRYMARK_SANITY_READ_TOKEN` and `BERRYMARK_SANITY_WRITE_TOKEN`. Do not place credentials in source files, command arguments, chat, GitHub, or logs.

The project and API version must match the approved Bibleberry configuration. `production` is always rejected as an apply target. The selected dataset and independent authorization value must be explicit, valid, and identical. These application checks supplement—not replace—Sanity authorization and Aaron's separate live-acceptance approval.

## Fresh preflight and permitted outcomes

Immediately before any mutation, the apply transport uses the restricted credential for fixed, parameterized, non-CDN `perspective=raw` reads against the selected development dataset:

1. Resolve an authored series slug to exactly one eligible published `challengeSeries`, without creating a series or treating its slug as an ID.
2. Retrieve the exact canonical ID, deterministic draft ID, and every same-slug Challenge variant. For the deterministic draft, include the full importer-owned content and provenance needed for independent fingerprint verification.
3. When applicable, check the authored positive sequence within the resolved published series.

Failed, denied, incomplete, oversized, malformed, duplicate-ID, or timed-out lookups fail closed. Mutation requests and responses have a 250,000-byte administrative limit. Published canonical identities, foreign same-slug identities, manual drafts without matching BerryMark provenance, edited/malformed imported content, sequence collisions, and revision/approval conflicts produce no mutation.

Only two successful apply outcomes exist:

- **Verified no-op:** The deterministic BerryMark-owned draft has the same source digest, and a fresh full raw readback recomputes to its recorded `lastImportedContentSha256`. No write is attempted. Human-owned publishing/review fields do not participate in that content fingerprint.
- **Created and verified:** No conflicting document exists, and one atomic `createIfNotExists` creates exactly `drafts.berrymark-challenge-<slug>`.

There is no update, patch, delete, publish, force, retry-repair, or general synchronization operation. A revised manuscript cannot replace an existing draft through this CLI. A create race is handled by `createIfNotExists`; an existing concurrent draft is reported as a no-op only if readback verifies equivalent content and create lineage. It is never overwritten.

## Creation payload and provenance

The payload is built from `projectCandidateImportContent()` and hashed by `candidateSha256()` from the merged 04E-B contract. No second projection or hashing scheme is introduced. It preserves CB1–CB9, ordered arrays, nested `_key` values, Portable Text, optional/absent distinctions, Scripture states, conservative `adaptationReviewed: false`, and proposed CB4–CB8 states.

A resolved series becomes a weak reference to its actual published document ID. Supplied sequence and timezone-aware release values are preserved; missing values are not inferred. `importProvenance` records:

- `sourceSystem: "berrymark"`, compiler contract/mode, canonical identity, logical relative source filename, exact source digest, and optional authored source revision.
- Distinct source, candidate, and last-imported-content digest semantics. On initial creation, the 04E-B candidate and expected imported-content digests are equal; readback independently recomputes the latter.
- `lastImportAction: "create"`, the supplied non-sensitive operator identity, and the administrative apply timestamp. `previousSourceSha256` is absent.

The Content Lake mutation reference documents result IDs as `documentId`; Sanity's official `@sanity/client` request fixtures use the wire field `id`. The transport requests `returnIds=true` and accepts exactly one of these fields per result, only when it identifies the requested draft and the operation is `create`. Empty results are treated as a possible `createIfNotExists` no-op and still require readback verification.

If a mutation may have succeeded but its response is ambiguous (including transport failure, malformed response, or server error), the importer records the attempted write and performs one read-only raw readback. The report remains `mutation-unverified` regardless of whether a matching candidate is present; it does not claim that this run created or did not create the draft. If readback cannot establish the candidate's presence, `manual-investigation-required` is reported. The operator must investigate before taking further action. The importer never retries a write or attempts a patch or delete to conceal uncertainty.

After an interpretable create/no-op response, an exact raw draft readback must match the importer-owned projection, recomputed content digest, publishing metadata, and create provenance. Server metadata is excluded. A failed or mismatched readback is reported as unverified.

## Safe audit output and exit statuses

Output includes safe target identity, source-verification state, deterministic identity, action, lookup/error summaries, editorial counts, and non-sensitive digests. It does not include manuscript or teaching prose, annotation text/review history, credentials, request headers, stacks, or internal editorial sidecar contents.

- `0`: Local dry run completed, or apply produced a verified create/no-op.
- `1`: Local validation/eligibility, target, credential, or conflict checks rejected apply.
- `2`: Arguments, source input, or administrative configuration were invalid.
- `3`: Required authenticated preflight evidence was unavailable or incomplete; no mutation occurred.
- `4`: A mutation or subsequent verification failed. Inspect the safe report; do not assume rollback or publication occurred.

## Verification boundary

Automated tests use injected fake transports and synthetic HTTP responses. They cover dry-run zero I/O, credential/target failures, all preflight conflicts, all-block payload fidelity, same-source no-op, edited/approved drafts, create races, mutation/readback failures, safe output, and the single fixed mutation body. These tests do not themselves exercise a real Sanity dataset. The first separately authorized live development-dataset acceptance exercise is recorded below. It did not include publication, production writes, or deployment.

## Live development-dataset acceptance record: November 5, 2026

**Environment:** Sanity project `80016lrq`; isolated `berrymark-development` dataset; API version `2026-11-01`. The existing `production` dataset was not the write target. Testing used a temporary Contributor credential loaded in a local terminal session, with no token included in repository files or test output. The operator subsequently unset `BERRYMARK_SANITY_WRITE_TOKEN` locally; token revocation in Sanity Manage is a separate administrative action.

**Source:** The development-only, Scripture-reference-only `examples/hello-world.berry.md` fixture, with source SHA-256 `f061be7eb0330ba05de125807699d56d67146f2bd4874223abd20d3fa988c4b8`. Target draft: `drafts.berrymark-challenge-berry-hello-world`. The fixture's `bm-test` series slug had no published matching `challengeSeries`; the importer did not fabricate a reference. Editorial approval remained pending.

| Stage | Observed result | Interpretation |
| --- | --- | --- |
| Offline source-verified dry run | `structuralValid: true`, `importEligible: true`, `writesAttempted: 0` | Source and structural preflight passed without network I/O. |
| First authenticated apply on `bc1862b` | `writesAttempted: 1`; `BM_IMPORT_READBACK_MISMATCH` | A create mutation was attempted, but the CLI did **not** report successful verification. |
| Independent read-only raw draft inspection | Exact draft ID present; stored `lastImportedContentSha256` equaled independently recomputed SHA-256 `cfc149dc31500b78645d87a33d64091b131556421319a094ae0867ab5d91e943` | Confirms that the unpublished development draft exists and importer-owned content fingerprint matches. The readback exposed `series: null` for the absent optional reference. |
| Corrective engineering | [Issue #12](https://github.com/ContraPhilosophy/BerryMark/issues/12), [PR #13](https://github.com/ContraPhilosophy/BerryMark/pull/13), merged as `1a635584d8a954be15c3d876ee8bfa9aaab3bf9d`; 185 tests passed and CI succeeded | Verification now treats an omitted optional series reference and Sanity GROQ's projected `series: null` as equivalent, while retaining strict checks for actual references, publishing fields, content and provenance. |
| Live same-source apply after PR #13 | `lookup.challenge.documentCount: 1`, `proposedAction: "none"`, `apply.status: "verified-noop"`, `readbackVerified: true`, `writesAttempted: 0`, `errors: []` | The fixed importer identified and verified the existing draft without creating, updating, deleting, or publishing anything. |

**Acceptance conclusion:** The development-dataset authenticated lookup, actual draft presence with independently matching imported-content digest, and post-fix exact-source **zero-write no-op** are verified against real Sanity. The first live creation occurred on the pre-fix version and returned a readback mismatch; therefore a fresh post-fix live `created-and-verified` outcome has **not** yet been demonstrated. This record does not constitute approval to publish, to write to `production`, or to use real editorial manuscripts in this test dataset.
