# BerryMark Studio — Review Companion and Interrupted-Save Recovery

## Why a companion exists

The `.berry.md` file is the authoritative authored product. Build 01 also exposes editorial review state that cannot be inferred reliably from source-only reopening. In particular, editing an approved manuscript must retain the warning that its former approval is stale.

Studio therefore persists the engine's `serializeReviewState()` result in a small adjacent JSON file. For:

```text
devotional.berry.md
```

the conventional companion is:

```text
devotional.berry.md.review.json
```

The companion is not a second manuscript, does not replace source control, and does not grant, renew, or certify approval. Keep it with the manuscript when moving or backing up the document.

## Digest binding

A finalized companion has:

- `format: "berrymark-studio-review-file-v1"`.
- The manuscript filename for human inspection.
- `sourceSha256`, the SHA-256 of the exact manuscript bytes.
- `reviewState`, the engine's serialized `berrymark-studio-review-v1` value.
- A transaction record whose `phase` is `complete`.

The engine review state also contains the same source digest and an `approvalStale` boolean. The application supplies that state to `openBerryMarkDocument(source, { filename, reviewState })` when reopening. A top-level filename match alone is never sufficient to accept review history.

## Save sequence

Two filesystem objects cannot be updated as one atomic transaction through Chromium's File System Access API. Studio uses an explicit recovery record instead:

1. Inspect the selected destination manuscript bytes and the destination companion. Confirm replacement of existing files for Save As, or obtain explicit permission to reset missing, malformed, or mismatched history for Save.
2. Serialize source and review state through the Build 01 engine.
3. Check the destination manuscript digest again. Write a **prepared** companion containing the destination’s previous digest and matching review state, plus the working document’s target digest and review state.
4. Recheck the destination manuscript digest, then write the manuscript.
5. Write the **complete** companion with the same transaction ID and target state.
6. Read back the manuscript and require its SHA-256 to equal the engine output.
7. Read back the companion and require finalized, matching review state.
8. Reopen the serialized manuscript and verified review state through the engine and only then report success.

Conceptually, the prepared record contains:

```json
{
  "transaction": {
    "id": "random-uuid",
    "phase": "prepared",
    "previousSourceSha256": "sha256-or-null",
    "previousReviewState": null,
    "targetSourceSha256": "target-sha256",
    "targetReviewState": {
      "version": "berrymark-studio-review-v1",
      "sourceSha256": "target-sha256",
      "approvalStale": true
    }
  }
}
```

The actual companion also retains the finalized top-level digest and target review state so the target can be recovered if the last write is interrupted. If the previous and target digests are identical, Studio retains a stale-approval warning from either state because both refer to the same source bytes.

The transaction protocol cannot make two files atomic. Its guarantee is narrower and explicit: an interrupted phase is marked, save success is withheld, and reopening can select the review state that matches the manuscript bytes actually present.

## Opening and recovery outcomes

| Companion/manuscript condition | Studio behavior |
| --- | --- |
| Complete companion digest matches manuscript | Restore review state; status `matched` |
| Prepared transaction and manuscript matches target digest | Restore target state; status `recovered-target`; save again to finalize the companion |
| Prepared transaction and manuscript still matches previous digest | Restore previous state, including a previous stale warning when present; status `recovered-previous` |
| No companion supplied | Open source without inventing history; status `missing`; companion replacement requires confirmation on Save |
| Companion is invalid or unsupported | Preserve manuscript; status `malformed`; no history is inferred |
| Companion belongs to different bytes and no prepared state matches | Preserve both; status `mismatched`; no history is inferred |

A missing, malformed, or mismatched companion does not make the manuscript unsupported. The document opens according to the engine's own structural validation, with a separate review diagnostic.

## Failed saves

- **Prepare-review failure:** the manuscript write has not started. Changes remain unsaved.
- **Manuscript-write failure:** success is not reported. The prepared companion retains previous and target recovery information. Browser writes are aborted on failure where Chromium supports it.
- **Finalize-review failure:** the manuscript may already contain target source. Studio still reports an incomplete save and keeps the working document dirty. Reopening uses `recovered-target` when the target bytes are present.
- **Read-back or engine-reopen failure:** Studio does not clear dirty state. Do not treat the operation as confirmed; reopen both files and inspect the recovery diagnostic before retrying.

For an ordinary Save to an existing manuscript, Studio accepts only the last saved digest or the target digest of a known partial save. Any other current digest is treated as an external change and is not overwritten.

## Manual recovery guidance

1. Do not delete a prepared companion before opening the manuscript and companion together in Studio.
2. Read the recovery message and verify which manuscript content is present.
3. If Studio reports recovered target or previous state, use Save to finalize a complete companion after confirming that no external change is present.
4. If the companion is malformed or mismatched, preserve a backup before explicitly approving a reset. Resetting creates review state for the current source; it does not reconstruct unknown historical approval.
5. If the manuscript itself is externally changed or its provenance is uncertain, stop and compare backups/source control. Studio does not choose between competing manuscript versions.

## Verification boundary

`test/studio-review-state-file.test.js` verifies this protocol with real temporary filesystem files, including BOM, CRLF, absent final newline, approved-to-stale review persistence, both interruption points, and malformed/missing/mismatched companions.

Browser tests inject picker and write failures into memory handles to prove interface behavior and dirty-state retention. They complement, but do not replace, the real-filesystem tests or manual Chromium permission-dialog checks on macOS and Arch Linux.
