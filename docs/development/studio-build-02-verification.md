# BerryMark Studio Build 02 — Verification Record

**Date:** 2026-11-28  
**Branch:** `feature/studio-browser-application`  
**Accepted base:** `9f830de07c98a783d2deea7bd3fc9b540c4b78c0`  
**Scope:** Local Chromium application and document management around accepted Build 01

## Executed automated verification

All results below are actual local executions, not anticipated results.

| Check | Actual result |
| --- | --- |
| Complete repository `node --test` under Node.js 22.23.5 | **247/247 passed**; 0 failed, cancelled, skipped, or todo |
| Clean temporary-copy `npm test` under Node.js 22.23.5 | Clean `npm ci` completed; **247/247 passed** |
| Focused Studio application and real-filesystem suites | **14/14 passed**; included in the 247-test totals |
| Chromium end-to-end `npm run test:browser` under Node.js 22.23.5 | **8/8 passed** |
| Earlier Chromium run under Node.js 20.20.2 | **8/8 passed** after the metadata form defect was corrected |
| `npm run check` | Passed; existing hello-world validation and diagnostics retained |
| `npm run preview` | Passed; existing structural preview retained |
| `npm run compile` and `npm run compile:rejoice` | Both completed |
| All-block compiler output versus committed golden | **Byte-identical** (`cmp`) |
| Rejoice Always compiler output versus committed golden | **Byte-identical** (`cmp`) |
| `npm run plan` and `npm run plan:artifact` | Both passed; existing offline-schema-snapshot-only status retained |
| `npm audit --audit-level=low` | **0 vulnerabilities** |
| JavaScript syntax checks for application, browser, CLI, configuration, and browser tests | Passed |
| `git diff --check` | Passed |
| Studio CLI `--help`, invalid-port, and occupied-port checks | Clear usage/error output and nonzero failure behavior verified |
| Final Node.js 22 cold start and Chromium screenshot run | Startup succeeded; 3 captures; 0 page errors, 0 console errors, 0 failed requests |

No authenticated online Sanity read or write was attempted. `plan:online` and `apply:draft` were not run; they are outside Build 02 and no credential or write authorization was supplied or used.

## Browser workflows exercised

The Playwright suite launches the real Node server and drives Chromium through actual DOM interactions. It verifies:

1. Open the representative all-block fixture, inspect CB1–CB9, change document information, add/rename/reorder/remove screens, Save As, verify manuscript and companion digests, reopen both files, and confirm intended changes plus unrelated-source preservation.
2. Open unsupported source read-only, expose diagnostics, and Save As with exact source preservation.
3. Cancel unsaved-work replacement, open/save pickers, incomplete destinations, and screen removal without losing working state.
4. Inject an interrupted manuscript write, retain dirty state, and inspect prepared recovery information.
5. Deny read/write permission, prevent both writes, and retain dirty state.
6. Modify the manuscript externally and prove Studio does not overwrite it or its companion.
7. Open a malformed companion, require explicit reset confirmation, verify cancellation preserves both files, then confirm a successful reset/save.
8. Render script-like and HTML-like authored text inert in document information, screen labels/headings, and Content Blocks; no injected script execution or browser runtime errors occurred.

The browser run also asserts zero page errors, zero console errors, and zero failed requests for every test.

## Real filesystem versus browser handles

`test/studio-review-state-file.test.js` uses real temporary files and rename-based writes. It verifies:

- Approved → edit → pending → save → reopen → approved while retaining the stale-approval warning.
- Exact unchanged source, UTF-8 BOM, CRLF, and absent-final-newline preservation.
- Recovery of previous state when manuscript writing stops.
- Recovery of target state when companion finalization stops.
- Safe handling of missing, malformed, and mismatched review information.

Playwright's `test-browser/memory-file-harness.js` emulates Chromium picker handles in memory for user interactions and deterministic permission/write failures. Those tests are **not** represented as native browser-to-disk proof. The two layers are intentionally separate.

## Application defect found and corrected by browser testing

An early browser run exposed a real metadata form bug: the busy-state render restored the authoritative snapshot before form values were captured, so an edited title could be discarded and unchanged blank slug/type fields could be created. Form capture now occurs before the busy render, and untouched missing blank fields remain missing. The complete Node and Chromium suites were rerun after the correction.

## Actual environment

| Component | Tested version |
| --- | --- |
| Operating system | Debian GNU/Linux 12 (bookworm), x86_64 |
| Primary runtime | Node.js 22.23.5; npm 10.9.9 |
| Secondary runtime | Node.js 20.20.2; npm 11.19.0 |
| Browser | Chromium 151.0.7922.108, headless, Debian build |
| Browser automation | `@playwright/test` 1.65.1, development-only |

The workspace's mounted filesystem cannot reliably create npm `.bin` links and intermittently reports transient directory errors during package replacement. The documented workspace install mode is `npm_config_bin_links=false npm ci`; the browser script invokes the pinned Playwright entry point directly. A clean `npm test` was also executed in an ordinary-filesystem temporary copy with normal installation mechanics.

## Screenshots

Actual Chromium application captures are stored in:

- `docs/development/images/studio-build-02-welcome.png`
- `docs/development/images/studio-build-02-all-blocks.png`
- `docs/development/images/studio-build-02-diagnostics.png`

## Outstanding manual verification

The execution environment was Debian, not macOS or Arch Linux. Native Chrome/Chromium picker permission dialogs were emulated in automated tests. The following checks remain required on the target machines and have **not** been independently demonstrated here.

### Chrome on macOS

1. Install with Node.js 22, run `npm run studio`, open the printed address, and confirm loopback-only startup and Ctrl+C shutdown.
2. Open a real `.berry.md` and companion together in the native multi-file picker; cancel once and confirm no document replacement.
3. Save As to real manuscript/companion destinations, grant native read/write permission, and verify both files and their read-back message.
4. Edit and Save directly to the same file; externally modify it in another editor and confirm Studio refuses to overwrite it.
5. Deny or revoke permission, remove/rename a destination, and confirm understandable errors with dirty state retained.
6. Exercise Cmd+O, Cmd+S, Cmd+Shift+S, native unsaved-close protection, keyboard focus, long labels, and desktop resizing.
7. Reopen after manually interrupting a test-copy save and confirm the documented prepared-transaction recovery message. Use disposable fixtures only.

### Chromium on Arch Linux

Repeat the equivalent workflow with Ctrl shortcuts, native file permission behavior, direct writes, external modification, cancellation, and interrupted-save recovery. Confirm the selected Arch Chromium build exposes the required File System Access API on the local loopback origin.

A screen-reader/manual accessibility audit is also still recommended; Build 02 verifies keyboard-operable controls, visible focus, textual status, and semantic dialogs, but does not claim a completed assistive-technology certification.

## Delivery boundary

This was local implementation and verification only. No remote branch was created, no pull request was opened, no merge or deployment occurred, and no CI result is claimed. The exact final local HEAD is reported with the recovery artifacts. Build 03, specialized block editing, Sanity synchronization, publication, and approval certification remain unimplemented.
