# Controlled BerryMark → Sanity Draft Creation

**Status:** Experimental administrative implementation; Milestone 1 and Milestone 2 live acceptance evidence from November 5, 2026 is historical
**Scope:** Source-verified dry run, authenticated explicitly authorized staging preflight, create-only Challenge-draft mutation, and readback verification
**Not included:** Draft updates, publication, deletion, automatic synchronization, browser UI, reader changes, or production writes

**Supersession — November 11, 2026:** `berrymark-development` has been deleted and is not part of the current two-dataset topology (`production` and private `staging`). The dated records below describe operations genuinely performed on the former dataset; they are not staging test results. This issue grants no live staging write permission. Any further create-only acceptance requires Aaron's separate authorization and a separate restricted credential.

## Command and default behavior

```bash
# Local source-verified dry run: no credential, target lookup, network request, or write
node src/sanity-draft-apply-cli.js path/to/source.berry.md

# Explicit administrative apply; staging requires separate approval and setup below
node src/sanity-draft-apply-cli.js path/to/source.berry.md \
  --apply --operator aaron.staging-test
```

The package script `npm run apply:draft` runs the Rejoice Always example in the default dry-run mode. It does not apply a mutation.

The CLI accepts a manuscript, not a browser-supplied compiler artifact. Every invocation recompiles the exact source and runs the existing offline validator/planner. Structural validity, source verification, import eligibility, editorial approval, publication, and reader release remain distinct. Provided passage text still requires independent rights evidence; the compiler's rights Boolean is not sufficient.

Dry-run output has `mode: "dry-run"`, `writesAttempted: 0`, and normally `proposedAction: "unknown"` because no online lookup is performed. An offline dry run is not a reservation or write authorization.

## Separate administrative configuration

Apply requires all of these environment variables in the protected Node.js process:

```bash
export BERRYMARK_SANITY_WRITE_PROJECT_ID=80016lrq
export BERRYMARK_SANITY_WRITE_DATASET=staging
export BERRYMARK_SANITY_AUTHORIZED_WRITE_DATASET=staging
export BERRYMARK_SANITY_WRITE_API_VERSION=2026-11-01
read -rsp "Restricted Sanity write token: " BERRYMARK_SANITY_WRITE_TOKEN
export BERRYMARK_SANITY_WRITE_TOKEN
echo
```

Kimi does not create or configure the token or dataset. The token must be a restricted administrative write credential, not the existing read-only Viewer token. The CLI rejects an identical `BERRYMARK_SANITY_READ_TOKEN` and `BERRYMARK_SANITY_WRITE_TOKEN`. Do not place credentials in source files, command arguments, chat, GitHub, or logs.

The project and API version must match the approved Bibleberry configuration. Under the current two-dataset topology and owner-authorized policy, private `staging` is the sole supported non-production apply target; configure both dataset variables explicitly as exactly `staging`. This policy is stricter than the current code-level target check: `assertSanityDraftApplyTarget()` validates the approved project/API, a syntactically valid dataset name, rejects `production`, and requires the configured and authorized dataset names to match, but does not require the name `staging`. Another matching valid non-production dataset could therefore pass that code-level check, but is outside the authorized policy and may independently be blocked by Sanity permissions or topology. These application checks supplement—not replace—Sanity authorization and Aaron's separate live-acceptance approval. The settings above are examples, not permission to write: this issue grants no live staging write permission.

## Fresh preflight and permitted outcomes

Immediately before any authorized mutation, the apply transport uses the separate restricted credential for fixed, parameterized, non-CDN `perspective=raw` reads against explicitly configured `staging`:

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

Automated tests use injected fake transports and synthetic HTTP responses. They cover dry-run zero I/O, credential/target failures, all preflight conflicts, all-block payload fidelity, same-source no-op, edited/approved drafts, create races, mutation/readback failures, safe output, and the single fixed mutation body. These tests do not themselves exercise a real Sanity dataset. The historical, separately authorized live acceptance on the former development dataset is recorded below; it did not include publication, production writes, or deployment. This issue performs no live staging integration.

The Bibleberry R08A-4A synthetic monthly fixtures (`month-2096-02`, `month-2098-02`, `month-2098-03`, `month-2098-04`, and `r08a-stg-*` IDs) are Bibleberry-owned staging test documents. This BerryMark importer creates one-way Challenge drafts only; it does not write `monthlyPublication` documents, month rosters, or modify those fixtures.

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


## Live development-dataset acceptance record: Milestone 2 (November 5, 2026 local)

**Acceptance scope:** Corrected BerryMark importer on `main` commit `7057430862d9bcdde0d4cc1438703d0397c1964b`, operating against Sanity project `80016lrq`, dataset `berrymark-development`, API version `2026-11-01`. Tests were performed by the operator on BigMac and inspected from terminal output, including separate read-only `curl`/GROQ queries with `perspective=raw`. The live events on the evening of November 5 ET include an initial import timestamp of `2026-11-06T01:04:38.096Z` in UTC. No production dataset mutation, Challenge publication, or content synchronization was performed.

The three Milestone 2 manuscripts were **synthetic local files**, not committed by this documentation change. They were derived from `examples/hello-world.berry.md` and use John 11:35 as a reference only, without a passage quotation. Their names and exact observed digests are included below for traceability; this record does not assert that the local files are available in a fresh clone.

| Local source file | Intended test | Source SHA-256 |
| --- | --- | --- |
| `examples/milestone-2-fresh-create.berry.md` | New draft, then identical no-op | `16a86c9eabbb0ea0279a41e60c010317f4b0ccb7625c790e13f3df780693f172` |
| `examples/milestone-2-conflict.berry.md` | Changed CB1 prose under the **same slug** as the first draft | `d8a449cbd3c6046f5931424ec1b4f28d1604738fcae6fa36999671feb3ce5037` |
| `examples/milestone-2-series-reference.berry.md` | New draft referencing the published synthetic `bm-test` series | `ea42c0cbfb0783f2718d4128918535cb3fa4ce769366e3470018c234a9626617` |

### Observed operations and outcomes

| Stage | Observed result | Acceptance interpretation |
| --- | --- | --- |
| New-source offline validation | `structuralValid: true`, `importEligible: true`, `sourceVerification.verified: true`, `writesAttempted: 0` | Prepared manuscript passed offline structure and source-integrity checks. |
| First corrected-code live apply | `proposedAction: "create"`, `writesAttempted: 1`, `apply.status: "created-and-verified"`, `readbackVerified: true` | Fresh unpublished draft `drafts.berrymark-challenge-berry-m2-fresh-create` was created and verified. |
| Independent raw GROQ inspection | Exact draft ID, `_type: "challenge"`, matching slug/title, one screen, `sourceSystem: "berrymark"`, `lastImportAction: "create"`, `importedBy: "aaron.development"` | The created document and its import provenance were present outside the BerryMark CLI readback. |
| Same-source authenticated repeat | `lookup.challenge.documentCount: 1`, `proposedAction: "none"`, `apply.status: "verified-noop"`, `writesAttempted: 0`, `readbackVerified: true` | Exact duplicate was recognized without a second write. |
| Changed-source offline dry run | `structuralValid: true`, `importEligible: true`, `writesAttempted: 0` | A structurally valid manuscript can still be incompatible with existing Sanity state. |
| Changed-source authenticated apply | `proposedAction: "reject"`, `importEligible: false`, `BM_IMPORT_REVISION_CONFLICT`, `apply.status: "blocked-online-preflight"`, `writesAttempted: 0` | Conflicting content under an existing Challenge identity was rejected without mutation. This importer offers no update/reimport operation. |
| Published-series preparation | Contributor token received HTTP `403`, `permission "create" required`, for creation of a non-draft series. A separate short-lived Editor credential created synthetic `challengeSeries` document `berrymark-test-series-m2` with slug `bm-test` using `createIfNotExists`. | Permission separation was enforced. A series was deliberately created only in the development dataset; it is a published **series document**, not a published Challenge. |
| Independent series lookup | Read-only raw GROQ returned `_id: "berrymark-test-series-m2"`, `_type: "challengeSeries"`, slug `bm-test`. | Confirms an eligible published series exists before the linked Challenge import. |
| Linked-source offline validation | `structuralValid: true`, `importEligible: true`, `writesAttempted: 0` | Separate Challenge identity ready for online lookup. |
| Linked-source authenticated apply | `lookup.series.state: "published"`, `eligibleForReference: true`, `documentId: "berrymark-test-series-m2"`, `lookup.sequence.documentCount: 0`, `writesAttempted: 1`, `apply.status: "created-and-verified"`, `readbackVerified: true` | Corrected importer resolved the authored series slug and created the new unpublished Challenge draft. |
| Independent linked-draft GROQ inspection | `drafts.berrymark-challenge-berry-m2-series-reference` had `sequence: 1` and `series: {"_type":"reference","_ref":"berrymark-test-series-m2","_weak":true}`. Stored source/content fingerprints matched the import report. | Validates the persisted relationship to the published series, not merely the lookup plan. |

**Observed fingerprints and identities:**

- First created draft: `drafts.berrymark-challenge-berry-m2-fresh-create`. Its `importProvenance.candidateSha256` and `lastImportedContentSha256` were both `e9767f901a766faa4ecad553577bdf78b2acd9986cda4502be18e428f64cac24`. Independent raw GROQ returned the same stored values alongside the recorded source digest.
- Series-linked draft: `drafts.berrymark-challenge-berry-m2-series-reference`. Its candidate and imported-content SHA-256 were both `ad12cc74f332c5e040603e167b21b7d55bc09e466d4e6d0ab139c0f950efce32`, with source SHA-256 `ea42c0cbfb0783f2718d4128918535cb3fa4ce769366e3470018c234a9626617`. The independent query returned the matching source/content digests.
- The conflicting source retained slug `berry-m2-fresh-create`, but used different teaching prose. Online preflight reported that a revised import would require the exact previous source digest and rejected the request; supplying that digest is **not** an available update mechanism in this create-only workflow.

### Reporting interpretation and remaining actions

The successful online series resolution did **not** clear every preexisting field in the composite report: `BM_SERIES_LOOKUP_REQUIRED`, an `unresolvedLookups` entry, and `missingRequiredMetadata.series` from offline planning still appeared even when `lookup.series.state: "published"` and independent GROQ confirmed the persisted reference. Similarly, pending editorial approval and an unresolved companion URL remain deliberate fixture warnings. These entries must not be mistaken for a failed import or treated as a final publication-readiness decision. Improve separation of **offline requirements** versus **online-resolved state** in a later operator-reporting effort (Milestone 6), without weakening validation.

**Functional acceptance conclusion:** Milestone 2's observed live behaviors passed: fresh corrected-code creation/readback, identical-source zero-write no-op, changed-source zero-write rejection, published-series resolution, and independent stored-reference verification. This is evidence for a reliable development ingestion foundation, **not** approval for production writes, publication, routine reimport, or real unpublished manuscripts in a public dataset.

**Administrative and handoff status:**

- The temporary Editor credential was used solely to bootstrap the synthetic development-series document. The operator was instructed to unset its local environment variable and revoke the token in Sanity Manage; **actual revocation was not independently confirmed in the provided session**. Confirm and document that cleanup separately. The Contributor test credential was previously configured to expire November 7, 2026; its later status also requires confirmation.
- New Milestone 2 fixture files exist in the operator's local working copy; this documentation-only change does not publish them to GitHub or claim their exact bytes are stored in the repository. If they become a repeatable test suite, verify and add intentionally under a separate scoped PR.
- These observations come from live CLI and independent `curl`/GROQ output, not a newly executed CI run for this documentation update.
- Once this acceptance record is reviewed and merged by Aaron, proceed to Milestone 3: all-nine-Content-Block fidelity through source, compiler, Sanity storage, and development-only reader inspection, using rights-safe synthetic source material.
