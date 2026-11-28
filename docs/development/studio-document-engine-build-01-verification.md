# BerryMark Studio Build 01 — Verification Record

**Date:** 2026-11-28
**Branch:** `feature/studio-document-engine`
**Base:** `main` at `fb3c55ea28aca4ee8043ca8891b9fd817a25c494`
**Scope:** Source-preserving Studio document engine only

## Executed automated verification

| Check | Actual result |
| --- | --- |
| Studio engine and executable demonstration suites | 45/45 passed; 0 failed |
| Complete repository `node --test` suite in the delivered workspace | 230/230 passed; 0 failed |
| Complete repository `npm test` in a clean temporary copy | 230/230 passed; 0 failed; clean `npm ci` completed |
| Existing pre-Build-01 regression baseline | 185/185 passed before Studio tests were added |
| `npm run check` | Passed; hello-world remained a valid working document |
| `npm run preview` | Passed; existing diagnostics and preview behavior retained |
| All-block compiler CLI versus committed JSON | Byte-identical (`cmp`) |
| Rejoice Always compiler CLI versus committed JSON | Byte-identical (`cmp`) |
| `npm run plan` and `npm run plan:artifact` | Both passed |
| `npm audit` | 0 vulnerabilities |
| JavaScript syntax checks for Studio engine, serializers, source index, and demo | Passed |
| Package, lockfile, compiler-golden, and schema-snapshot diff | No changes |

The focused suite contains nine individual Content Block construction tests and covers exact round trips for every existing `.berry.md` fixture, including the intentionally unsupported duplicate-ID fixture. It also covers LF, CRLF, BOM, mixed-newline, and absent-final-newline preservation; targeted and unrelated-source preservation; compound edits; nested insertion/removal/movement; CB6/CB7 post-field ordering; reflection transitions with zero, one, and two choices; missing rich titles; malformed and incomplete documents; rollback; compiler equivalence; source and import-content fingerprints; and approval save/reopen behavior.

The executable demonstration was run through its automated test:

```sh
node examples/studio-document-engine-demo.js
node --test test/studio-document-engine.test.js test/studio-demonstration.test.js
```

It constructs all nine block types, validates and compiles the generated source, reopens it with the same filename, and compares the complete compiler result.

## Environment note

The persistent workspace filesystem cannot create npm `.bin` symlinks and intermittently leaves incomplete package directories during concurrent npm extraction. The baseline command was run with `npm_config_bin_links=false npm test`. For final verification, the unchanged `npm test` script was also run in a clean temporary copy on the ordinary local filesystem, and the complete `node --test` suite was separately run in the delivered workspace after dependency imports were verified. This affected installation mechanics only; `package.json` and `package-lock.json` were not changed.

## Remaining limitations and unverified surfaces

- Build 01 has no graphical interface, filesystem persistence, browser file handling, server, or Sanity integration changes.
- Source-only reopening cannot infer prior edit history. Applications that need the stale-approval warning after reopening must persist the source-hash-bound string from `serializeReviewState()` and supply it as `reviewState`.
- No operation transfers source approval to Sanity, certifies edited material, clears stale review state, or establishes publication readiness.
- YAML presentation is guaranteed for unrelated source; the specific inserted/replaced value may use the YAML library's standard quoting or layout.
- Rich-body replacement preserves full-line editorial comments but does not infer comment ownership within replaced paragraphs.
- Authenticated online Sanity reads and all Sanity writes remain unexecuted and out of scope. No credential was supplied or used.
- Local commits and test evidence do not by themselves imply pushed or CI-verified status; remote delivery and check results are recorded in the pull-request handoff.
