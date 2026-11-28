# BerryMark Studio Build 02 — Implementation Handoff

## Repository position

- Repository: `https://github.com/Bibleberry/BerryMark`
- Branch: `feature/studio-browser-application`
- Accepted base: `9f830de07c98a783d2deea7bd3fc9b540c4b78c0`
- Accepted prerequisite: Build 01 / PR #25
- Final local HEAD: run `git rev-parse HEAD` in the recovered branch; the exact value is also supplied with the delivery report.

The implementation was created locally from accepted main, not from an earlier Build 01 ZIP or implementation branch. No remote write, merge, deployment, Sanity mutation, or Build 03 work was performed.

## What is implemented

- Single-command loopback Node server and Chromium workspace.
- Engine-backed new/open sessions with revision-checked metadata and screen operations.
- Document toolbar, ordered screen navigator, read-only all-block workspace, document-information form, and diagnostics inspector.
- Direct Chromium file-handle Save and Save As with cancellation, permission, external-change, and read-back safeguards.
- Source-digest-bound review companion with explicit prepared/complete transaction phases and interrupted-save recovery.
- Source-safe rendering using DOM text nodes and restrictive local HTTP/CSP controls.
- Real loopback/application tests, real-filesystem recovery tests, and automated Chromium workflow tests.
- Startup, architecture, protocol, verification, and handoff documentation plus actual application screenshots.

## Important implementation decisions

1. **Build 01 remains authoritative.** Do not add a browser-side parser, Markdown serializer, YAML editor, or duplicate manuscript model. Displayed edits are explicit calls to the engine through `StudioDocumentSessions`.
2. **No production framework or runtime dependency was needed.** The frontend is vanilla modules and the server uses Node's HTTP APIs. `@playwright/test@1.65.1` is development-only.
3. **The Node server has no arbitrary filesystem capability.** Chromium receives user-authorized handles; the server only holds in-memory source supplied by explicit open calls.
4. **Review persistence is a two-file transaction, not an atomic-write claim.** Prepared state retains previous and target digests/review states. Save success additionally requires read-back and engine reopening.
5. **Dirty state is digest-based.** It compares the current engine digest with the last verified saved digest; it is not inferred from clicking a control.
6. **Untrusted authored content is text.** Keep `textContent` rendering and the CSP. Do not introduce `innerHTML`, Markdown-generated HTML, or active authored links without a new security review.
7. **Unsupported does not mean disposable.** Unsupported/malformed manuscripts remain read-only and byte-preservable. Missing/malformed/mismatched review state is a separate diagnostic and never licenses invented history.

## Orientation map

Start with:

1. `docs/development/studio-browser-application.md` for the author workflow.
2. `docs/development/studio-application-architecture.md` for modules, routes, and security controls.
3. `docs/development/studio-review-companion.md` for the save/recovery contract.
4. `src/studio/application/document-sessions.js` and `server.js` for transport.
5. `src/studio/browser/app.js`, `files.js`, and `review-state-file.js` for host behavior.
6. `test/studio-application.test.js`, `test/studio-review-state-file.test.js`, and `test-browser/studio.spec.js` for executable expectations.

The accepted Build 01 API and invariants remain documented in `studio-document-engine-api.md`, `studio-document-engine-architecture.md`, and `studio-document-engine-build-01-verification.md`.

## Verification commands

Use Node.js 22 as the primary environment:

```sh
npm ci
npm test
npm run test:browser
npm run check
npm run preview
npm run compile
npm run compile:rejoice
npm run plan
npm run plan:artifact
npm audit
```

For an existing Chromium binary:

```sh
BERRYMARK_CHROMIUM_PATH=/path/to/chromium npm run test:browser
```

On the persistent workspace filesystem only, installation may require:

```sh
npm_config_bin_links=false npm ci
```

Compiler golden checks:

```sh
node src/compiler-cli.js examples/compiler-all-blocks.berry.md > /tmp/all-blocks.actual.json
cmp examples/compiler-all-blocks.compiled.json /tmp/all-blocks.actual.json

node src/compiler-cli.js examples/rejoice-always/rejoice-always.berry.md > /tmp/rejoice.actual.json
cmp examples/rejoice-always/rejoice-always.compiled.json /tmp/rejoice.actual.json
```

The actual Build 02 counts and environment are in `studio-build-02-verification.md`. Native macOS Chrome and Arch Linux Chromium checks remain outstanding; do not convert the Debian headless result into a claim of target-OS verification.

## Change discipline for the next coding agent

- Read the current assignment and governing `docs/ai-development-protocol.md` before coding.
- Confirm the branch/base and inspect current files rather than assuming this handoff is the latest state.
- Preserve existing CLI, compiler, importer, fixtures, goldens, language syntax, and Build 01 behavior unless a later assignment explicitly authorizes a change.
- Add a regression test for every defect. Keep real-filesystem assertions distinct from mocked picker behavior.
- Do not add dependencies without documenting why the existing zero-runtime-dependency architecture is insufficient.
- Do not silently repair source, overwrite an externally changed file, discard unsaved work, fabricate metadata, or report save success before verified writes.
- Never grant editorial/theological/publication approval. Do not add translation selection, Bible lookup APIs, rights infrastructure, or legacy Scripture cleanup under a Studio UI assignment.
- Aaron alone holds merge authority. Do not deploy, publish, mutate Sanity, or begin Build 03 without explicit current authorization.

## Known limitations and intentional exclusions

- Content Block cards and publishing/editorial fields are read-only; specialized block editing belongs to a later authorized build.
- Native picker permission prompts and real browser-to-disk behavior still need target-OS manual verification.
- Two file writes are recoverable but not atomic. A prepared companion must be retained and interpreted by digest, not deleted as stale noise.
- Source-only reopening cannot reconstruct earlier stale-approval history.
- Sessions are in-memory and per server process. This is a known single-user local tool, not a multi-user collaborative service.
- No screen-reader certification, production packaging, installer, cross-browser support, or public-hosting hardening is claimed.
- Authenticated Sanity operations were neither needed nor executed.

## Recovery and transfer

From the repository root, the required bundle command is:

```sh
git bundle create berrymark-studio-build02.bundle feature/studio-browser-application
git bundle verify berrymark-studio-build02.bundle
```

A complete repository ZIP accompanies the bundle as a secondary recovery artifact. After transfer, verify:

```sh
git bundle list-heads berrymark-studio-build02.bundle
git clone berrymark-studio-build02.bundle BerryMark-recovered
cd BerryMark-recovered
git checkout feature/studio-browser-application
git rev-parse HEAD
npm ci
npm test
npm run test:browser
```

Compare the recovered HEAD with the exact SHA in the delivery report. The bundle preserves commit history; the ZIP is a convenience copy and is not a substitute for that history.
