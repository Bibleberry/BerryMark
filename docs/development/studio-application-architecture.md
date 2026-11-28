# BerryMark Studio Build 02 — Architecture and API Integration

## Design constraints

Build 02 wraps the accepted Build 01 document engine in a lightweight local application. It does not introduce another parser, serializer, manuscript model, production frontend framework, database, or runtime dependency.

The implementation is vanilla HTML, CSS, and JavaScript in Chromium, served by a small Node.js HTTP server. This keeps ordinary startup to one command and leaves the existing CLI, parser, compiler, import planners, and administrative draft tooling independent.

`@playwright/test` is pinned to `1.65.1` as a **development-only** dependency for repeatable Chromium interaction tests. It is not imported by the application or Studio server. No production dependency was added.

## Responsibility map

| Path | Responsibility |
| --- | --- |
| `src/studio/document-engine.js` | Sole authority for manuscript structure, mutations, validation, serialization, and review-state transitions; unchanged from accepted Build 01 |
| `src/studio/application/document-sessions.js` | In-memory per-document sessions, UUID identifiers, revision checks, operation dispatch, snapshots, and structured request errors |
| `src/studio/application/server.js` | Loopback HTTP transport, fixed browser-asset allowlist, JSON API, origin controls, request limits, and security headers |
| `src/studio/studio-cli.js` | Single-command startup, port selection, startup diagnostics, and shutdown |
| `src/studio/browser/app.js` | Presentation state, selected screen, file-handle lifetime, dirty state, confirmations, and operation requests |
| `src/studio/browser/block-view.js` | Read-only rendering of all nine Content Block types and complete interpreted structure |
| `src/studio/browser/files.js` | Chromium picker handles, fatal UTF-8 decoding, SHA-256, permission checks, external-change checks, writes, and read-back |
| `src/studio/browser/review-state-file.js` | Shared review-companion validation, two-file save transaction, and interrupted-save recovery |
| `src/studio/browser/api-client.js` | Same-origin JSON transport with the required application header |

The browser never computes an edited manuscript on its own. Every metadata or screen mutation is sent to the server-side engine, and the returned engine snapshot replaces the displayed snapshot. File handles, selection, dialog state, and the last saved digest are host state, not an alternative manuscript representation.

## Session and mutation model

`StudioDocumentSessions` creates independent in-memory sessions. A session snapshot contains the session ID, monotonically increasing revision, filename, status, editability, source digest, metadata, ordered screens, engine diagnostics, review diagnostics, and newline mode.

Supported operations are deliberately limited to Build 02 scope:

- `metadata.set`
- `metadata.delete`
- `screen.add`
- `screen.update`
- `screen.move`
- `screen.remove`

Each operation includes the revision on which it was based. A stale revision receives a conflict response rather than silently overwriting another edit. Failed engine operations do not partially mutate the session. Revisions advance only when exact serialized source changes. Session IDs are random and sessions are isolated; the server provides no list-all-documents route.

New documents contain only the engine's minimal BerryMark version and an empty Challenge title. Studio does not supply editorial, publishing, Scripture, or rights values.

## HTTP API

All API requests require `X-BerryMark-Studio: 1`. Mutation requests use JSON bodies and are limited to 5 MiB.

| Method and path | Result |
| --- | --- |
| `GET /api/health` | Local application/build health |
| `POST /api/documents` with `action: "new"` | Create an incomplete document |
| `POST /api/documents` with `action: "open"` | Open exact source and optional engine review state |
| `GET /api/documents/:id` | Read the current engine snapshot |
| `POST /api/documents/:id/operations` | Apply one revision-checked operation |
| `POST /api/documents/:id/serialize` | Obtain exact engine source, source digest, and serialized review state |

Engine and request failures become structured JSON errors with stable codes and appropriate 4xx statuses. Unexpected internal errors return a generic message rather than a raw stack trace.

There are no server routes for reading, writing, listing, or deleting user files; no shell execution route; no remote fetch route; no Sanity integration; and no manuscript static directory. Local files move between Chromium and the in-memory engine only through the explicit JSON open/serialize calls after user picker authorization.

## Local security boundary

- The CLI binds to `127.0.0.1`; `listenStudio` rejects non-loopback hosts.
- `Host` must match the active loopback origin and port.
- API requests require the application header. Supplied `Origin` and `Sec-Fetch-Site` values must be same-origin. No CORS permission is emitted.
- Only fixed browser assets are served. Unknown paths, traversal attempts, filesystem-looking routes, and unsupported methods are rejected.
- Responses use `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Opener-Policy: same-origin`, and `Referrer-Policy: no-referrer`.
- Content Security Policy defaults to self, disallows objects, base-URL changes, framing, and cross-origin connections.
- Authored strings are inserted with DOM `textContent`, not HTML parsing. Markdown links and script-like source are displayed as text, not activated.
- Browser saves use user-authorized Chromium handles. Permission and expected-digest checks precede ordinary overwrites.

These controls reduce accidental and cross-origin exposure; they do not make the server suitable for a public or multi-user deployment.

## Source fidelity and dirty state

Chromium reads bytes with fatal UTF-8 decoding. A UTF-8 BOM is retained rather than silently stripped. The existing engine preserves original line endings, final-newline state, unrelated source, and unchanged documents.

Dirty state compares the current engine `sourceSha256` with the digest of the last verified save. A newly created document is dirty because it has no saved destination. An opened unchanged document is clean even if review recovery information needs a later companion finalization.

Save success requires the shared two-file transaction, manuscript read-back digest equality, finalized companion recovery status, and reopening the serialized source through the engine. Only then does Studio replace the working session and clear the unsaved indicator.

## Test architecture

- `test/studio-application.test.js` starts real loopback servers and exercises API, session, security, and error behavior.
- `test/studio-review-state-file.test.js` uses real temporary files and rename-based single-file writes to verify exact bytes and interrupted transaction recovery.
- `test-browser/studio.spec.js` drives actual Chromium interactions through Playwright. Its memory handles emulate picker, permission, and write failures; they are not presented as proof of real disk behavior.
- `playwright.config.js` starts Studio on an isolated test port and permits an environment-selected Chromium binary through `BERRYMARK_CHROMIUM_PATH`.

## Build 02 boundary

Content Block cards are read-only. There is no WYSIWYG editor, block-creation interface, CMS synchronization, publication control, approval-certification workflow, account system, cloud storage, translation selection, Bible lookup, manuscript generation, or Build 03 implementation. Editorial values remain visible but read-only, and valid working status never implies approval or publication readiness.
