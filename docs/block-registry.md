# BerryMark v0.1 — Content Block Registry (Working Draft)

**Status:** Working editorial registry, checked against the Bibleberry Sanity schemas as of November 3, 2026. Detailed inside-block syntax remains to be tested and finalized.  
**See also:** [Language Specification](language-spec.md) · [Validation and Import](validation.md)

## Registry commitments (approved)

- **CB numbers are permanent, append-only identifiers.** Never renumber, recycle, or change the meaning of an existing code.
- A CB type defines a *kind of content*, not an ordinal position or a fixed-size screen.
- Every instance has a semantic, permanent \`id\`: \`[[CB1 id=opening-thought]]\`.
- Natural document order controls presentation. Existing IDs remain stable when editors reorder.
- A block's available fields and supported formatting must match its Sanity target; do not silently discard authored content.
- **No arbitrary limit** on the number of screens, teaching paragraphs, or CB1 teaching length. Concise visual elements can receive advisory per-field warnings, not hidden truncation.
- Proposed visual, interactive, or additional-research adaptations must receive human editorial review before publication. Their review is distinct from merely creating an import draft.
- Reader-facing options (reflections, deeper studies, companions) are not required completion gates.

## Registry summary

| Code | Editorial purpose | Existing Sanity object | Review status field? |
| --- | --- | --- | --- |
| **CB1** | Rich Teaching Text | \`richTextBlock\` | No |
| **CB2** | Scripture | \`scriptureBlock\` | No |
| **CB3** | Key Statement | \`statementBlock\` | No |
| **CB4** | Comparison | \`comparisonBlock\` | Yes |
| **CB5** | Visual Cards | \`visualCardsBlock\` | Yes |
| **CB6** | Connected Sequence | \`connectedSequenceBlock\` | Yes |
| **CB7** | Optional Reflection | \`reflectionBlock\` | Yes |
| **CB8** | Optional Deeper Study | \`optionalStudyBlock\` | Yes |
| **CB9** | Prayer | \`prayerBlock\` | No |

The Sanity field \`reviewStatus\` currently allows \`proposed\` or \`approved\` for CB4–CB8, with \`proposed\` as the default. **Importing does not set \`approved\` automatically.** Current schema descriptions name Alexis as the reviewer; the intended human attribution also permits Aaron. That schema correction is deferred, not silently assumed here.

## CB1 — Rich Teaching Text

**Sanity:** \`richTextBlock.body\` (required, at least one Portable Text block).

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

**Sanity:** \`scriptureBlock.scripture\` (required \`scriptureReference\`).

**Required nested fields:** \`reference\`, \`translation\`, \`textStatus\` (\`referenceOnly\` / \`provided\`), \`practiceStatus\` (\`notConfigured\` / \`configured\`).  
**Other fields:** \`passage\` (only when provided), \`usageRightsConfirmed\` (required truthfully before passage text use).

~~~text
[[CB2 id=opening-passage]]
Reference: 1 Thessalonians 5:16–18
Translation: NIV
Text Status: referenceOnly
Practice Status: notConfigured
[[/CB2]]
~~~

The field-line spelling is **illustrative**. A passage must never be copied into the output without verified app rights. Providing a Scripture reference and translation is safe even when quotation rights are unresolved. Optional memorization remains unconfigured absent licensed passage text.

## CB3 — Key Statement

**Sanity:** \`statementBlock.text\` (required plain text); optional \`statementBlock.label\` (plain string, Sanity currently initializes it to “Alexis’s teaching”).

**Editorial use:** A faithful, prominent takeaway. Do not invent a pithy claim that changes the manuscript's theological meaning.

~~~text
[[CB3 id=key-distinction]]
Label: Remember
Text: Rejoicing is not the same thing as pretending suffering does not exist.
[[/CB3]]
~~~

**Requirements:** Nonempty statement. The grammar of field labels is provisional. Do not treat the plain statement text as Markdown.

## CB4 — Comparison

**Sanity:** \`comparisonBlock.left\` and \`.right\` (both required \`comparisonSide\`); optional plain-text \`.footer\`; required \`.reviewStatus\`.

Each side has required **plain-text \`title\`** and required **Portable Text \`body\`**.

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

**Requirements:** Left title/body and right title/body; \`reviewStatus: proposed\` until a human review in Sanity. Side bodies support rich Markdown; titles/footer do not. The example is schematic, not approved manuscript wording.

**Advisory review:** Excessively long concepts, imbalance between sides, reduction of nuance, or theological oversimplification. Exact advisory thresholds are undecided; never silently truncate.

## CB5 — Visual Cards

**Sanity:** \`visualCardsBlock.cards\`, required array of **one or more** \`visualCard\`; required \`reviewStatus\`.

Each card has required **plain-text \`title\`** and optional **plain-text \`body\`**.

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

**Requirements:** At least one card, stable ID for every card, required title per card. The exact internal \`Title:\` / \`Body:\` spelling is provisional. There is no fixed card count unless later reader testing justifies a documented rule.

**Review:** Mark as proposed. Cards are for visual organization, not a mandate to turn prose into short slogans.

## CB6 — Connected Sequence

**Sanity:** \`connectedSequenceBlock.steps\`, at least **two** \`sequenceStep\` items; optional \`cycle\` boolean (default false), \`returnCaption\`, \`conclusion\`; required \`reviewStatus\`.

Each step has required **plain-text \`title\`** and **plain-text \`body\`**.

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

**Requirements:** Two or more ordered, stable-ID steps; when \`cycle: true\`, a nonempty \`returnCaption\` is mandatory. A cycle should only be used when the underlying argument actually returns to the starting point.

**Review:** Mark as proposed. Do not create artificial causal connections just because a sequence diagram looks attractive.

## CB7 — Optional Reflection

**Sanity:** \`reflectionBlock.question\` (required plain text); optional \`choices\` array of \`reflectionChoice\`; optional \`closing\` (plain text); required \`reviewStatus\`.

If choices are supplied, there must be **at least two**, and each has required plain-text **\`label\`** and **\`prompt\`**.

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

**Requirements:** Question is required; choices are optional but must number two or more if present. Choices reveal reader-local prompts only; no personal reflection response is stored in Sanity.

**Review:** Mark as proposed. Reflection is optional, not a completion barrier.

## CB8 — Optional Deeper Study

**Sanity:** \`optionalStudyBlock.title\` (required plain string); \`.body\` (required Portable Text); optional \`.scriptures\` array of \`scriptureReference\`; required \`.reviewStatus\`.

~~~text
[[CB8 id=historical-context]]
Title: An Optional Closer Look

This deeper explanation can contain **rich Markdown** and links.
[[/CB8]]
~~~

**Requirements:** Nonempty title and body. Related Scripture items must follow the same rights/translation conventions as CB2; the exact BerryMark syntax for their array is not yet decided.

**Review:** Mark as proposed, especially for new research or added theological/historical assertions. Reader presentation is collapsed and optional; there is no pressure to open it.

## CB9 — Prayer

**Sanity:** \`prayerBlock.paragraphs\`, a required array with **at least one** plain-text paragraph.

**Editorial use:** An authored prayer preserved faithfully. Do not manufacture a replacement prayer.

~~~text
[[CB9 id=closing-prayer]]
Father, thank you for your goodness.

Help us remember what is true when circumstances are difficult.
[[/CB9]]
~~~

**Requirements:** Nonempty text; preserve paragraph boundaries and punctuation. A blank line can separate paragraphs in the working syntax. Do not interpret Markdown emphasis or headings inside plain-text prayer paragraphs unless a later schema change explicitly supports them.

## Block-to-Sanity translation requirements

A production adapter must explicitly cover every required Sanity field and each approved optional field for a block. It must preserve order, stable identities, supported rich text, and proposed review state. It must not invent missing Scripture rights, author attribution, or prose.

**Important distinctions:**

- **Portable Text**: CB1.body, CB4.left.body, CB4.right.body, CB8.body.
- **Plain text**: CB3.text/label, CB4 left/right titles and footer, CB5 card titles/bodies, CB6 step titles/bodies/returnCaption/conclusion, CB7 question/choice labels/prompts/closing, CB8 title, CB9 prayer paragraphs.
- **Structured Scripture references**: CB2.scripture; CB8.scriptures; Challenge primaryScripture.
- **Review-required block types**: CB4, CB5, CB6, CB7, CB8.

## Open registry decisions before implementing the parser

1. Freeze exact syntax for each type's field lines, including escaping a literal \`Title:\` or a reserved marker inside authored prose.
2. Decide how CB8's repeated Scripture references are represented in BerryMark.
3. Set **advisory** length recommendations where a specific visual component benefits; no arbitrary CB1 cap.
4. Decide whether type-specific defaults should appear explicitly in BerryMark or be transparently generated, with visible validation output.
5. Freeze deterministic identity rules for nested repeatable items and safe compilation to Sanity \`_key\` values.
6. Test the registry against two or three substantive manuscript adaptations before declaring it implementation-ready.

**This registry documents known objects and intended semantics. It does not mean the grammar or compiler already exists.**
