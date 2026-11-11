# BerryMark — AI Development and Incremental Delivery Protocol

**Status:** Proposed standing development procedure, pending maintainer review and merge  
**Scope:** The BerryMark authoring language, parser, validator, compiler, demonstrations, and related documentation

**Sanity topology (November 11, 2026):** The current datasets are `production` and private `staging`. The online read-only planner intentionally targets `production` and must not be interpreted as write authorization. BerryMark's create-only Challenge-draft apply path requires exact `staging` write and authorization dataset settings plus a separate restricted credential; no live staging write permission is granted by this issue. Production mutation remains prohibited.

## Authority and scope

- Aaron authorizes technical scope, acceptance, branch merges, and releases. Alexis retains approval over theological, editorial, and ministry-facing presentation decisions.
- Read the applicable BerryMark specification, compiler contract, tests, and current source before implementing changes.
- Keep proposed features distinct from approved requirements; do not convert ideas or notes into implicit implementation authorization.
- Preserve authored wording, stable identities, source provenance, review boundaries, and the pure compiler's no-write/no-publish behavior unless an explicit approved assignment changes their contracts.
- Do not infer editorial approval, publication dates, Scripture rights, URLs, or missing teaching content.

## Branches, assignments, and PRs

1. Work from the current accepted base branch identified in the assignment; normally `main`. Create one dedicated feature branch per scoped assignment. Do not push directly to `main`.
2. Prefer **one independently reviewable engineering capability per PR**. Divide larger milestones into dependent, sequential PRs with explicit acceptance criteria rather than combining many layers in a single oversized assignment.
3. **Verify GitHub push access early.** Establish the intended branch before extensive coding; open a draft PR early if useful.
4. **Commit and push coherent recovery checkpoints.** After the first testable implementation slice, run focused tests, commit, and push. Repeat after each substantive stage. Do not defer all GitHub delivery until after the full implementation, demonstration generation, and verification.
5. Use **only the designated branch**. Do not create placeholder, fallback, or duplicate branches when a GitHub API or push tool fails. Stop remote mutations, report the blocker, and identify the last verified remote SHA.
6. If the session is approaching tool or context limits, prefer pushing verified work and documenting outstanding steps rather than beginning additional features.
7. Finish with an unmerged PR targeting the authorized base. Only Aaron authorizes merges, deployment, or release.

## Testing, evidence, and handback

- Run focused tests after each checkpoint; execute the applicable complete regression suite before review and inspect changes to golden demonstration outputs rather than blindly accepting snapshots.
- Preserve deterministic compiler output, source-fingerprint correctness, source-located diagnostics, and separation of reader-facing content from editorial reports.
- Report actual tests executed, pass/fail counts, known lint or dependency findings, untested surfaces, and any scope deviations. Never say a check passed if it was not run.
- Distinguish **implemented locally**, **committed**, **pushed**, and **CI-verified**. Supply the exact intended branch, remote head SHA, PR URL if created, and linked GitHub Actions run. A local working build is not evidence of delivery.
- Keep secrets, private editorial material, and unrelated production data out of repository commits. Do not introduce Sanity dataset writes or publication as an incidental compiler change.
- Leave unfinished work explicitly marked for review. A passing build, an open PR, and an accepted release are different statuses.

## Recovery rule

When interrupted, continue from the last confirmed GitHub checkpoint where possible. Recover unpushed local files without rewriting tested code; if local artifacts are unavailable, report that fact before attempting reconstruction.

**Governing principle:** Keep each change reviewable, each stage recoverable, and each completion claim backed by evidence.
