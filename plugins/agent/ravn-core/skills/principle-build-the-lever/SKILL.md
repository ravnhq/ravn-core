---
name: principle-build-the-lever
description: >-
  Apply to any non-trivial work, not just bulk work: edits, migrations,
  analyses, checks. Build the tool that does it or proves it (codemod, script,
  generator, or a skill your subagents follow) instead of working by hand.
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Build the Lever

Adapted from pstack `principle-build-the-lever`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

For non-trivial work, build the tool that does or proves it instead of working by hand. A deterministic script turns "trust me" into "run this."

Default to building the lever. Skip it only for one or two obvious edits visible at a glance; the same edit at three or more call sites is never trivial. A one-off still earns a lever when it makes the work checkable.

## Rules

- **Prove the recipe first:** do the first unit by hand, then build the smallest script that reproduces it (never a framework). Verify by rerunning it on that unit and diffing against your hand-done version. Make it safe to rerun.
- **Pick the right lever:** a codemod or script for edits, a generator for repetitive files, a query over a dump (e.g., SQLite) for analysis, a rerunnable check for verification.
- **Prefer a script over fan-out:** if one script can process every unit in a single pass, run it instead of fanning out subagents.
- **When fanning out to subagents:** write the lever as a shared skill (recipe, verification contract, off-limits files) outside their write scope so no subagent can edit the contract.
- **Keep the lever in the repo:** write it into the repository (e.g., `scripts/` at the repo or package root) and leave it there. Place it outside any subtree it migrates so later inventories of the old name do not match the tool itself. A script in `/tmp` or deleted after use is no lever.

## Hand-back

Name the lever in your reply: its path in the tree, the command that ran it, the files it changed, and the result of rerunning it.

You skipped this principle if the diff has no script/codemod/generator/skill, you made repeated hand edits, or the tool lives outside the repo.

Distinct from [Prove It Works](../principle-prove-it-works/SKILL.md), which decides what counts as proof of an output.
