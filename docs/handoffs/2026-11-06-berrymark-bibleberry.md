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

## Tomorrow's prioritized engineering sequence

**0. Read this handoff plus acceptance and decisions; verify docs PR state and merge as Aaron directs.** Do not assume documentation is on `main` until merged.

**1. Safely inspect repository status** on BigMac (`git status -sb`, relevant branches). Do not discard local fixtures. Avoid running live create-only apply against an existing identity: an identical source will be a no-op, modified source may conflict, and these are expected safeguards.

**2. Decide and scope the next milestone:** development-dataset **read-only draft rendering in the Bibleberry CMS reader path**, with explicit authorization strategy and no browser-embedded write tokens, plus clear separation from published production catalog. Review current `src/cms/sanity/readPublishedChallenges.ts`, `mapChallenge.ts`, `SanityChallengeLab.tsx` and `BerryMarkLocalPreview.tsx` before proposing code; confirm which endpoints are publicly readable. Write a narrowly scoped Kimi assignment/issue/PR after Aaron approves design.

**3. Run practical acceptance:** load the imported Milestone 3 draft (or securely obtained read-only representation) through appropriate CMS adapter and UI; check every block, both CB8 Scriptures, link, optional behaviors, stable IDs, prayer paragraph spacing, responsive and keyboard use; document evidence separately from local compiled JSON preview.

**4. Schedule follow-on design**, not necessarily in the same coding PR: WEBP source/versioned text and source-based rights authorization; automated end-to-end fidelity harness; Content Block extension procedure approval and eventual CB10 pilot; ChatGPT Project for faithful Alexis-manuscript conversion.

**5. Documentation:** keep BerryMark and Bibleberry roadmap/status accurate; write real results and decisions into GitHub via reviewed PRs. Aaron merges, ChatGPT does not silently merge.

The separate **existing chat** remains available for further planning later; new chat should focus on tomorrow's engineering execution, using this document as shared state. No promises of background or automatic work.
