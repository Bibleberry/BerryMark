# BerryMark

A Markdown-based domain-specific language for structured interactive content.

**Current stage:** BerryMark v0.1 has a **working experimental, read-only syntax and metadata validator** plus a **pure Sanity JSON compiler** that produces local candidate JSON and a separate review report. It is not a production compiler or Sanity importer.

## Get started (Node.js 20+)

```bash
npm ci
npm test
npm run check
npm run preview
node src/cli.js check examples/rejoice-always/rejoice-always.berry.md
npm run compile
npm run compile:rejoice
```

The validator uses the exactly pinned `yaml` dependency for safe YAML 1.2 parsing. Its `check` success verifies **experimental structure, field syntax, and supported metadata** only. The separate compiler uses the exactly pinned `marked` dependency to convert supported rich text into Sanity Portable Text without changing the parser API or validator commands. Compilation is deterministic and side-effect free; unresolved references, publishing values, rights evidence, approval, and editorial TODO/REVIEW REQUIRED annotations remain visible in the review report. A successful partial candidate is not schema-complete, import-ready, or publication-ready. **No import or publish command exists.**

## Project references

- [Language specification](docs/language-spec.md)
- [Content Block registry](docs/block-registry.md)
- [Validation and import requirements](docs/validation.md)
- [Metadata validation contract and open decisions](docs/metadata-validation.md)
- [Manuscript editorial workshop](docs/manuscript-workshop.md)
- [Experimental parser and safety boundaries](docs/parser-alpha.md)
- [Pure Sanity JSON compiler](docs/sanity-compiler.md)
- [Compiler contract](docs/compiler-contract-v0.1.md)
- [Kimi Engineering Assignment 01: Read-Only Validation](docs/assignments/kimi-01-validation.md)
- [Kimi Engineering Assignment 02: Pure Sanity JSON Compiler](docs/assignments/kimi-02-compiler.md)
- [Synthetic all-block compiler example](examples/compiler-all-blocks.berry.md)
- [Rejoice Always working example](examples/rejoice-always/rejoice-always.berry.md)
- [Developer test plan](examples/rejoice-always/test-plan.md)

## Principles

Alexis's teaching determines the screen design. Preserve the original manuscript separately. Editor-approved BerryMark drafts eventually hand off **one way** to a new unpublished Sanity draft; they are never automatically published or reimported. Development diagnostics must be separate from reader-facing content.

BerryMark belongs in its own repository, separate from the Bibleberry app and Sanity schemas. All current implementation is experimental until the full validation and editorial gates are implemented and reviewed.
