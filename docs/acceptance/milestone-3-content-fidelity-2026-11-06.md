# Milestone 3 Acceptance: CB1–CB9 Content Fidelity

**Work performed:** November 5, 2026 evening (US Eastern); recorded November 6.  
**Status:** Milestone 3 reached Aaron's planned stopping point: full synthetic manuscript successfully compiled, imported as a development-only draft, independently inspected in Sanity, and visually rendered through Bibleberry's **local compiled-JSON preview**. Direct imported-draft-to-reader integration remains to be tested.

**Synthetic source:** [Milestone 3 fixture](../../examples/acceptance/milestone-3-all-blocks.berry.md) (intentionally generic BM-TEST teaching; not an Alexis-approved devotion). The BigMac working copy was `examples/milestone-3-all-blocks.berry.md`.

- Source SHA-256: `8d18725a9170ea3a60f37fad0954de30977116eced140b7e65f4762f1f6163e6`.
- Title: `BM-TEST Milestone 3 Everyday Gratitude`; slug `berry-m3-all-blocks`; series `bm-test`; sequence 2; source revision `bm-test-m3-1`.
- Sanity project `80016lrq`, API version `2026-11-01`, development dataset `berrymark-development`; **not** production.
- Series ref resolved to published synthetic series `berrymark-test-series-m2` from Milestone 2.
- Draft ID: `drafts.berrymark-challenge-berry-m3-all-blocks`.
- Stored candidate / last-imported-content SHA-256: `be2dde67b56e94d38878d210d89b3d1cc49e186da45c2f514f30c9f0be3735d5`.
- Milestone 2 prerequisite documentation: [BerryMark PR #16](https://github.com/ContraPhilosophy/BerryMark/pull/16), merged at `671543db34d7033601c694d761e4e840270adcc4`.

## Actual commands and results

Offline:

```bash
node src/sanity-draft-apply-cli.js examples/milestone-3-all-blocks.berry.md
```

Observed `structuralValid: true`, `importEligible: true`, independent source verification true, zero writes, no validation errors. Expected offline warnings for series lookup, pending editorial status, null companion URL. No Scripture-rights-evidence blocker: the fixture deliberately contains only WEBP Scripture **references**, not passage text.

Live authorized create-only test:

```bash
node src/sanity-draft-apply-cli.js examples/milestone-3-all-blocks.berry.md --apply --operator aaron.development
```

Observed `lookup.status: complete`; series published and eligible; duplicate/sequence checks returned zero matches; `proposedAction: create`, `writesAttempted: 1`, `apply.status: created-and-verified`, `readbackVerified: true`; no publication, update, or delete.

Using read-only Sanity GROQ with `perspective=raw`, Aaron then verified the actual development draft, independently of the importer:

| CB | Stored type | Inspected evidence |
|---|---|---|
| CB1 | `richTextBlock` | H2/H3, strong/em, paragraphs, newline, quote, bullets/numbers, Unicode 🌿/中文, literal `Title:` |
| CB2 | `scriptureBlock` | 1 Thessalonians 5:18, WEBP, `referenceOnly`, practice `notConfigured` |
| CB3 | `statementBlock` | Authored label and exact statement |
| CB4 | `comparisonBlock` | Two titles/bodies, italic `natural`, strong `honest`, footer retains literal asterisks |
| CB5 | `visualCardsBlock` | Three keyed ordered cards; third deliberately has null body |
| CB6 | `connectedSequenceBlock` | Two keyed steps, `cycle: true`, exact return caption and conclusion |
| CB7 | `reflectionBlock` | Two choices and prompts, closing text |
| CB8 | `optionalStudyBlock` | Study rich text, link mark definition for `https://example.com/study`, nested Psalm 100:4 and Luke 17:11-19 refs |
| CB9 | `prayerBlock` | Both authored paragraph strings |

Exactly **one** `challengeScreen` contained **nine ordered blocks**, all with expected semantic keys. CB4–CB8 preserved `reviewStatus: proposed` (not approved). An apparent missing space in pasted terminal JSON was checked with a focused independent GROQ string test and returned `PASS: spacing preserved`; it was a terminal line-wrapping issue, **not** a verified text defect.

Local compiler command:

```bash
node src/compiler-cli.js examples/milestone-3-all-blocks.berry.md > examples/milestone-3-all-blocks.compiled.json
```

Observed `ok: true`, one screen, nine blocks. In Bibleberry development server (`/home/aaron/Projects/Bibleberry`, `npm run dev`), navigated **More -> Developer Studio -> Interactive Challenge Lab -> BerryMark Local Preview** and chose the locally compiled JSON.

**Observed in screenshots:** all nine block concepts displayed; CB7 selected-choice switching produced correct respective prompts; CB6 showed two steps and the authored cycle caption; CB8 collapsed and expanded correctly and displayed italics, bold, HTTPS hyperlink and Psalm 100:4 reference; prayer and companion section visible. CB8's **second nested reference was independently verified in Sanity but was below the expanded screenshot's visible area**.

**Critical distinction:** This was a local JSON-to-reader visual test. The preview *did not fetch the imported Sanity draft*. Offline review report values (`Schema complete: No`, `Import ready: No`, `Series unresolved`) describe the pure compiler's unresolved candidate, not the separately successful live importer.

## Items to follow up

1. Build a safe, explicit development-dataset CMS preview for the **already imported draft**, without publishing it or targeting production.
2. Verify actual WEBP **provided text** after finalizing source pinning and source-based authorization; the current test used `referenceOnly`.
3. Minor UI findings: two prayer paragraphs appear too visually close; pluralization reads `1 screens` / `1 optional studies`; offline-vs-online import status messaging could be clearer.
4. Formalize automated fidelity and browser/a11y/mobile tests, including nested CB8 content, optional completion and unknown future block handling.
5. Preserve source fixture reproducibly. At stopping point BigMac's Milestone 2 and Milestone 3 working fixtures and the generated JSON were **untracked**.

## Acceptance boundary

The planned evening goal is met. Storage and local rendering fidelity of the nine synthetic types are demonstrated. **Not yet demonstrated:** direct live development-draft reader rendering, public catalog or production release, licensed/public-domain provided-passage ingest, or comprehensive automated visual/accessibility coverage.

No credentials or tokens are included in this record.

**Supersession — November 11, 2026:** The `berrymark-development` dataset named in this historical November 5–6 evidence is deleted and is not part of the current `production` / private `staging` topology. The recorded outcomes are not staging verification. This issue performs no live staging integration and grants no live staging write permission.


## November 6 follow-up: rapid BigMac acceptance sweep

**Operator:** Aaron; all checks executed locally using the unchanged Milestone 3 synthetic source `examples/milestone-3-all-blocks.berry.md`.

**1. Full automated regression: PASS.**

```bash
cd /home/aaron/BerryMark
node --test
```

Observed final summary: **185 tests, 185 pass, 0 fail, 0 skipped, 0 cancelled, 0 todo**; approximately 2.33 seconds. The suite covers parser and compiler mapping for CB1–CB9, exact/secure Markdown and metadata handling, deterministic keys/fingerprints, import planning, fail-closed lookup and credential behavior, readback equivalence, create-only/no-op and conflict handling. A passing suite does not replace actual live-reader integration.

**2. Byte-identical repeat compilation: PASS.**

```bash
node src/compiler-cli.js examples/milestone-3-all-blocks.berry.md \
  | cmp -s examples/milestone-3-all-blocks.compiled.json - \
  && echo "PASS: Deterministic compilation" \
  || echo "FAIL: Compilation output differs"
```

Observed stdout: `PASS: Deterministic compilation`. The second compilation matched the prior generated JSON byte-for-byte.

**3. Live same-source repeat import: PASS with zero writes.**

```bash
set -o pipefail
node src/sanity-draft-apply-cli.js \
  examples/milestone-3-all-blocks.berry.md \
  --apply --operator aaron.development \
  | jq '{action: .proposedAction, writes: .writesAttempted, status: .apply.status, verified: .apply.readbackVerified, errors: .errors}'
```

Observed:

```json
{
  "action": "none",
  "writes": 0,
  "status": "verified-noop",
  "verified": true,
  "errors": []
}
```

`proposedAction: none` is consistent with a verified no-op; it is **not** a failure. Importer did not write to Sanity, and existing draft content passed verification. No token is included in the evidence.

**Verdict:** BerryMark v0.1's **currently implemented, scoped** syntax, nine-block compilation, deterministic output, and controlled create-only development-draft importer passed this acceptance sweep, in addition to the November 5 storage and local-visual tests described above. Remaining integration work (direct live dev draft -> Bibleberry reader, actual WEBP supplied text/source authorization, broader accessibility and automated fidelity coverage) is explicitly outside this acceptance claim.


## November 6 follow-up: multi-screen compiler and local reader preview

**Fixture:** The existing authored `examples/rejoice-always/rejoice-always.berry.md`, not the one-screen Milestone 3 synthetic fixture.

**Compiler verification: PASS.** Aaron executed:

```bash
cd /home/aaron/BerryMark
node src/compiler-cli.js examples/rejoice-always/rejoice-always.berry.md > /tmp/berrymark-multiscreen.json
jq '{ok, screens: (.sanityCandidate.screens | length), blocks: ([.sanityCandidate.screens[].blocks[]] | length)}' /tmp/berrymark-multiscreen.json
```

The reported result matched the expected **`ok: true`, `screens: 7`, `blocks: 16`**. The 185-test suite also includes existing seven-screen/sixteen-block fixture coverage.

**Browser presentation: PASS (manual visual check).** Aaron loaded `/tmp/berrymark-multiscreen.json` into **Bibleberry -> More -> Developer Studio -> Interactive Challenge Lab -> BerryMark Local Preview** and confirmed that the manuscript was separated into distinct screens that looked correct. This confirms multi-screen local preview presentation in practice. The conversation did **not** separately record systematic proof of every Back-button transition, individual progress indicator value, or exhaustive accessibility coverage; those must not be marked as independently verified.

**Live Sanity multi-screen write/readback: DEFERRED by decision.** This test was **not performed**. The planned evidence consists of known successful Sanity create/readback for a one-screen nine-block fixture, compiled source for a seven-screen fixture, and working multi-screen local reader presentation. This gives reasonable confidence in the architecture, but does **not** establish that multi-screen content has passed an actual Sanity import and independent live readback.

**Acceptance decision:** BerryMark v0.1's currently implemented parsing, validation, deterministic compilation, and controlled one-screen development-draft import are accepted for their proven scope. The multi-screen **compiler + reader presentation** is also accepted. A **multi-screen live Sanity import/readback** and a **direct Sanity-development-draft-to-Bibleberry reader** remain targeted integration tests when that workflow is resumed; they are **not prerequisites for moving to broader Bibleberry application development now**.

**Development focus:** Aaron considers BerryMark and Sanity sufficiently stable to build on and is moving focus to Bibleberry's wider product experience, navigation, Challenge interactions, reader progress, and other app functionality. BerryMark/Sanity are maintained as largely separable subsystems with explicit contracts at their integration boundaries; future issues can be resolved with focused cross-repository changes rather than general repeated acceptance testing.

**Documentation:** Earlier planning/handoff PR #17 and the November 6 185-test/no-op acceptance PR #18 are both merged into `main`. This update records the newly completed multi-screen check and the resulting scope decision.
