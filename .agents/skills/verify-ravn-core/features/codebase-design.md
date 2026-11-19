# Codebase design

The focused design skill proposes a seam from current code, with a check through its proposed public surface. A question about current ownership alone goes to `how`.

## Sub-features

- `design.choice`: the plain-language request for one pricing interface selects `codebase-design`; the current-ownership near miss selects `how`.
- `design.grounded`: cite what checkout and invoice reuse and what callers still own. Give one interface and a check through it without editing source.
- `design.references`: a raw-input variation reads boundary discipline; a type-contract variation reads type discipline. The outcome places parsing at the seam and defines what consumers can assume.

## How to get to it (user POV)

Ask “Should checkout and invoice keep separate interfaces or expose one pricing seam?” Then in separate sessions ask where current ownership lives and how the proposed boundary should handle raw records.

## Driving it with a scratch repo

Use `scripts/scratch.ts authoring <dir>` and the [harness setup](README.md#harness-runs). Use `scripts/collect.ts` for each prompt. Check selection and reference reads in the trace. Verify the proposal against `src/{format,checkout,invoice}.mjs` and confirm the source stayed unchanged.

## Gotchas

- The pricing conversion already has one implementation. A useful proposal says what additional behavior belongs behind the seam; moving the same function alone does not add depth.
