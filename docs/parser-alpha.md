# BerryMark Experimental Parser and Validator (alpha)

**Status:** Read-only executable syntax and metadata validation, not the full v0.1 compiler or Import implementation.  
**Implementation:** [`src/parser.js`](../src/parser.js), [`src/metadata.js`](../src/metadata.js), [`src/scripture.js`](../src/scripture.js), [`src/cli.js`](../src/cli.js)  
**Metadata contract:** [Metadata Validation](metadata-validation.md)  
**Reference grammar:** [Language Specification](language-spec.md), [Content Block Registry](block-registry.md), [Validation and Import](validation.md)

## What exists now

A Node.js 20+ experimental parser with safe YAML 1.2 front-matter parsing, typed metadata validation, structural checks, and a terminal interface:

~~~sh
npm ci
npm test
npm run check
npm run preview
node src/cli.js check examples/rejoice-always/rejoice-always.berry.md
node src/cli.js preview examples/rejoice-always/rejoice-always.berry.md
node src/cli.js json examples/rejoice-always/rejoice-always.berry.md
~~~

**Commands:** `check`, `preview`, and `json` return exit code 0 when there are no blocking errors, 1 for validation errors, and 2 for wrong arguments/read failures. Editorial and informational diagnostics do not fail a working document. Preview remains a structural interpretation, not a renderer or import authorization.

**Implemented checks:**

- Real YAML front-matter parsing with the YAML 1.2 core schema, strict duplicate-key rejection, safe supported types, and original source locations.
- Rejection of malformed YAML, non-mapping roots, unsupported tags, anchors/aliases, and non-finite numbers. No YAML code execution or timestamp coercion.
- Typed validation for the documented Challenge, publishing, Scripture, editorial, and companion-link metadata subset. Unknown recognized-path fields fail rather than disappearing.
- Explicit null versus absent values; unresolved publishing fields and pending approval remain informational/deferred, never silently populated.
- SCREEN, CB1–CB9 and nested marker balance, parent/child relationships and stable ID collisions.
- Context-sensitive fields, exact spelling, required/duplicate fields, two-space `Name: |` multiline plain text, blank-line rich-body title boundaries and backslash-escaped literal marker lines.
- CB4 LEFT/RIGHT/FOOTER, CB5 CARD, CB6 STEP/cycle, CB7 CHOICE and CB8 nested SCRIPTURE structures.
- One shared pure Scripture consistency implementation for front matter, CB2, and nested CB8 SCRIPTURE. A rights Boolean is not external evidence of quotation rights.
- Editorial comments retained as AST annotations and nonblocking `editorial` diagnostics. TODO and REVIEW REQUIRED items do not disappear after structural success.
- Machine-readable diagnostics with severity, rule code, filename, line/column, and metadata path or block target where applicable.

See [metadata-validation.md](metadata-validation.md) for the exact AST contract, required/optional fields, and unresolved design decisions.

## What deliberately does NOT exist

The `ok: true` result means **only that the experimental syntax and supported metadata checks passed**. It does not certify:

- Markdown conversion to Sanity Portable Text, text-formatting fidelity or all Sanity schema requirements.
- External Scripture license evidence or permission to quote a passage.
- Human review, theological approval, scoped warning override workflow, or publication approval.
- Sanity API access, importer, draft creation, publishing, series resolution, or duplicate-document detection.
- Protected developer draft preview, on-screen TEST badges or block-label overlays.
- Deterministic Sanity `_key` generation from semantic IDs.
- A future readiness gate for unresolved publishing values or editorial annotations.

**Never use the experimental `check` result to publish a Challenge, assert license rights, or bypass a Sanity editorial gate.**

## AST and diagnostics (experimental output contract)

The `json` response is a debugging representation, **not a stable public SDK or Sanity document schema**. The parsed typed value is exposed as `document.metadata`, separately from `document.frontmatter.raw` and its source span:

~~~json
{
  "ok": true,
  "mode": "experimental-read-only-validation",
  "document": {
    "frontmatter": { "raw": "...", "yamlValidated": true },
    "metadata": { "berrymark": "0.1", "challenge": { "title": "..." } },
    "screens": [],
    "annotations": []
  },
  "summary": { "errors": 0, "warnings": 0, "editorial": 0, "info": 0 },
  "diagnostics": []
}
~~~

On malformed input, the CLI returns diagnostics and a **partial AST for inspection only**. Treat a partial AST as invalid and never import it. The exact AST shape and machine-readable rule codes may evolve as parser implementation continues.

## Validation fixtures and workflow

- [`examples/hello-world.berry.md`](../examples/hello-world.berry.md) is a deliberately obvious **synthetic** test with complete safe metadata and `BM-TEST-CB3-HELLO` text. It is **not Alexis's teaching**.
- [`examples/invalid-duplicate-ids.berry.md`](../examples/invalid-duplicate-ids.berry.md) is intentionally invalid, ensuring a nonzero CLI exit code.
- [`examples/rejoice-always/rejoice-always.berry.md`](../examples/rejoice-always/rejoice-always.berry.md) is the complete seven-screen **existing Local Prototype reverse-mapping**; its content remains editorially unapproved. Its null publishing fields, reference-only Scripture, pending review, and null companion URLs are intentionally preserved.
- The automated suite retains the original 23 syntax tests and adds 20 focused metadata/CLI regressions. [GitHub Actions](../.github/workflows/parser-tests.yml) installs the lockfile dependencies, runs the tests, and checks both the synthetic Hello World and real seven-screen sample.

**Important test distinction:** Successful validation of the real manuscript example confirms 7 screens, 16 top-level CB instances, and no errors within the current experimental validator scope. It does **not** mean the content has been imported into Sanity, approved, licensed, or displayed with developer TEST banners.

## Next engineering slices

1. **Portable Text encoder + complete Sanity schema mapping**, with source-fidelity checks and deterministic keys; establish the target shape before write access.
2. **Machine-readable advisory warnings and editorial review overrides**, only after their syntax, revision scope, and disposition are approved.
3. **Protected, rights-safe draft preview**, not the current published-only CMS query or a browser write token.
4. **Draft-only import** after the read-only pipeline is proven; never publish or overwrite automatically.

## Repository boundary

All work is currently on the BerryMark feature branch. Bibleberry's app, Sanity dataset and deployments were **not modified** by this parser milestone.
