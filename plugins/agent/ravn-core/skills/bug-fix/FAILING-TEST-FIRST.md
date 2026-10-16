# Failing Test First

Adapted from pstack `tdd`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Make the broken behavior executable before you change production code. The goal is one focused check that fails before the fix and passes after it.

## Choose the check

Prefer the narrowest test the repo already uses for this code path: unit, component, integration, or regression. Write a new test only when that path is cheap.

When a test would need broad harness setup, mocks of most collaborators, slow end-to-end infrastructure, production-only state, or large unrelated fixtures, use the closest executable check instead: a targeted script, a repro command, browser automation through the verification skill, a snapshot comparison, or a log assertion.

No new test beats a bad test. A bad test mostly exercises mocks, encodes the current implementation, depends on timing or unrelated global state, or would be deleted right after it proves the fix. Judge it by [Test Behavior, Not Implementation](../principle-prove-it-works/TEST-BEHAVIOR.md).

## Run it red

1. Write the smallest check that would have caught the bug. Derive the expected value from the intended behavior, not from a run of the code.
2. Run it before the fix. Confirm it fails for the bug's reason. If it passes, or fails for another reason, fix the check before you touch production code.
3. After the fix, run it again and confirm it passes.

## Guardrails

- Change a test to match the code only when the expected behavior itself changed, and say why.
- Keep existing assertions as strong as they were.
- For a flaky bug, make the check deterministic where you can, and name the signal it locks down.
- When the bug exposes a class of failures, land the focused check first, then add sibling coverage.

Report the check, its failure before the fix, and its pass after. If you could not show a failure before the fix, say why and name the check you used instead.
