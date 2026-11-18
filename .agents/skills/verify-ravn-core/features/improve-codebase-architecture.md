# Architecture survey

The survey produces an HTML shortlist of grounded refactor candidates and waits for a choice before designing an interface.

## Sub-features

- `architecture.report`: the file exists outside the repo, each card cites real source and shows a before/after seam, and the report names one recommended candidate.
- `architecture.wait`: the reply points to the actual report and asks for a choice. No source edits or implementation follow.

## How to get to it (user POV)

Ask for a shortlist of refactors that deepen the pricing path, not a design for one already chosen interface.

## Driving it with a scratch repo

Use `scripts/scratch.ts authoring <dir>` and the [harness setup](README.md#harness-runs). Invoke `improve-codebase-architecture` through `scripts/collect.ts`. Copy the report to the evidence directory, open it, and check each cited path against the fixture. Confirm the source diff is empty.

## Gotchas

- The scratch browser may be unavailable. Inspect the HTML artifact itself; report either a working open or the exact opener blocker.
