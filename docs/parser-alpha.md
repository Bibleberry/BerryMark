# BerryMark Experimental Syntax Parser (alpha)

**Status:** Read-only executable parser and structural preview, not the full v0.1 Validate or Import implementation.  
**Implementation:** [`src/parser.js`](../src/parser.js), [`src/cli.js`](../src/cli.js), [`test/parser.test.js`](../test/parser.test.js)  
**Reference grammar:** [Language Specification](language-spec.md), [Content Block Registry](block-registry.md), [Validation and Import](validation.md)

## What exists now

A dependency-free Node.js 20+ experimental syntax parser with a terminal interface:

~~~sh
npm test
npm run check
npm run preview
node src/cli.js check examples/rejoice-always/rejoice-always.berry.md
node src/cli.js preview examples/rejoice-always/rejoice-always.berry.md
node src/cli.js json examples/rejoice-always/rejoice-always.berry.md
~~~

**Commands:** `check` returns exit code 0 on syntax success, 1 for syntax errors, 2 for wrong arguments/read failures. `preview` prints ordered screen/CB identities; `json` prints an experimental structural AST. Neither is a separate product workflow beyond the planned read-only Validate; they are **alpha developer modes**, not an import authorization.

**Implemented checks:**

- YAML `---` front-matter *boundaries*, but **not YAML contents or semantics**.
- SCREEN, CB1–CB9 and nested marker balance, parent/child relationships and stable ID collisions.
- Context-sensitive fields, exact spelling, required/duplicate fields, two-space `Name: |` multiline plain text, blank-line rich-body title boundaries and backslash-escaped literal marker lines.
- CB4 LEFT/RIGHT/FOOTER, CB5 CARD, CB6 STEP/cycle, CB7 CHOICE and CB8 nested SCRIPTURE structures.
- Selected Scripture *field consistency* checks (referenceOnly versus provided, passage presence, claimed rights status and practice configuration). **This is not external evidence of quotation rights.**
- Editorial comments are captured as non-reader-facing AST annotations; they are **not** resolved or allowed through a final publication gate.
- Line-numbered error diagnostics such as `BM_ID_DUPLICATE`, `BM_HEADER_SEPARATOR`, `BM_FIELD_UNKNOWN`, `BM_SCRIPTURE_RIGHTS`.

### What deliberately does NOT exist

The `ok: true` result means **only that this experimental syntax stage passed**. It does not certify:

- YAML parser validity, data typing or publishing metadata.
- Markdown conversion to Sanity Portable Text, text-formatting fidelity or all Sanity schema requirements.
- Editorial warnings, human review, scoped warning override workflow, or theological approval.
- Sanity API access, importer, draft creation, publishing or duplicate-document detection.
- Protected developer draft preview, on-screen TEST badges or block-label overlays.
- Deterministic Sanity `_key` generation from semantic IDs.

**Never use the alpha `check` result to publish a Challenge, assert license rights, or bypass a Sanity editorial gate.**

## AST and errors (experimental output contract)

The current `json` response is a debugging representation, **not a stable public SDK or Sanity document schema**:

~~~json
{
  "ok": true,
  "mode": "experimental-syntax-only",
  "document": {
    "frontmatter": { "raw": "...", "yamlValidated": false },
    "screens": [
      {
        "type": "SCREEN",
        "id": "encounter",
        "label": "Encounter",
        "heading": "Hello, BerryMark",
        "blocks": [
          { "type": "CB1", "id": "hello-text", "text": "Hello, world!" }
        ]
      }
    ],
    "annotations": []
  },
  "diagnostics": []
}
~~~

Actual output also includes file names, line numbers and checked/un-checked capability lists. On malformed input, it returns diagnostics and a **partial AST for inspection only**. Treat a partial AST as invalid and never import it. The exact AST shape and machine-readable rule codes may evolve as parser implementation continues.

## Validation fixtures and workflow

- [`examples/hello-world.berry.md`](../examples/hello-world.berry.md) is a deliberately obvious **synthetic** test with `BM-TEST-CB3-HELLO` text. It is **not Alexis's teaching**.
- [`examples/invalid-duplicate-ids.berry.md`](../examples/invalid-duplicate-ids.berry.md) is intentionally invalid, ensuring a nonzero CLI exit code.
- [`examples/rejoice-always/rejoice-always.berry.md`](../examples/rejoice-always/rejoice-always.berry.md) is the complete seven-screen **existing Local Prototype reverse-mapping**; its content remains editorially unapproved.
- The 23 automated Node.js tests check positive and negative syntax cases. [GitHub Actions](../.github/workflows/parser-tests.yml) runs them on pushes and pull requests, then checks the Hello World and real seven-screen sample.

**Important test distinction:** Successful syntax parsing of the real manuscript example confirms 7 screens, 16 top-level CB instances, and no errors within the current *limited parser scope*. It does **not** mean the content has been imported into Sanity or displayed with developer TEST banners.

## Next engineering slices

1. **YAML semantic parser and typed metadata validation**, including null publication fields and missing references without fabricated values. Choose and pin a YAML library or explicitly scope a safe accepted subset; do not pretend delimiter detection is YAML parsing.
2. **Portable Text encoder + complete Sanity schema mapping**, with source-fidelity checks and deterministic keys; establish the target shape before write access.
3. **Machine-readable diagnostics and editorial warning review** (unoverridable errors, revision-scoped warning overrides) with representative acceptance fixtures.
4. **Protected, rights-safe draft preview**, not the current published-only CMS query or a browser write token.
5. **Draft-only import** after the read-only pipeline is proven; never publish or overwrite automatically.

## Repository boundary

All work is currently on the BerryMark feature branch. Bibleberry's app, Sanity dataset and deployments were **not modified** by this parser milestone.
