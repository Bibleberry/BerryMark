# Manuscript → BerryMark: Editorial Workshop Playbook

**Status:** Working editorial process, November 3, 2026. To be refined after the first complete manuscript adaptation.  
**Audience:** Aaron, Alexis, ChatGPT, and any future editor/AI session contributing to BerryMark.  
**Read first:** [Language specification](language-spec.md) · [CB1–CB9 registry](block-registry.md) · [Validation and import](validation.md).

> **Non-negotiable:** The author's teaching determines the app experience. The app's screen components never determine what Alexis is allowed to say.

## 0. Purpose and ownership

This playbook is the **repeatable editorial process** for analyzing a complete source manuscript, designing a Challenge screen structure, producing an editable BerryMark adaptation, and preparing it for review.

It is **not** an automated conversion pipeline. Aaron and ChatGPT work collaboratively, one manuscript at a time; Alexis is the original author and retains editorial authority over her teaching. The review/approval record must truthfully identify whichever person actually approves the adaptation; do not infer approvals. Another chat can follow the procedure without needing to reconstruct unrecorded decisions.

The source manuscript must remain untouched. BerryMark is the *adaptation*, not a substitute for the original source. Once the adapted BerryMark file is imported to Sanity as a draft, **Sanity becomes the authoritative editing surface**. There is no routine reimport or bidirectional synchronization.

**Project separation:** The BerryMark repository owns the language, process, parser/validator, compiler, adapter and examples; the Bibleberry repository owns its Sanity schema and reader implementation. Never casually edit Bibleberry's schema or deploy a Challenge just to complete a BerryMark editorial exercise.

## 1. At the start of every manuscript session

The human or AI facilitator should:

1. **Locate and read the full actual manuscript**, not a summary or reconstructed paraphrase. When source text is absent, request or retrieve the real text before drafting it; do not invent the omitted paragraphs.
2. **Search for any existing adaptation before proposing a new one.** Inspect relevant Bibleberry source files, local Challenge prototypes, prior Sanity drafts, and workshop notes. Record what already exists, its review status, and whether it is prototype-only, CMS-backed, or published. If a faithful screen/block adaptation already exists, **reuse and audit it** rather than starting over. An existing prototype is not automatically Alexis-approved.
3. **Identify source and provenance:** original title, author, date, file/source revision, source location, passage references, Scripture translation, and any known companion material.
4. **Identify the content categories** in the source: original devotional/teaching, authored prayer, quoted Scripture, references to other passages, editorial notes, marketing/support copy, and media links. Do not mistakenly make promotions into mandatory Challenge content.
5. **Read current** `docs/language-spec.md`, `docs/block-registry.md`, and `docs/validation.md` on the actual working branch. Use the current nine-block registry, not remembered syntax from earlier chats.
6. **Check the work-in-progress record** for this manuscript (see §9) and resume at the first unapproved decision. Don't redo an already-agreed screen, editorial change, or ID without explaining why.
7. Confirm the intended deliverable: analysis, screen map, single screen adaptation, whole BerryMark file, or validation review. Don't claim code was compiled if the compiler doesn't yet exist.

**Output of this stage:** a source inventory, an **existing-work inventory**, and clearly identified open facts, not a duplicate screen design.

## 2. Analyze the theological and rhetorical argument *before* choosing screens

Read the manuscript as a complete teaching with its own logic. Produce a concise **argument map** that explicitly distinguishes:

- **Textual anchor:** the Scripture passage and what the author actually claims about it.
- **Presenting question/problem:** the confusion, objection, tension, or need addressed.
- **Distinctions:** contrast pairs the author makes, and their limits.
- **Progression:** each inference or transition needed for the argument to work.
- **Theological center:** Gospel/christological reasoning, assumptions, and promises.
- **Formation/application:** what the reader is asked to believe, notice, practice, or reconsider.
- **Authored conclusion and prayer:** how the teaching resolves, including its distinctive phrasing.
- **Adjacent material:** social, podcast, Patreon, or companion material, separated from the teaching sequence.

Annotate significant phrases **verbatim from the source** and record why they matter; keep paraphrases separately labeled as interpretations. Note ambiguity or potentially debatable theology as a **question for Aaron/Alexis**, not as an unannounced rewrite. Do not independently add historical background, Greek exposition, claims, applications, or references unless the editors explicitly decide to include them and they are verified.

**Argument-integrity test:** If the proposed experience is read in screen order, does a reader still understand *why* the conclusion follows from the starting Scripture and premises? A nice-looking comparison is not a substitute for the Gospel argument.

**Output:** one argument map, and a short list of expressions/claims that must not be weakened.

## 3. Design screens around real rhetorical transitions

Only after the argument map, inspect the existing adaptation (if one exists) and either **audit its established sequence** or propose a provisional sequence of screens. A screen is one coherent movement in the author's reasoning, **not a fixed number of words**. Group or split based on comprehension, emphasis, transitions, and presentation, while preserving continuity.

For each proposed screen, record:

- **Stable semantic screen ID** that describes its subject, not its position (e.g. `gospel-foundation`, not `screen-3`).
- Optional reader-facing **screen label** and **heading**.
- **Purpose in one sentence:** what this screen contributes to the argument.
- **Exact source span:** opening and closing words or source line range, to ensure complete coverage.
- Candidate **Content Blocks** and *why* each communicates the source faithfully.
- **Transition** to the next screen.
- **Editorial questions or risks:** what needs the humans' attention.

Don't impose an arbitrary screen count, text length, swipe count, or mandatory rich component. Ordinary CB1 teaching is often the best choice. A screen can be substantial if the teaching needs it. Do not cut necessary explanation to satisfy a layout.

**Screens are proposals until Aaron/Alexis accepts them.** Discuss one screen at a time when working collaboratively, or present a brief full-screen map before drafting the bodies if the editor prefers. The user can request a different rhythm.

## 4. Select Content Blocks deliberately

Use the permanent append-only registry; never renumber the codes:

| Code | When to consider it | Primary caution |
| --- | --- | --- |
| **CB1** Rich Teaching Text | Main prose, contextual explanation, argument and transitions | Keep full reasoning; no arbitrary length cap |
| **CB2** Scripture | Biblical references or permitted passage text | Never assume quotation rights or configured memorization |
| **CB3** Key Statement | A brief prominent takeaway already supported by the manuscript | Do not turn nuance into an absolute slogan |
| **CB4** Comparison | The author explicitly establishes two meaningful concepts | Preserve qualifications; neither side should distort the distinction |
| **CB5** Visual Cards | Parallel examples, categories or ideas that genuinely benefit from cards | Don't force every list into a card grid |
| **CB6** Connected Sequence | A genuine ordered progression, cause/effect, or cycle in the argument | Do not fabricate causation or circularity |
| **CB7** Optional Reflection | A thoughtful invitation that follows from the teaching | Optional, not a gate to completing the Challenge |
| **CB8** Optional Deeper Study | Verified additional context, citations, exegetical detail | Keep optional; new claims require human review |
| **CB9** Prayer | The author's actual closing prayer | Preserve authored words and paragraph boundaries |

Choose fewer, better-targeted interactions rather than maximizing the number of widgets. Visuals, cards, and diagrams are supports for serious teaching, not restrictions on it.

Mark every changed, condensed, rearranged, or new passage in the adaptation notes so the reviewer can assess it. A simple paragraph split is not equivalent to an authored theological rewrite.

## 5. Draft the BerryMark adaptation

Working sequence:

1. **Start metadata** with known source facts; use explicit nulls for unknown times, approvals, and URLs. Do not manufacture values to make a sample appear complete.
2. Create ordered `[[SCREEN id=...]]` sections with optional `Label:` and `# Heading`.
3. Add registered `[[CBn id=...]]` blocks, preserving stable semantic IDs.
4. Use nested `LEFT/RIGHT/FOOTER`, repeatable `CARD/STEP/CHOICE` with IDs only when the selected block requires it.
5. Use the exact source wording as the default. Any intentional adaptation is explicitly reviewable.
6. Use Markdown formatting only in fields with Portable Text support. Plain-text fields are plain text.
7. Record non-reader-facing commentary in `<!-- EDITORIAL NOTE: ... -->`, `<!-- TODO: ... -->`, or `<!-- REVIEW REQUIRED: ... -->` comments as appropriate.
8. Exclude promotional calls-to-action from the required reading path; preserve genuinely relevant companion metadata separately.
9. Keep Scripture quotation rights in view. A manuscript quotation is not automatically app-licensed text. Default to **reference only** until the necessary rights are confirmed.

**Important v0.1 caveat:** The syntax of certain block-internal fields, warning-override directives, and some YAML-to-Sanity mappings remains provisional. Record syntax friction as a **language-design issue**, not a reason to quietly invent a grammar rule.

## 6. Review collaboratively, screen by screen

For each screen, ask these questions in order:

1. **Source fidelity:** What original source text is represented here? Was any claim lost, subtly strengthened, or weakened?
2. **Theological accuracy:** Does the presentation retain the original distinction, scriptural setting, Gospel logic, and application?
3. **Voice:** Does the text still sound like Alexis? Avoid generic AI motivational language, short choppy lines, and sloganizing.
4. **Presentation fit:** Is the chosen CB genuinely useful? Could CB1 deliver the point more faithfully?
5. **Reader agency:** Are expanded studies, reflection choices, companion links, and memorization optional where required?
6. **Hand-off traceability:** Are IDs stable, unresolved questions explicit, and proposed changes recorded?

Do not treat silence as editorial approval. The assistant recommends; Aaron and Alexis decide. The reviewer may prefer to revise the manuscript directly rather than split a passage differently. Preserve that decision.

### Practical review output per screen

~~~markdown
### Screen: gospel-foundation
- Status: proposed | accepted | revision-needed
- Source span: "Well, we have to remember the Gospel." ... "make all things new."
- Purpose: Explain why rejoicing rests on God's redemption rather than circumstance.
- Proposed blocks: CB1 (teaching)
- Unchanged key phrasing: "Well, we have to remember the Gospel."
- Adaptation decisions: none yet
- Open questions: none
- Approved by / date: not yet reviewed
~~~

The above span is illustrative of the November 2 manuscript and is **not** a finalized screen.

## 7. Perform a source-coverage audit

Before calling a full adaptation *ready for validation*, reconcile the original manuscript with the adapted output.

Create or inspect a **source-span checklist** in original sequence. Each substantive paragraph belongs to a screen/block, or is explicitly accounted for as intentionally omitted/relocated companion material. Be particularly careful with:

- Thesis statements and transitions.
- Distinctions and qualifying caveats.
- Scripture references and translation labels.
- Exegetical or Gospel reasoning that holds the argument together.
- The ending exhortation and authored prayer.
- Promotional/support material stored only as companion metadata or explicitly excluded.

No missing paragraph should be explained away as "too long for the screen." Where a phrase is changed, note both original and adaptation with the rationale. Keep a record of decisions for future sessions.

**Output:** a traceable source-to-screen map and an exception list (preferably empty).

## 8. Validate; inspect; hand off

### Before an importer exists

Manually review structural balance and syntax against the three v0.1 docs:

- Named, properly closed, non-overlapping screens and CBs.
- Unique stable IDs.
- All CB required fields and nested sections present.
- Supported formatting and type-correct metadata.
- No unverified rights/claims fabricated.
- All editorial TODO/REVIEW REQUIRED annotations visible and tracked.
- No silent omission in the source-coverage audit.

**Do not report “compiler passed” when no compiler ran.** Call this a *manual preflight review*.

### Once a compiler/importer exists

Use **Validate** and optionally its structural preview, then **Import** when qualified. Warnings block import by default; an explicitly documented target/rule/revision-specific warning override permits only a Sanity draft for inspection, not acceptance. Errors always block. Import is draft-only, no duplicates, no overwrites, with a direct Sanity edit link.

After import, use Sanity to inspect actual appearance, handle transferred review flags, perform human editorial approval, and separately publish when ready. Do not sync changes back automatically to BerryMark.

**Security:** Bibleberry's currently public-readable Sanity `production` dataset is not a secure holding area for unpublished confidential manuscripts. Use only authorized, nonconfidential test material until an appropriate private/embargo-safe path is deliberately established.

## 9. Session handoff record: make every future chat resumable

For **each manuscript adaptation**, maintain a small companion record next to the example, e.g. `examples/rejoice-always/workshop-notes.md` (path is a suggested convention, not a mandatory compiler format). Update it when decisions change.

Include:

- **Source:** manuscript title, author, date, provenance/reference, where its unchanged original can be retrieved. Avoid copying confidential originals into unapproved locations.
- **Working branch and files:** exact GitHub repository/branch paths, document revision/commit SHA if known.
- **Current stage:** source inventory → argument map → screen map → screen adaptation → source-coverage review → manual validation → importer handoff.
- **Accepted decisions:** screen IDs, purposes, CB choices, substantial wording changes, and who accepted them.
- **Pending decisions:** next screen, unresolved editorial questions, syntax questions, rights/release time/series metadata.
- **Next concrete action:** the one next step another chat can carry out.
- **Status words:** proposed, accepted for adaptation, reviewed, approved, imported-as-draft, published. These are **different states**, and none should be claimed without the real event.

### Startup protocol for a future chat

1. Read this playbook and the three current BerryMark docs **from the working branch**.
2. Retrieve the **unchanged full original manuscript** and that manuscript's **workshop-notes**.
3. Confirm current GitHub branch, last accepted screen, and pending review questions.
4. Resume from the earliest open issue. Do not replan approved screens unless new evidence justifies it.
5. Make a precise Git commit and update workshop notes after meaningful reviewed changes. Do **not** merge automatically.

A future chat should be able to answer: **What did Alexis actually write? What have we intentionally changed? Why? What has a human approved? What happens next?**

## 10. Initial exercise and feedback loop

The first exercise is **November 2, 2026: “Rejoice Always”** by Alexis Waid. An existing **seven-screen hardcoded Local Prototype** is already implemented in Bibleberry at `src/data/interactiveChallenges.ts` (Challenge `nov-2`), with display logic in `src/components/InteractiveChallengeLab.tsx`. **Start by reading both that prototype and the unchanged manuscript.** Audit source fidelity, screen/block boundaries, review flags, and target Sanity compatibility. Reconstruct it as human-readable BerryMark for editorial review **instead of redesigning the screens from scratch**. This prototype is not evidence of Alexis's final approval. Document any syntax that feels awkward. Try at least two or three substantively different Challenges before freezing the parser grammar.

**The playbook itself is versioned.** Update it based on actual editorial experience, rather than making future collaborators infer procedural rules from a chat transcript.
