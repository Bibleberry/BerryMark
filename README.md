# BerryMark

A Markdown-based domain-specific language for structured interactive content.

**Current stage:** BerryMark v0.1 is an editorial language under development. It has a **working experimental, read-only syntax and metadata validator**, but not a production compiler or Sanity importer.

## Get started (Node.js 20+)

```bash
npm ci
npm test
npm run check
npm run preview
node src/cli.js check examples/rejoice-always/rejoice-always.berry.md
```

The validator uses the exactly pinned `yaml` dependency for safe YAML 1.2 parsing. Its `check` success verifies **experimental structure, field syntax, and supported metadata**, not Markdown/Portable Text conversion, external Scripture usage-rights evidence, editorial approval, import readiness, or publication readiness. Unresolved publishing values, pending approval, and editorial TODO/REVIEW REQUIRED annotations remain visible. **No import or publish command exists.**

## Project references

- [Language specification](docs/language-spec.md)
- [Content Block registry](docs/block-registry.md)
- [Validation and import requirements](docs/validation.md)
- [Metadata validation contract and open decisions](docs/metadata-validation.md)
- [Manuscript editorial workshop](docs/manuscript-workshop.md)
- [Experimental parser and safety boundaries](docs/parser-alpha.md)
- [Kimi Engineering Assignment 01: Read-Only Validation](docs/assignments/kimi-01-validation.md)
- [Rejoice Always working example](examples/rejoice-always/rejoice-always.berry.md)
- [Developer test plan](examples/rejoice-always/test-plan.md)

## Principles

Alexis's teaching determines the screen design. Preserve the original manuscript separately. Editor-approved BerryMark drafts eventually hand off **one way** to a new unpublished Sanity draft; they are never automatically published or reimported. Development diagnostics must be separate from reader-facing content.

BerryMark belongs in its own repository, separate from the Bibleberry app and Sanity schemas. All current implementation is experimental until the full validation and editorial gates are implemented and reviewed.
