# Authenticated BerryMark → Sanity Online Dry-Run Planner

**Status:** Experimental administrative dry run only  
**Scope:** Existing offline verification, pure online resolution, and authenticated read-only lookups  
**Not included:** Draft creation/update, import/apply, publication, approval transfer, browser UI, schema changes, or automatic synchronization

## Architecture

1. `planBerryMarkImport()` remains the offline authority for complete-artifact validation, exact-source recompilation, local eligibility, deterministic identity, and editorial safeguards.
2. `resolveBerryMarkOnlineImport()` is a pure function that combines a successful source-verified offline report with injected lookup results. It performs no I/O and is tested entirely with synthetic records.
3. `lookupSanityImportState()` is a Node.js administrative transport. It accepts no GROQ from callers and performs only fixed parameterized GET requests.
4. `online-import-plan-cli.js` is the admin-only entry point. It loads and compiles the exact manuscript, runs the existing offline planner, stops on local failure, and only then attempts online reads.

The target is Bibleberry project `80016lrq`, dataset `production`, API version `2026-11-01`, using the non-CDN `api.sanity.io` Content Lake endpoint. This production target is intentional for the **read-only planner only** and does not approve any production write. All queries explicitly use `perspective=raw`; the resolver classifies `drafts.*`, published IDs, and `versions.*` separately. A published-only absence is never used as draft evidence.

## Administrative setup

A minimally privileged server-side Sanity token must be able to read published and draft metadata for `challenge` and `challengeSeries`. Kimi does not create or configure that token.

Set `BERRYMARK_SANITY_READ_TOKEN` only in the protected local/server process environment. Do not paste it into chat, source files, GitHub, command output, or logs. For an interactive local shell, a hidden prompt avoids placing the value in the command:

```bash
read -rsp "Sanity read-only token: " BERRYMARK_SANITY_READ_TOKEN; export BERRYMARK_SANITY_READ_TOKEN; echo
npm run plan:online
```

Or run the CLI directly:

```bash
node src/online-import-plan-cli.js path/to/source.berry.md
```

No browser module imports the transport or CLI. The CLI has no `--apply` mode. It prints only structured JSON with safe diagnostics; credentials, request headers, stacks, teaching bodies, and editorial-note contents are not retrieved by the Sanity queries.

Exit statuses:

- `0`: The online dry run resolved to `create`, `update`, or `none`.
- `1`: Local verification failed or online evidence produced `reject`.
- `2`: Arguments or local input could not be read/verified.
- `3`: A required online lookup was unauthenticated, denied, malformed, incomplete, timed out, or otherwise failed; the action remains `unknown`.

Any dry-run result, including `create`, is not a reservation or authorization for a later write. A future apply operation requires fresh source-verified preflight and separate authorization.

## Fixed lookups

- **Series:** Match the authored `challengeSeries.slug.current`, returning ID, revision, title, and slug only.
- **Challenge identity/slug:** Match the canonical ID, deterministic draft ID, or authored slug, returning minimal identity, sequence/series, review state, available provenance, and block review states—not teaching content.
- **Sequence:** Only when exactly one eligible published series resolves and a positive sequence was authored, check matching Challenge sequence assignments in that series.

Responses are limited to 100,000 characters/bytes as an administrative guard. HTTP authentication/permission failures, invalid JSON, missing result arrays, oversized responses, timeouts, and network errors remain structured failures. They are never converted into empty result sets.

## Action policy

- `create`: Local import gates pass; identity, slug, and applicable sequence lookups completed; no existing conflicting Challenge was found. Missing/draft-only series and other unresolved publishing values remain visible under the accepted incomplete-unpublished-draft policy.
- `none`: The exact BerryMark-owned deterministic draft has the same source digest **and** trustworthy evidence that current imported content is unchanged.
- `update`: Only the contract's exceptional revised-source case: exact expected previous source digest, matching BerryMark provenance, verified unchanged importer-owned content, no published canonical document, and unapproved/proposed review state.
- `reject`: Published canonical identity, foreign same-slug identity, ambiguous variants, missing ownership provenance, sequence collision, revision mismatch, or approval conflict.
- `unknown`: A required lookup or current-content/provenance verification is incomplete. A draft's existence alone never implies `update` or `none`.

The current Bibleberry Challenge schema does not supply the durable provenance/current-content evidence required for trustworthy `none` or `update`. The live transport therefore cannot manufacture those outcomes. The pure resolver supports them only when such evidence is explicitly injected; adding that durable evidence is a separate schema/provenance decision.

## Synthetic scenario outputs

These are injected test scenarios, **not evidence of live Sanity reads**.

### A. Published development series

```json
{
  "proposedAction": "create",
  "lookup": {
    "status": "complete",
    "perspective": "raw",
    "series": {
      "state": "published",
      "eligibleForReference": true,
      "documentId": "series-published-id"
    }
  },
  "onlineResolution": {
    "series": {
      "_id": "series-published-id",
      "slug": "bibleberry-development-tests",
      "state": "published"
    }
  },
  "writesAttempted": 0
}
```

The actual Sanity ID is returned as planning evidence; the slug is never treated as a document reference.

### B. Draft-only Gratitude series

```json
{
  "proposedAction": "create",
  "lookup": {
    "status": "complete",
    "series": {
      "state": "draft-only",
      "eligibleForReference": false
    }
  },
  "onlineResolution": { "series": null },
  "warnings": [{
    "code": "BM_IMPORT_SERIES_DRAFT_ONLY",
    "seriesState": "draft-only"
  }],
  "writesAttempted": 0
}
```

The proposed new Challenge remains an incomplete unpublished-draft plan with no resolved series reference. The existing Gratitude series is not published or modified.

### C. Existing manual Rejoice Always draft under another ID

```json
{
  "proposedAction": "reject",
  "conflicts": [{
    "code": "BM_IMPORT_DUPLICATE_SLUG",
    "slug": "2026-11-02-rejoice-always",
    "documentIds": ["drafts.manual-rejoice-always"]
  }],
  "onlineResolution": { "series": null },
  "writesAttempted": 0
}
```

No second Challenge is recommended, and the manually created draft is neither adopted nor overwritten.

## Outstanding decisions

1. Whether and where to add non-sensitive `importProvenance` fields and durable import-run records.
2. How a trusted administrative process will verify current importer-owned content without exposing full teaching content to ordinary planning queries.
3. Durable human Scripture-rights evidence for supplied passage text.
4. Durable review-item disposition and any future approval-policy changes.

No Sanity mutations were performed while developing or testing this planner. Actual authenticated reads remain unverified until Aaron separately configures an appropriate credential and runs the admin CLI.
