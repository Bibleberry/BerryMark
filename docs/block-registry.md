# BerryMark v0.1 — Content Block Registry (Working Draft)

**Status:** Working editorial registry, checked against Bibleberry Sanity schemas as of November 3, 2026. **Context-sensitive field-declaration grammar approved November 3, 2026**; other adapter/parser details still require implementation and tests.  
**See also:** [Language Specification](language-spec.md) · [Validation and Import](validation.md)

## Registry commitments (approved)

- **CB numbers are permanent, append-only identifiers.** Never renumber, recycle, or change the meaning of an existing code.
- A CB type defines a *kind of content*, not an ordinal position or a fixed-size screen.
- Every instance has a semantic, permanent `id`: `[[CB1 id=opening-thought]]`.
- Natural document order controls presentation. Existing IDs remain stable when editors reorder.
- A block's available fields and supported formatting must match its Sanity target; do not silently discard authored content.
- **No arbitrary limit** on the number of screens, teaching paragraphs, or CB1 teaching length. Concise visual elements can receive advisory per-field warnings, not hidden truncation.
- Proposed visual, interactive, or additional-research adaptations must receive human editorial review before publication. Their review is distinct from merely creating an import draft.
- Reader-facing options (reflections, deeper studies, companions) are not required completion gates.

## Registry summary

| Code | Editorial purpose | Existing Sanity object | Review status field? |
| --- | --- | --- | --- |
| **CB1** | Rich Teaching Text | `richTextBlock` | No |
| **CB2** | Scripture | `scriptureBlock` | No |
| **CB3** | Key Statement | `statementBlock` | No |
| **CB4** | Comparison | `comparisonBlock` | Yes |
| **CB5** | Visual Cards | `visualCardsBlock` | Yes |
| **CB6** | Connected Sequence | `connectedSequenceBlock` | Yes |
| **CB7** | Optional Reflection | `reflectionBlock` | Yes |
| **CB8** | Optional Deeper Study | `optionalStudyBlock` | Yes |
| **CB9** | Prayer | `prayerBlock` | No |

The Sanity field `reviewStatus` currently allows `proposed` or `approved` for CB4–CB8, with `proposed` as the default. **Importing does not set `approved` automatically.** Current schema descriptions name Alexis as the reviewer; the intended human attribution also permits Aaron. That schema correction is deferred, not silently assumed here.

## CB1 — Rich Teaching Text

**Sanity:** `richTextBlock.body` (required, at least one Portable Text block).

**Editorial use:** Main teaching argument, development, transitions, explanation, careful exegetical nuance. Preserve Alexis's reasoning and voice; screens can contain multiple CB1 instances as needed.

**Rich Markdown permitted:** Paragraphs, bold, italic, h2/h3 headings, block quotes, bullet/number lists, and HTTP(S) links as supported by the current Portable Text schema.

~~~text
[[CB1 id=distinguishing-joy]]
There is a difference between feeling joy and choosing to rejoice.

This paragraph uses **bold** to reinforce the contrast.
[[/CB1]]
~~~

**Requirements:** Nonempty body. **No default word or character maximum.** Check formatting fidelity, not arbitrary paragraph length.

## CB2 — Scripture

**Sanity:** `scriptureBlock.scripture` (required `scriptureReference`).

**Required nested fields:** `reference`, `translation`, `textStatus` (`referenceOnly` / `provided`), `practiceStatus` (`notConfigured` / `configured`).  
**Other fields:** `passage` (only when provided), `usageRightsConfirmed` (required truthfully before passage text use).

~~~text
[[CB2 id=opening-passage]]
Reference: 1 Thessalonians 5:16–18
Translation: NIV
Text Status: referenceOnly
Practice Status: notConfigured
[[/CB2]]
~~~

These named field spellings are **approved** for CB2 and nested CB8 SCRIPTURE sections. A passage must never be copied into the output without verified app rights. Providing a Scripture reference and translation is safe even when quotation rights are unresolved. Optional memorization remains unconfigured absent licensed passage text.

## CB3 — Key Statement

**Sanity:** `statementBlock.text` (required plain text); optional `statementBlock.label` (plain string, Sanity currently initializes it to “Alexis’s teaching”).

**Editorial use:** A faithful, prominent takeaway. Do not invent a pithy claim that changes the manuscript's theological meaning.

~~~text
[[CB3 id=key-distinction]]
Label: Remember
Text: Rejoicing is not the same thing as pretending suffering does not exist.
[[/CB3]]
~~~

**Requirements:** Nonempty statement. `Text:` is required and `Label:` is optional; both use the approved exact, case-sensitive field syntax, including `Name: |` for indented multiline plain-text values. Do not treat the plain statement text as Markdown.

**Approved legacy mapping (November 3, 2026):** The Bibleberry Local Prototype's `teachingText.pullQuote` becomes a **separate CB3 immediately after the CB1 containing the corresponding teaching paragraphs**, preserving the source's exact highlighted wording, placement and label. The compiler maps CB3 to Sanity `statementBlock`; it does not silently append the quote to CB1, strip it, or duplicate it. Use a stable CB3 instance ID distinct from its preceding CB1. Whether a specific legacy highlight or placement is editorially appropriate still requires actual Aaron/Alexis review, and visual equivalence must be tested in the developer reader. CB3 can also be intentionally authored as a stand-alone key statement. No new Content Block type is necessary.

## CB4 — Comparison

**Sanity:** `comparisonBlock.left` and `.right` (both required `comparisonSide`); optional plain-text `.footer`; required `.reviewStatus`.

Each side has required **plain-text `title`** and required **Portable Text `body`**.

~~~text
[[CB4 id=feeling-versus-practice]]
[[LEFT]]
Title: Feeling Joy

An emotion that may not be present in every circumstance.
[[/LEFT]]

[[RIGHT]]
Title: Rejoicing

A response grounded in the goodness of God.
[[/RIGHT]]

[[FOOTER]]
The comparison must not suggest that feelings are irrelevant.
[[/FOOTER]]
[[/CB4]]
~~~

**Requirements:** Left title/body and right title/body; `reviewStatus: proposed` until a human review in Sanity. The first nonblank line of each LEFT and RIGHT must be `Title: ...` with a **blank line** before its rich Markdown body. Subsequent `Title:` lines in the body are literal prose. The FOOTER contains freeform plain text, not named fields. The example is schematic, not approved manuscript wording.

**Advisory review:** Excessively long concepts, imbalance between sides, reduction of nuance, or theological oversimplification. Exact advisory thresholds are undecided; never silently truncate.

## CB5 — Visual Cards

**Sanity:** `visualCardsBlock.cards`, required array of **one or more** `visualCard`; required `reviewStatus`.

Each card has required **plain-text `title`** and optional **plain-text `body`**.

~~~text
[[CB5 id=places-to-pray]]
[[CARD id=while-driving]]
Title: While driving
Body: A brief description or example.
[[/CARD]]
[[CARD id=while-waiting]]
Title: While waiting
Body: Another brief description.
[[/CARD]]
[[/CB5]]
~~~

**Requirements:** At least one card, stable ID for every card, required title per card. CARD has exact, case-sensitive `Title:` (required) and `Body:` (optional) fields. The `Body: |` two-space-indented multiline form is permitted for plain text. No fixed card count unless later reader testing justifies a documented rule.

**Review:** Mark as proposed. Cards are for visual organization, not a mandate to turn prose into short slogans.

## CB6 — Connected Sequence

**Sanity:** `connectedSequenceBlock.steps`, at least **two** `sequenceStep` items; optional `cycle` boolean (default false), `returnCaption`, `conclusion`; required `reviewStatus`.

Each step has required **plain-text `title`** and **plain-text `body`**.

~~~text
[[CB6 id=example-process]]
Cycle: false
[[STEP id=observe]]
Title: Observe
Body: First movement in the argument.
[[/STEP]]
[[STEP id=respond]]
Title: Respond
Body: Second movement in the argument.
[[/STEP]]
Conclusion: A question or concluding statement.
[[/CB6]]
~~~

**Requirements:** Two or more ordered, stable-ID steps; when `Cycle: true`, a nonempty `Return Caption:` is mandatory. Before the first STEP, `Cycle:` and optional `Return Caption:` are fields; after the final STEP, optional `Conclusion:` is a field. Each STEP has exact `Title:` and `Body:` fields. These positions are separated by structural STEP markers, not by blank lines. A cycle should only be used when the underlying argument actually returns to the starting point.

**Review:** Mark as proposed. Do not create artificial causal connections just because a sequence diagram looks attractive.

## CB7 — Optional Reflection

**Sanity:** `reflectionBlock.question` (required plain text); optional `choices` array of `reflectionChoice`; optional `closing` (plain text); required `reviewStatus`.

If choices are supplied, there must be **at least two**, and each has required plain-text **`label`** and **`prompt`**.

~~~text
[[CB7 id=personal-response]]
Question: Where could you intentionally return your attention to God today?
[[CHOICE id=work]]
Label: At work
Prompt: Consider one recurring situation.
[[/CHOICE]]
[[CHOICE id=home]]
Label: At home
Prompt: Consider one ordinary interruption.
[[/CHOICE]]
Closing: This practice is optional.
[[/CB7]]
~~~

**Requirements:** `Question:` is required; choices are optional but must number two or more if present. `Question:` appears before any CHOICE, each CHOICE has required exact `Label:` and `Prompt:` fields, and optional `Closing:` follows the final CHOICE (or Question if no CHOICE). CHOICE markers, not blank lines, define phases. Choices reveal reader-local prompts only; no personal reflection response is stored in Sanity.

**Review:** Mark as proposed. Reflection is optional, not a completion barrier.

## CB8 — Optional Deeper Study

**Sanity:** `optionalStudyBlock.title` (required plain string); `.body` (required Portable Text); optional `.scriptures` array of `scriptureReference`; required `.reviewStatus`.

~~~text
[[CB8 id=historical-context]]
Title: An Optional Closer Look

This deeper explanation can contain **rich Markdown** and links.

[[SCRIPTURE id=john-11-33-35]]
Reference: John 11:33–35
Translation: Not configured
Text Status: referenceOnly
Usage Rights Confirmed: false
Practice Status: notConfigured
[[/SCRIPTURE]]
[[/CB8]]
~~~

**Requirements:** Nonempty title and body. CB8 requires the first nonblank line `Title: ...`, then one blank line before rich Markdown body text. Later `Title:` lines in its body are ordinary teaching text. CB8 may contain **zero or more** nested `[[SCRIPTURE id=...]] ... [[/SCRIPTURE]]` sections, with the same approved field names as CB2. Their relative order and stable semantic IDs are preserved in Sanity `optionalStudyBlock.scriptures[]`. Each is a structured `scriptureReference`, *not* part of CB8's Portable Text `body`. Nested Scripture may only occur after the rich-body portion, not interspersed into field declarations.

**Review:** Mark as proposed, especially for new research or added theological/historical assertions. Reader presentation is collapsed and optional; there is no pressure to open it.

## CB9 — Prayer

**Sanity:** `prayerBlock.paragraphs`, a required array with **at least one** plain-text paragraph.

**Editorial use:** An authored prayer preserved faithfully. Do not manufacture a replacement prayer.

~~~text
[[CB9 id=closing-prayer]]
Father, thank you for your goodness.

Help us remember what is true when circumstances are difficult.
[[/CB9]]
~~~

**Requirements:** Nonempty text; preserve paragraph boundaries and punctuation. A blank line can separate paragraphs in the working syntax. Do not interpret Markdown emphasis or headings inside plain-text prayer paragraphs unless a later schema change explicitly supports them.

## Approved field-declaration conventions

The [language spec](language-spec.md#field-declarations-and-literal-prose-approved-november-3-2026) and [approved RFC](proposals/field-declarations-v0.1.md) define the **exact, case-sensitive `Name: value` names**, where they may appear, their field-only versus freeform treatment, and the one-blank-line separation required for CB4 LEFT/RIGHT and CB8 title headers. A plain-text field can use `Name: |` with continuation lines indented by at least two spaces; two spaces are removed in the parsed value. Full reserved marker lines intended literally at the start of freeform prose must be escaped as `\[[...]]`. Unexpected or duplicated field declarations are errors. CB1 teaching, CB9 prayer and CB4 FOOTER treat field-looking lines as prose.

## Block-to-Sanity translation requirements

A production adapter must explicitly cover every required Sanity field and each approved optional field for a block. It must preserve order, stable identities, supported rich text, and proposed review state. It must not invent missing Scripture rights, author attribution, or prose.

**Important distinctions:**

- **Portable Text**: CB1.body, CB4.left.body, CB4.right.body, CB8.body.
- **Plain text**: CB3.text/label, CB4 left/right titles and footer, CB5 card titles/bodies, CB6 step titles/bodies/returnCaption/conclusion, CB7 question/choice labels/prompts/closing, CB8 title, CB9 prayer paragraphs.
- **Structured Scripture references**: CB2.scripture; CB8.scriptures; Challenge primaryScripture.
- **Review-required block types**: CB4, CB5, CB6, CB7, CB8.

## Open registry decisions before implementing the parser

1. Set **advisory** length recommendations where a specific visual component benefits; no arbitrary CB1 cap.
2. Decide whether type-specific defaults should appear explicitly in BerryMark or be transparently generated, with visible validation output.
3. Freeze deterministic identity rules for nested repeatable items and safe compilation to Sanity `_key` values.
4. Test the registry against two or three substantive manuscript adaptations before declaring it implementation-ready.

**Resolved November 3, 2026:** Context-sensitive field declarations, exact field names, CB4/CB8 header separation, multiline plain-text `|`, and literal full-marker backslash escapes are approved. Authorial prose beginning with a field-looking label is not a new grammar decision.

**Resolved November 3, 2026:** CB8's repeated Scripture array uses nested, stable-ID `[[SCRIPTURE id=...]] ... [[/SCRIPTURE]]` sections; it is no longer an open syntax question.

**This registry documents known objects and intended semantics. It does not mean the grammar or compiler already exists.**
