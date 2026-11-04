# Approved RFC: Field Declarations and Literal Prose in BerryMark v0.1

**Status:** APPROVED BY AARON, November 3, 2026. This document records the accepted BerryMark v0.1 field syntax. The compiler has not yet been implemented.  
**Date:** 2026-11-03  
**Related:** [Language specification](../language-spec.md), [Block registry](../block-registry.md), [Validation](../validation.md), [Rejoice Always working example](../../examples/rejoice-always/rejoice-always.berry.md)

## 1. Problem

BerryMark includes explicit structures like `[[CB8 id=...]]` and friendly lines such as `Title: Explore Jesus and human grief`. Alexis also writes free-form natural prose. The compiler must never confuse a sentence beginning with `Title:`, `Text:`, or `Question:` with structural metadata, and it must not quietly drop a line it cannot understand.

The goal is to retain the existing manuscript-friendly `Name: value` convention instead of inventing a second set of tags for every individual field.

## 2. Approved rule: field syntax is **context-sensitive**, not globally recognized

A `Name: value` line is a BerryMark field **only inside a section whose registered grammar expects named fields at that position**. It is ordinary text anywhere else.

- **Never parse fields from CB1 rich teaching prose, CB9 prayer prose, CB4 FOOTER free text, or a rich-text body region.**
- **Parse fields strictly** within CB2, CB3, CB5 CARD, CB6 STEP, CB7 CHOICE, CB8 SCRIPTURE, and the designated CB6/CB7 preamble or closing slots.
- **Rich body with a one-field header:** In CB8 and CB4 LEFT/RIGHT, require the first non-comment, nonblank line to be `Title: ...`, then **one blank line terminates the header**. Everything after the blank line, up to the next structural marker, is rich Markdown body. Subsequent literal `Title: ...` lines in that body are prose.
- **SCREEN preamble:** `Label: ...` and `# Heading` are recognized only before the first content block. No raw prose is permitted directly in a SCREEN; prose belongs inside a CB.
- **Nested SCRIPTURE in CB8:** It is a field-only section and maps to the metadata array. Its `Reference:` lines never leak into the body. Its approved opening/closing markers are unchanged.

### Parser contexts and expected fields (approved)

| Section / zone | Field mode | Permitted named fields |
| --- | --- | --- |
| YAML front matter | YAML, not this rule | Already defined separately |
| SCREEN before first CB | Header | `Label`; `# Heading` (heading isn't a field) |
| CB1 | Freeform Portable Text | None |
| CB2 | Field-only | `Reference`, `Translation`, `Text Status`, `Passage`, `Usage Rights Confirmed`, `Practice Status` |
| CB3 | Field-only | `Text`, optional `Label` |
| CB4 LEFT / RIGHT | `Title` header, then rich body | `Title` only before first blank line |
| CB4 FOOTER | Freeform plain text | None |
| CB5 CARD | Field-only | `Title`, optional `Body` |
| CB6 before first STEP | Field-only | `Cycle`, optional `Return Caption` |
| CB6 STEP | Field-only | `Title`, `Body` |
| CB6 after last STEP | Field-only | Optional `Conclusion` |
| CB7 before first CHOICE | Field-only | `Question` |
| CB7 CHOICE | Field-only | `Label`, `Prompt` |
| CB7 after last CHOICE | Field-only | Optional `Closing` |
| CB8 | `Title` header, then rich body, then zero or more nested SCRIPTURE sections | `Title` only before first blank line |
| CB8 SCRIPTURE | Field-only | Same six fields as CB2 |
| CB9 | Freeform plain-text paragraphs | None |

For CB7 without any CHOICE sections, `Closing` can follow `Question` in field-only mode. No special body markers are introduced.

The field-only mode permits fields in any order **unless a section's schema requires a particular value to be present**. It must reject unknown fields, repeated singular fields, unrecognized free text, and field lines in the wrong phase. A new field requires an explicit registry update.

### CB6 / CB7 structural boundary

Top-level CB6 and CB7 are *mixed* sections. Their `STEP` / `CHOICE` markers, not empty lines, transition between their field phases. This follows the already-authored working example:

~~~text
[[CB6 id=redemptive-history]]
Cycle: false

[[STEP id=what-god-has-done]]
Title: What God has done
Body: Jesus came to reconcile us to God.
[[/STEP]]

Conclusion: We respond in hope.
[[/CB6]]
~~~

## 3. Approved exact spelling and value types

- **Field names are exact and case-sensitive**, including spaces (e.g. `Text Status`, not `textStatus` or `text status`). This prevents a typo silently becoming a second field.
- Each field begins at the **start of a line** with no leading indentation and a colon, then optional single space, then its value: `Title: A world broken by sin`. Trailing whitespace on field lines is ignored; spaces inside the value are preserved.
- A scalar `Name: value` is a **single logical line**. A long physical line can soft-wrap visually in an editor; no character cap is implied.
- **Approved multiline plain-text form:** `Name: |` followed by lines indented at least two spaces; strip exactly two indentation spaces and preserve the remaining line breaks and blank lines. Terminate when a nonblank line falls back to indentation less than two spaces, or when the containing section closes. This is **not YAML front matter**, but a familiar YAML-style block-scalar convention.
- Boolean values use exactly `true` or `false`; enumerations (e.g. `referenceOnly`) use the schema's exact option strings. Do not silently coerce `yes`, `no`, `1`, or unrelated spellings.
- Values required by the registered type may not be empty, even if the field line appears.
- When a text value itself starts with a reserved label, it remains text after `Text:`, `Prompt:`, `Body:`, or within an indented multiline value.
- For the rich body in CB8 and CB4 LEFT/RIGHT, the blank-line header boundary is meaningful; an omitted boundary is a clear error rather than an opportunity for the parser to guess which words were intended as prose.

## 4. Ambiguity examples

**Ordinary CB1 teaching stays ordinary prose:**

~~~text
[[CB1 id=explanation]]
Title: This sentence is part of the manuscript, NOT metadata.

Text: Another sentence that happens to start with a field-like prefix.
[[/CB1]]
~~~

Because CB1 is freeform Markdown, neither line becomes a field.

**CB8 separates its title from teaching text with a blank line:**

~~~text
[[CB8 id=research]]
Title: Historical background

Title: This sentence is now part of the study body, not a second title.
[[/CB8]]
~~~

**A multiline plain-text statement can contain a literal field-like line:**

~~~text
[[CB3 id=long-takeaway]]
Label: Alexis’s teaching
Text: |
  Text: This first line begins with the literal word Text.
  This is its second line.
[[/CB3]]
~~~

In field-only mode, `Unknown: value` is an error, not silently treated as prose or ignored.

## 5. Reserved structural markers and literal text

The existing `[[SCREEN ...]]`, `[[CBn ...]]`, `[[SCRIPTURE ...]]`, and other registered marker lines retain their structural significance. A prose author who needs to display a **literal full marker at the start of a line** uses `\[[SCREEN id=example]]` (backslash before the opening brackets), with the slash removed in rendered text. **This line-start full-marker escape is approved.** Other inline-Markdown escaping details remain governed by the supported Markdown subset and require tests.

Standard `<!-- EDITORIAL NOTE: ... -->`, `<!-- TODO: ... -->`, and `<!-- REVIEW REQUIRED: ... -->` comments retain their existing non-reader-facing status; they are not confused with fields.

## 6. Applying the proposal to Rejoice Always

The existing `rejoice-always.berry.md` already follows this proposed convention:

- `CB1` and `CB9` use freeform text; no change required.
- `CB4` LEFT/RIGHT and the three `CB8` optional studies have a `Title:` first line followed by a blank line and rich body.
- `CB2` and four nested `SCRIPTURE` items are field-only.
- `CB3`, nested `CARD`, `STEP`, and `CHOICE` elements use simple `Name: value` fields.
- CB6 uses `Cycle: false` before STEP; CB7 uses `Question:`, CHOICE elements, then `Closing:`.

This is a **manual syntax fit check**, not compilation. No Scripture passage text, approvals, or publication metadata are fabricated.

## 7. Validation cases for implementation

1. CB1 `Title:` or `Text:` at beginning of prose remains a literal sentence.
2. CB8 title recognized only before blank-line header terminator; later `Title:` stays in Portable Text.
3. CB4 LEFT/RIGHT require title and rich body; no title-like content is stripped.
4. CB3 `Text:` is required, may contain literal `Title:` within its value, and permits the approved multiline `|` form.
5. CB5 CARD and CB6 STEP reject unknown fields and duplicate `Title:` or `Body:` declarations.
6. CB6 preamble and trailing `Conclusion:` map to proper Sanity fields, not to STEP body.
7. CB7 question/choice/closing parse without turning a choice prompt into a new field.
8. CB2 and CB8 SCRIPTURE apply identical validity and rights checks.
9. Unknown labels and malformed fields yield a source-location error, never data loss.
10. Closing markers are never absorbed into a multiline text value.
11. Literal full structural markers at the beginning of a prose line must use the approved one-backslash escape.

## 8. Decision and implementation boundary

**Approved November 3, 2026 by Aaron:** Keep readable, context-sensitive `Title: value` declarations; use one blank line to separate rich-text headers, strict named-field contexts, the optional two-space-indented `|` multiline plain-text form, and a one-backslash escape for a literal full structural marker at the start of a prose line. The canonical [language specification](../language-spec.md) and [block registry](../block-registry.md) document the accepted behavior.

**Not approved or implemented by this decision:** A parser/compiler, automated import, claims of app Scripture quotation rights, Sanity draft-preview access, content approval by Alexis, or the other unresolved v0.1 integration questions. Parser/adapter tests must implement these cases without silently rewriting manuscript prose.
