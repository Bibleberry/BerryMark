# BerryMark

A Markdown-based domain-specific language for structured interactive content.

**Current stage:** BerryMark v0.1 is an editorial language under development. It has a **working experimental, read-only syntax parser**, but not a production compiler or Sanity importer.

## Get started (Node.js 20+)

```bash
npm test
npm run check
npm run preview
node src/cli.js check examples/rejoice-always/rejoice-always.berry.md
```

The parser has no runtime dependencies. Its `check` success only verifies **experimental structure and field syntax**, not YAML metadata meaning, Markdown conversion, Scripture usage rights, editorial approval, or import readiness. **No import or publish command exists yet.**

## Project references

- [Language specification](docs/language-spec.md)
- [Content Block registry](docs/block-registry.md)
- [Validation and import requirements](docs/validation.md)
- [Manuscript editorial workshop](docs/manuscript-workshop.md)
- [Experimental parser and safety boundaries](docs/parser-alpha.md)
- [Kimi Engineering Assignment 01: Read-Only Validation](docs/assignments/kimi-01-validation.md)
- [Rejoice Always working example](examples/rejoice-always/rejoice-always.berry.md)
- [Developer test plan](examples/rejoice-always/test-plan.md)

## Principles

Alexis's teaching determines the screen design. Preserve the original manuscript separately. Editor-approved BerryMark drafts eventually hand off **one way** to a new unpublished Sanity draft; they are never automatically published or reimported. Development diagnostics must be separate from reader-facing content.

BerryMark belongs in its own repository, separate from the Bibleberry app and Sanity schemas. All current implementation is experimental until the full validation and editorial gates are implemented and reviewed.
