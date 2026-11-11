# Bibleberry / BerryMark: Product Decisions and Deferred Work, 2026-11-06

**Status:** Decision record and planning inventory. Explicitly distinguish approved product direction from proposed implementation; this file does not modify software, change existing rights gates, or authorize publication.

**Sanity topology supersession — November 11, 2026:** The former `berrymark-development` dataset is deleted. Only `production` and private `staging` are current. Historical acceptance references below are not evidence of staging behavior. Any future live staging acceptance requires Aaron's separate authorization and restricted credentials; this issue grants none.

**Related:** [Milestone 3 acceptance record](../acceptance/milestone-3-content-fidelity-2026-11-06.md) · [Content Block extension procedure](../development/adding-content-blocks.md) · [Next-session handoff](../handoffs/2026-11-06-berrymark-bibleberry.md)

## 1. Approved: launch Scripture translation is WEBP

Aaron and Alexis have used World English Bible variants in Forevergreen for years; Alexis, as the theologian and ministry author, is comfortable teaching from that translation. The app's launch direction is **WEBP**, the World English Bible Protestant edition, American English, **66-book canon**, with **LORD / GOD** instead of the classic WEB's **Yahweh**. The publisher designates the text **public domain**. This is not a plan to license or integrate NIV, ESV, NASB, or other restricted commercial translations at launch.

**Canonical publisher references checked 2026-11-06:**
- https://worldenglish.bible/ (edition overview; WEBP is USA Protestant 66-book LORD edition).
- https://www.ebible.org/find/details.php?id=engwebp (identifier `engwebp`, edition, public-domain statement).
- https://ebible.org/engwebp/copyright.htm (public-domain and trademark notice).

**Important distinctions:**
- WEBP is not the classic WEB / WEBUS (which uses Yahweh), and it is not WEBU (which includes the larger ecumenical book set). Record exact edition and source identifier rather than a generic `WEB` label.
- The translation text is public domain. **World English Bible is a trademark**. If text is modified, do not continue to label that modified translation as the unmodified World English Bible.
- Preserve references, verse text, exact source edition, and source provenance. Decide a reproducible snapshot/version and ingestion format before building a bulk Scripture repository; the public distributor posts updates.
- The launch app needs actual Scripture display and eventually memorization, not a reference-only experience everywhere.

**Implementation work proposed, not yet approved/design-complete:**
1. Establish an approved Scripture-source manifest/allowlist for the pinned WEBP source and a repeatable acquisition/verification method.
2. Make ordinary text sourced from that approved edition satisfy the rights check without asking Alexis or Aaron to provide independent evidence for **every verse**. Keep a safe rejection path for unrecognized or restricted sources.
3. Preserve existing conservative import safety until the new source-based authorization contract is explicitly designed, reviewed and tested. Do not switch off `BM_IMPORT_RIGHTS_EVIDENCE_REQUIRED` indiscriminately.
4. Test actual provided WEBP passage text, punctuation, paragraphs, reference mapping, and memorization availability end-to-end. Tonight's Milestone 3 fixture intentionally used `referenceOnly`, so provided passage text remains untested.
5. Commercial translation licensing, permission workflows, and multi-translation integrations are **deferred**, not launch prerequisites.

## 2. Approved direction: dedicated manuscript-to-BerryMark authoring workflow

After engineering stabilization, create a **dedicated ChatGPT Project** with versioned instructions and the authoritative BerryMark language specification, block registry, examples, and editorial boundaries. The intended workflow:

Alexis authors substantive teaching -> AI faithfully structures it as `.berry.md` -> BerryMark validates/compiles -> controlled create-only Sanity draft import -> Aaron/Alexis editorial review -> separate publication process.

**Authorial-fidelity policy:** Alexis's theological reasoning, exact wording where practical, argument progression, Scripture references, qualifications, and distinctive voice govern the adaptation. AI is a structure/format assistant, **not** a ghostwriter that pads, compresses, or transforms substantive teaching into canned slogans. It should flag genuinely ambiguous block or screen choices and unsupported claims rather than silently inventing new theology. Long teaching and scrolling are acceptable. Optional deeper-study material is only optional; do not gate completion on opening it.

**Next design deliverable:** An approved, reusable ChatGPT Project instruction set with examples and an editorial diff/review checklist. This is a *planned workflow*, not an operating Project or automated production pipeline today.

## 3. Approved direction: extend Content Blocks deliberately

The current nine Content Block **type codes** CB1–CB9 are permanent and append-only. New capabilities should be evaluated as (a) a new block type versus (b) a presentation variant or extension of an existing type. Preserve semantic instance IDs, authorial fidelity, editorial review gates, deterministic output, stable mapping, and no silent drops.

The proposal is to create a standing, reviewable extension process spanning BerryMark parser/compiler, Sanity schema, Bibleberry runtime validation/adapter/renderer, fixtures, regression tests, and deployment compatibility. See the [extension procedure](../development/adding-content-blocks.md).

**Suggested efficiency sequence:** Document the process now; apply it to the first real CB10 addition; then assess a machine-readable registry and a `block:new` scaffolder based on repetitive work observed. These tools are ideas, **not implemented commands**.

## 4. Engineering follow-ups observed in Milestone 3

- **Live draft reader integration:** Local BerryMark JSON preview is working, but the historical draft in the deleted `berrymark-development` dataset has not been rendered via a live CMS reader path. Any future live test must use a separately authorized staging-only read path; it is not approved by this issue. Do not conflate this with the established preview or production published-only catalog.
- **Offline-vs-online status clarity:** Compiler-side report says `Schema complete: No`, `Import ready: No`, and `Series unresolved`, even after a separate authorized import succeeded and resolved the series. This is contextually correct for an *offline candidate* but needs clearer UI copy; the apply CLI similarly retains inherited offline `BM_SERIES_LOOKUP_REQUIRED` warnings.
- **Visual polish:** Prayer's two distinct paragraphs have insufficient apparent vertical separation in the local reader screenshot; review CSS. Singular pluralization shows `1 screens` and `1 optional studies`.
- **Accessibility / UX:** Verify CB8 expandable content and nested Scripture on supported viewports and keyboard/screen-reader interaction. CB7 optional reflection choice states were photographed and work. The second nested Scripture in CB8 was verified in Sanity but was below the captured expanded-study screenshot.
- **Reproducibility:** Keep the synthetic acceptance source in GitHub with original SHA; the user's working copy and compiled JSON on BigMac are currently untracked. Keep generated artifacts distinct from authoring sources and avoid overwriting local untracked paths when pulling.

## 5. What remains intentionally undecided

No detailed WEBP corpus implementation, translation permissions architecture, new CB10 semantics, machine-generated registry design, scaffolder command, direct development-draft reader connection, or ChatGPT Project instruction set has yet been authorized for coding. Treat those as scoped design work requiring approval, rather than implying completed implementation.

These plans do not supersede the approved create-only, draft-only, non-production BerryMark importer policy or the Aaron/Alexis editorial publication gates.
