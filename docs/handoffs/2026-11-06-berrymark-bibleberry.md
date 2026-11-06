# Bibleberry / BerryMark: Next-Chat Engineering Handoff

**Prepared:** Friday, November 6, 2026 (US Eastern).  
**Purpose:** Standalone handoff to a new ChatGPT conversation for work the following day. Also serves as a durable stopping-point record.  
**Status:** Milestone 3 achieved Aaron's planned goal. No live software implementation is requested in this documentation PR.

## How to work with Aaron

- Aaron is hands-on with BigMac (Linux/Sway, terminal, Firefox), Git and GitHub. He personally reviews/merges PRs and prefers **one concrete terminal step at a time**, then inspects actual output before continuing. Explain engineering decisions rather than pasting many unverified commands.
- ChatGPT leads engineering synthesis and planning; Kimi and/or Gemini can implement/research defined assignments. No GitHub Copilot dependency.
- Keep the tone collaborative and precise. Do not lecture about obvious unbuilt features. Distinguish actual verification, proposed future behavior and known limitations.
- Alexis supplies substantive theological teaching and reviews editorial adaptations/ministry-facing experience. Do not rewrite her theology into generic AI prose. The Milestone 3 synthetic devotion was intentionally an exception **for testing only**.

## Repositories and environment

- BerryMark: https://github.com/ContraPhilosophy/BerryMark ; BigMac checkout `/home/aaron/BerryMark`.
- Bibleberry: https://github.com/ContraPhilosophy/Bibleberry ; BigMac checkout `/home/aaron/Projects/Bibleberry`.
- Sanity project `80016lrq`; API `2026-11-01`; test dataset **`berrymark-development`**; operational `production` dataset is public and must not receive confidential unpublished test/dev imports.
- Deployed Studio `https://bibleberry-editor.sanity.studio/` points at **production** by default, not the development dataset.
- Importer is **create-only**, unpublished **draft-only**, and rejects `--apply` to production. No overwrite/reimport or auto publication. Sanity uses published synthetic series `berrymark-test-series-m2` slug `bm-test` in dev dataset.
- Never paste token values into chat, GitHub or browser source. BigMac has an environment-based Contributor credential `BERRYMARK_SANITY_WRITE_TOKEN` for authorized development importer CLI work. It was created as a short-lived development credential **scheduled to expire November 7, 2026**; verify/renew via Sanity if needed before the next live write, not by sharing it here. Temporary Editor/Viewer credentials used in Milestone 2 were revoked/deleted.
- Existing compiled fixture previews use `npm run dev` in Bibleberry; **More -> Developer Studio -> Interactive Challenge Lab -> BerryMark Local Preview** takes a local compiler-result JSON, not a live Sanity draft.

## Completed engineering milestones

**Milestone 1:** Controlled importer corrected absent vs null series readback mismatch. Verified repeated identical-source import produces `verified-noop` with zero writes. Relevant BerryMark PR #13/#14; earlier main baseline `7057430`.

**Milestone 2:** Extensive authorized live create/readback, independent Sanity query, identical source no-op, changed-source conflict rejection with zero writes, and published synthetic series resolution in a second draft. Recorded in BerryMark `docs/controlled-draft-apply.md`, merged PR [#16](https://github.com/ContraPhilosophy/BerryMark/pull/16), main merge `671543db34d7033601c694d761e4e840270adcc4`. All test objects live in **development**, never published Challenges.

**Milestone 3 (Nov 5 evening):**
1. User's synthetic manuscript on BigMac: `examples/milestone-3-all-blocks.berry.md`; source SHA-256 `8d18725a9170ea3a60f37fad0954de30977116eced140b7e65f4762f1f6163e6`. A preserved identical copy is in GitHub at `examples/acceptance/milestone-3-all-blocks.berry.md`, using a **different path** to avoid clashing with the still-untracked BigMac file.
2. Offline `node src/sanity-draft-apply-cli.js examples/milestone-3-all-blocks.berry.md`: `structuralValid: true`, `importEligible: true`, source verified, 0 writes, expected nonblocking warnings.
3. Authorized `--apply --operator aaron.development`: 1 write; draft `drafts.berrymark-challenge-berry-m3-all-blocks`; `created-and-verified`; `readbackVerified: true`; series resolved to `berrymark-test-series-m2`; source digest as above, content SHA `be2dde67b56e94d38878d210d89b3d1cc49e186da45c2f514f30c9f0be3735d5`.
4. Independent GROQ `raw` read showed one screen `gratitude-in-ordinary-life` with exactly nine blocks in authored order and all stable IDs: CB1 `richTextBlock`, CB2 `scriptureBlock`, CB3 `statementBlock`, CB4 `comparisonBlock`, CB5 `visualCardsBlock`, CB6 `connectedSequenceBlock`, CB7 `reflectionBlock`, CB8 `optionalStudyBlock`, CB9 `prayerBlock`. Nested cards, sequence steps, reflection choices, both nested Scriptures, proposal states and prayer paragraphs checked.
5. Rich-text Sanity data checked for headings, quote, bullet/numbered list, bold/italic, Unicode, line break, literal field text, and HTTPS link annotation. An apparent missing whitespace in copied terminal output was tested directly and **passed**; no confirmed space-loss defect.
6. Pure `node src/compiler-cli.js examples/milestone-3-all-blocks.berry.md > examples/milestone-3-all-blocks.compiled.json` returned `ok: true`, one screen/nine blocks. Aaron loaded this JSON via Bibleberry **BerryMark Local Preview** and sent screenshots. CB1–CB9 presented correctly in the local reader; selected CB7 choices switched prompts; CB8 expanded and displayed rich text/link/first nested Scripture. The second CB8 Scripture was verified stored but not visible in the captured expanded-study screenshot.
7. **Do not overstate:** The successful local preview read the **compiled local JSON**, not the live imported Sanity draft. Current milestone result is combined Sanity storage proof + local reader proof, not a complete dev-draft CMS integration.

See full [Milestone 3 acceptance record](../acceptance/milestone-3-content-fidelity-2026-11-06.md).

## Approved product directions captured November 6

**WEBP is the planned launch Scripture translation.** Exact edition: World English Bible Protestant, American English, 66 books, uses LORD/GOD instead of Yahweh, public domain. Publisher source: https://worldenglish.bible/ and https://www.ebible.org/find/details.php?id=engwebp. Alexis has used WEB variants for years in Forevergreen and considers it suitable for teaching; no near-term plans for copyrighted NASB/ESV/NIV licensing. Keep edition/source provenance and trademark considerations. A source-based approval flow for verified WEBP would avoid repetitive individual passage-rights evidence; **not yet implemented or approved as a technical contract**. Do not disable generic rights safeguards. Need test actual **provided WEBP text** and memorization later; current fixture is `referenceOnly`.

**Future manuscript authoring workflow:** Create a dedicated ChatGPT Project, once engineering is stable, to faithfully structure Alexis's writing in `.berry.md` according to versioned language/registry instructions. Preserve exact theological argument and source wording, allow substantive teaching/long screens, flag editorial judgment, and let Aaron/Alexis review before any publication. Project instructions and automation not yet written.

**Future Content Blocks:** CB1–CB9 numbers are immutable and append-only; proposed standing [cross-repo extension process](../development/adding-content-blocks.md) covers whether a new type is needed vs a variant, parser/compiler, Sanity schema, adapters, reader rendering, tests, editorial gates and compatibility. Scaffolder/manifest suggested **after** trying the process on actual CB10; no command exists.

See [decision and deferred-work record](../product/2026-11-06-future-work-decisions.md).

## Pending issues observed

- Local preview reports offline `Schema complete: No` / `Import ready: No` / `Series unresolved`; separately live import succeeded. Different stages need clearer labels; CLI retains inherited offline lookup warning after online resolution.
- Prayer paragraphs are separate in data but too visually close in screenshot; optional CSS refinement.
- Developer report says `1 screens`, `1 optional studies`.
- No actual passage text in test; WEBP ingest/pinning rights design remains.
- Need explicit safe strategy to visualize the **development draft in the CMS reader**. Never expose a Contributor/write token to browser and never accidentally mix public production catalog with development-dataset drafts.
- Strengthen automated regression/readback/visual/accessible tests and cross-repo compatibility enforcement, especially for new CB types.
- BigMac `examples/milestone-2-*.berry.md`, `examples/milestone-3-all-blocks.berry.md`, and `examples/milestone-3-all-blocks.compiled.json` were untracked at stopping point; avoid `git clean`/overwrites and indiscriminate reimports.

## November 6 final acceptance and development pivot

**Update after morning BigMac verification (supersedes the old assumption that next session must begin with Sanity draft-reader integration):**

- **PASS:** `node --test` returned **185 tests passed, zero failures, zero skipped**.
- **PASS:** Recompiling the Milestone 3 nine-block fixture reproduced its previous JSON **byte-for-byte**.
- **PASS:** Repeating the same-source authorized `--apply` against the development draft returned `proposedAction: none`, `writesAttempted: 0`, `apply.status: verified-noop`, `readbackVerified: true`, and no errors.
- **PASS:** `examples/rejoice-always/rejoice-always.berry.md` compiled to **7 screens / 16 Content Blocks**; Aaron reported matching compiler counts and confirmed the resulting multi-screen local preview separated the content into distinct, visually satisfactory screens.
- **Not yet tested:** A seven-screen manuscript imported into Sanity with independent multi-screen readback. Nor has the actual previously imported development draft been fetched through the Bibleberry CMS reader. Separate, exhaustive Back/progress-indicator/a11y checks were not recorded. Keep these as future integration acceptance checks rather than completed work.
- **Current-scope verdict:** BerryMark v0.1 is **accepted for the behavior actually exercised**. Aaron is satisfied with its architecture and Sanity relationship, and explicitly chose to **defer further BerryMark/Sanity tests** in favor of broader Bibleberry development. Confidence in likely multi-screen Sanity compatibility is an inference from independently successful compiler, renderer, and one-screen live storage tests, **not** an observed seven-screen Sanity import.
- **Architecture:** BerryMark (source language and compilation), Sanity (editorial storage), and Bibleberry (reader and product features) have separable responsibilities, with shared contracts requiring careful coordination for any changes.

**PR status:** BerryMark documentation PR [#17](https://github.com/ContraPhilosophy/BerryMark/pull/17) and final regression/no-op PR [#18](https://github.com/ContraPhilosophy/BerryMark/pull/18) are **merged**. This latest acceptance/handoff update has a separate PR until Aaron merges it.

## Next-chat working priorities (revised)

**1. Shift to Bibleberry product development.** Ask Aaron what application feature or planning priority he wants to tackle; do not reflexively reopen BerryMark/Sanity testing. Relevant directions include the broader seven-Challenge-type experience, navigation and reader journey, reader progress/completion, and interactions. Do not invent new decisions or assume all these are prioritized equally.

**2. Work from the existing repositories and approved product decisions.** Use the linked documentation on `main` as current state after merge. Review impacted code before assignments, and coordinate Kimi/Gemini work through scoped GitHub issues/PRs. Keep one practical step at a time when Aaron is at BigMac.

**3. Return to Sanity integration when there is a concrete need.** Eventually run (a) a safe development-dataset **multi-screen** importer/readback acceptance and (b) read-only rendering of the previously imported draft through the Bibleberry CMS adapter and reader, without browser-embedded write credentials or exposing private development content. Neither requires delaying unrelated app development.

**4. Continue future design separately:** WEBP public-domain edition source pinning and text/rights workflow, automated fidelity/visual tests, Content Block expansion checklist and eventual first CB10 pilot, and a faithful Alexis-manuscript-to-BerryMark ChatGPT Project. These remain scheduled planning work, not automatically authorized implementation.

**5. Preserve GitHub discipline:** Review PRs and merge only under Aaron's direction; keep local untracked BigMac files safe. No additional BerryMark terminal testing is required merely to start the next Bibleberry workstream.

The new chat should treat this as a completed BerryMark acceptance checkpoint and a transition to the wider Bibleberry build. The existing chat may continue architectural/product planning independently.
