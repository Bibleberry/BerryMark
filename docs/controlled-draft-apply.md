# Controlled BerryMark → Sanity Draft Creation

**Status:** Experimental administrative implementation; review and live acceptance are separate  
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

After mutation, an exact raw draft readback must match the importer-owned projection, recomputed content digest, publishing metadata, and create provenance. Server metadata is excluded. A failed or mismatched readback is reported as unverified; the importer does not attempt a patch or delete to conceal it.

## Safe audit output and exit statuses

Output includes safe target identity, source-verification state, deterministic identity, action, lookup/error summaries, editorial counts, and non-sensitive digests. It does not include manuscript or teaching prose, annotation text/review history, credentials, request headers, stacks, or internal editorial sidecar contents.

- `0`: Local dry run completed, or apply produced a verified create/no-op.
- `1`: Local validation/eligibility, target, credential, or conflict checks rejected apply.
- `2`: Arguments, source input, or administrative configuration were invalid.
- `3`: Required authenticated preflight evidence was unavailable or incomplete; no mutation occurred.
- `4`: A mutation or subsequent verification failed. Inspect the safe report; do not assume rollback or publication occurred.

## Verification boundary

Tests use injected fake transports and synthetic HTTP responses. They cover dry-run zero I/O, credential/target failures, all preflight conflicts, all-block payload fidelity, same-source no-op, edited/approved drafts, create races, mutation/readback failures, safe output, and the single fixed mutation body. No real credential, Sanity request, dataset write, live acceptance, publication, merge, or deployment is part of this implementation assignment.
