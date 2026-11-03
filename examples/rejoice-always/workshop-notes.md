# Rejoice Always — Manuscript Workshop Notes

**Status:** FIRST REVERSE-MAPPED BERRYMARK SOURCE COMMITTED — MANUAL PREFLIGHT ONLY; editorial, syntax and integration review pending. The complete existing seven-screen Local Prototype is now represented in a separate working BerryMark file; it has **not** been compiled, imported, or editorially approved.  
**Working branch:** `docs/berrymark-v0.1-specification` (ContraPhilosophy/BerryMark)  
**Procedure:** [Manuscript Workshop Playbook](../../docs/manuscript-workshop.md)  
**Source:** `nov2challenge(1).txt`, provided in the AppDev conversation/project files. Read the full original before adapting; it is not copied into this repository.

## Existing implementation (confirmed November 3, 2026)

- **Existing seven-screen adaptation:** [Bibleberry `src/data/interactiveChallenges.ts`](https://github.com/ContraPhilosophy/Bibleberry/blob/main/src/data/interactiveChallenges.ts), entry `id: 'nov-2'` (screen objects `b1`–`b7`). This is a real, working hardcoded prototype, **not a newly proposed or imported BerryMark program**.
- **Interactive renderer:** [Bibleberry `src/components/InteractiveChallengeLab.tsx`](https://github.com/ContraPhilosophy/Bibleberry/blob/main/src/components/InteractiveChallengeLab.tsx), selected under **Local Prototype**, with separate navigation, progress and saved-Scripture behavior.
- **User visual proof:** November 3, 2026 screenshots show all seven rendered screens, including interactive selections, deeper studies, prayer, and optional companion material.
- **Important distinction:** Bibleberry also has a distinct Sanity CMS development renderer and a two-screen synthetic fixture at `src/cms/sanity/developmentFixture.ts`. That fixture is **not** this seven-screen Rejoice Always experience. Do not conflate the two data sources.
- **Editorial state:** Several original prototype blocks are visibly flagged **Draft editorial · For Alexis’s review**. Their existence in the reader does **not** constitute approval.
- **Next exercise:** **Reverse-map and audit** the existing screen/block model against the unchanged manuscript and the BerryMark CB1–CB9 registry; do not redesign already working screens by default.

## Current BerryMark working artifacts

- **Source file:** [`rejoice-always.berry.md`](rejoice-always.berry.md), a *first-pass human-readable reverse mapping* of the existing Local Prototype. It uses seven semantic SCREEN identifiers and 16 top-level CB1–CB9 blocks, including three CB8 studies and four nested Scripture references.
- **Verification plan:** [`test-plan.md`](test-plan.md), with source/revision/test-run diagnostics, screen-by-screen expected blocks, intentional differences, negative tests and future protected draft-preview requirement.
- **Baseline:** Bibleberry `main@c43b53146f3b4f6c1d5154e1ce0409a5aa3e4d3d`, Local Prototype Challenge `nov-2`.
- **Manual marker preflight:** Seven screens, 16 top-level Content Blocks, four nested Scripture references, two companions, 35 uniquely named structural IDs, matching opening/closing markers (after excluding editorial comments). **This is not compiler validation.**
- **Known blockers:** 11 explicit `REVIEW REQUIRED` comments; unresolved series, sequence, exact release timestamp and app Scripture usage rights; provisional block-internal syntax; editorial review not established.
- **No actual BerryMark import or public-reader release.** The existing Sanity CMS Lab currently queries the `published` perspective and excludes drafts. A **protected draft-preview mode** is necessary before we can inspect a newly imported draft in the reader without prematurely publishing it.

### What the first reverse mapping teaches us

1. **The prior seven-screen layout is useful and already exists.** We do not need to redesign it to test the DSL.
2. **Existing Local Prototype `teachingText.pullQuote` has no direct Sanity richTextBlock field.** The working source represents both pull quotes as CB3 statements; whether the look and the editorial semantics remain right needs review.
3. **CB8 needs explicit repeated Scripture syntax.** The working exercise proposes `[[SCRIPTURE id=...]]` nested sections. It is **not yet approved grammar**. Freeze only after discussion and testing.
4. **Some original prose was editorially adapted into components.** CB4, CB5, CB6, CB7, and three CB8 studies must be reviewed as existing draft adaptations. Their existence in the prototype is not approval.
5. **Scripture differs intentionally from the prototype:** `referenceOnly` and `notConfigured` are used because this exercise does not establish app quotation rights. Do not assume a text-present local prototype grants permission.
6. **No TEST text was inserted into reader-facing prose.** Identification belongs to a developer-only screen banner and block IDs, as defined in the test plan.

## Source inventory

- **Title:** November 2: Rejoice Always
- **Author:** Alexis Waid (original devotional)
- **Date:** November 2, 2026
- **Primary text:** 1 Thessalonians 5:16–18 (NIV), including a quotation in the source file.
- **Source structure:** Title and passage (source lines 1–3); main teaching (lines 4–19); authored prayer (lines 20–21); social media invitation (lines 23–24); Patreon/support invitation (lines 25–26).
- **Quotation rights:** Not established for an app import. Use `referenceOnly` and do not import the NIV quotation as reader-visible passage text until rights are verified.
- **Source preservation:** Do not rewrite the original file. The adaptation is a separately reviewed artifact.
- **Publication metadata:** Exact Sanity series reference, sequence, timezone-aware release time, and review approvals have **not** been determined. Do not invent.

## The argument in Alexis's own order

1. **Opening Scripture and human objection (lines 2–5):** Paul's command “Rejoice always” seems difficult because joy is often experienced as spontaneous feeling.
2. **Critical distinction (lines 6–7):** Paul commands rejoicing rather than uninterrupted joyful feelings. Rejoicing is a heart/mind posture of recognizing God's goodness in both difficult and favorable circumstances.
3. **Qualification against denial (lines 8–10):** Rejoicing does **not** require pretending pain is absent. Scripture and Jesus's own weeping demonstrate that suffering and grief are real.
4. **The theological foundation (lines 11–15):** “Well, we have to remember the Gospel.” Human brokenness is met by Christ's atoning and reconciling work, God's inaugurated redemption, and the future making-new of all things. Rejoicing is rooted in God's past, present, and promised work rather than today's emotional condition.
5. **Formative disposition and outcome (lines 16–17):** A cultivated focus on God and his Kingdom, following Jesus's example, yields heightened awareness of gratitude.
6. **Specific practice and concluding refrain (lines 18–19):** Name God's goodness in both good and difficult experiences. Preserve the source conclusion **“Remember, rejoicing isn't pretending everything is good. It's remembering that God is good.”**
7. **Authored prayer (lines 20–21):** Keep Alexis's actual prayer text; do not generate a replacement.
8. **Adjacent promotion (lines 23–26):** Social and financial-support invitations are **not** mandatory Challenge content. Keep as separately considered companion metadata (no invented links).

### Essential source-fidelity constraints

- **Rejoicing is not identical to feeling joy.** This distinction cannot be rewritten to deny feelings altogether.
- **Rejoicing is not denial of suffering.** Do not omit the rose-colored-glasses paragraph or the example of Jesus weeping.
- **The Gospel explains the command.** Christ's atonement, reconciliation and promised renewal cannot disappear into an inspirational slogan.
- **Practice is response, not an attempt to earn standing with God.**
- **The key closing refrain and the prayer** should stay verbatim unless a human editor explicitly changes them.
- **No unapproved new historical, linguistic, or theological research** is inserted during adaptation.

## Existing seven-screen architecture (IMPLEMENTED PROTOTYPE, editorial review not established)

This is the actual structure already implemented in `Bibleberry/src/data/interactiveChallenges.ts`, not a new proposal. Keep existing stable legacy IDs for traceability, then choose long-term semantic BerryMark IDs deliberately when adapting. Preserve each source paragraph's meaning and assess any proposed edits with Alexis/Aaron.

| Screen | Existing step label / heading | Existing prototype content | BerryMark equivalence to investigate |
| --- | --- | --- | --- |
| **`b1`** | Encounter · Rejoice always. But how? | NIV Scripture panel plus the exact opening teaching paragraphs | CB2 + CB1 |
| **`b2`** | Distinguish · Feeling joyful is not the same as rejoicing | Two-sided comparison and concluding paragraph; marked draft editorial | CB4 |
| **`b3`** | Clarify · Rejoicing isn’t pretending | Teaching paragraphs with an emphasized question; optional studies on John 11:33–35 and 2 Corinthians 6:10 | CB1, possible CB3 for legacy `pullQuote`, two CB8 |
| **`b4`** | Gospel · We have to remember the Gospel | Three visual cards (brokenness, God's response, Christ's reconciliation), teaching text, emphasized conclusion | CB5 + CB1, possible CB3 for `pullQuote` |
| **`b5`** | Hope · What God has done, is doing, and will do | Connected three-step sequence, sustained teaching prose, optional study on Romans 8:18–25 and Revelation 21:1–5 | CB6 + CB1 + CB8 |
| **`b6`** | Practice · Rejoicing in real circumstances | Gratitude teaching and two selectable reflection paths; preserves concluding refrain | CB1 + CB7 |
| **`b7`** | Pray · A prayer for today | Alexis's original authored prayer | CB9 |

Beyond required screens: existing `relatedResources` array stores social follow-on and ministry support outside the completion flow. Translate thoughtfully to Sanity `companionLinks` metadata, without inventing URLs.

### Translation differences that the exercise must expose

1. **Legacy data model is not the Sanity model.** For example, the local prototype `teachingText.pullQuote` has no identical property on Sanity's `richTextBlock`. Determine whether a separate CB3 statement faithfully reproduces the presentation or a schema change is needed. Avoid losing emphasis silently.
2. **Repeatable nested items:** Local visual cards and sequence steps are identified chiefly by titles/positions rather than stable per-item IDs. BerryMark requires semantic `CARD`/`STEP` IDs; assign them during translation without changing editorial meaning.
3. **Review-state differences:** Legacy `draftEditorial` flags don't map one-to-one to Sanity's `reviewStatus: proposed|approved`. Start proposed and retain human review requirements; no fabricated approvals.
4. **Original Scripture panel includes supplied NIV text and configured practice** in this local prototype. That does **not** prove the future app's quotation rights. A BerryMark/Sanity import must use `referenceOnly` or receive documented rights confirmation first. Don't treat a copyright-risky fixture state as production policy.
5. **Additional study copy** in the prototype goes beyond the original devotional. Preserve it as existing **proposed** editorial content and separately verify factual/textual claims and approval.
6. **Prototype versus proposed changes:** It may be appropriate to improve its seven screens, but only after the source-fidelity and layout audit. Do not discard the prior investment.

## Open review questions

1. Is the existing seven-screen layout and content **editorially acceptable** to Aaron and Alexis, or are there concrete screens to revise? Screenshots establish that it works, not that it's approved.
2. How should the legacy `pullQuote` be mapped while preserving appearance and theological emphasis?
3. Are the proposed optional deeper studies, comparisons, sequence, and reflection choices approved as written?
4. What semantic stable screen IDs and nested IDs should replace/augment the legacy code identifiers, if needed?
5. Which Scripture passages may be shown in full in the actual app, under documented quotation rights?
6. Confirm companion metadata, series, sequence, `releaseAt`, and truthful review provenance before any future draft import.

## Change and decision log

- **2026-11-03 (earlier):** A separate provisional seven-screen plan was made from the manuscript without checking the pre-existing Local Prototype. **Superseded**; do not use that plan to redo the existing adaptation.
- **2026-11-03 (corrected):** User supplied full screenshots of the working seven-screen Rejoice Always Local Prototype. GitHub source verified under `src/data/interactiveChallenges.ts`, entry `nov-2`. Workshop changed from greenfield adaptation to reverse-mapping/audit, not redesign.
- **2026-11-03 (first source):** Seven-screen, 16-block `rejoice-always.berry.md` working example and independent `test-plan.md` committed. Marker nesting manually checked after excluding comments. No parser/compiler run; no human approval or Sanity change.
- **Next action:** Review the candidate reverse mapping against the screenshots and manuscript, starting with screen `b1`. Resolve the **CB8 Scripture nesting grammar** and **pullQuote-to-CB3 mapping** before handing anything to a compiler implementer. Review proposed editorial additions with Aaron/Alexis separately.

## Future-chat resume instruction

Read [the workshop playbook](../../docs/manuscript-workshop.md), the three BerryMark v0.1 design docs, the full original `nov2challenge(1).txt`, and this note. Check actual GitHub branch and latest commit. **Read the existing Local Prototype source before proposing any changes.** It is a functioning seven-screen adaptation but **not necessarily approved**. Do not import the NIV text without verified rights. Open the **working BerryMark file and test plan** next to the existing Local Prototype; resume source-fidelity and BerryMark mapping review, beginning with legacy **screen `b1`**. Do not redesign, approve, import, or publish the full Challenge on assumptions.
