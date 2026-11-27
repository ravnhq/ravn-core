---
name: debug
description: >-
  Invoke before debugging an error, crash, wrong output, or flaky failure
  ("debug this", "fix this error", "it broke after..."), before adding a guard,
  retry, or catch around a symptom, or after two failed fixes on one premise.
  Reproduces the bug, traces the root cause with runtime evidence, locks it in
  a failing test, and fixes it.
license: See LICENSE.txt
---

# Debug

Adapted from pstack `bug-fix`, `tdd`, `principle-fix-root-causes`, and `principle-attack-the-premise`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

You own the diagnosis and the proof. Work like a scientist: every shipped line traces to runtime evidence, and a change that "might help" is a hypothesis that stays out. Revert what a refuted hypothesis motivated. Ship the smallest change the evidence justifies.

## Root-cause rules

- **Fix the first wrong step, not the symptom.** Ask whether the state that triggered the symptom is legitimate. If it should never exist, a guard, retry, swallowed error, or clamped value where it broke hides the bug: find what produced the state.
- **When something fails only after a restart**, suspect persisted state first: config files, caches, lock files, serialized state.
- **Fix the pattern, not just the instance.** Grep for every place with the same fault.
- **A workaround that needs a paragraph-long comment means the code is wrong.**
- **When two or more fixes sharing one premise have failed the same gate**, read and apply [Attack the Premise](references/attack-the-premise.md) before writing another fix.

## Workflow

When shipping a standalone bug-fix PR, work on a new branch (never the default branch), or in a new worktree beside the repository if the working tree has unrelated changes.

1. **Reproduce it yourself.** Drive the bug on the surface where it was reported (UI, CLI, service, or public interface). Use the project's `verify-<app>` skill when it has one; if absent, offer [verification-skill](../verification-skill/SKILL.md) in your reply. Done when you hold a _red_ repro that shows the wrong behavior every time, with verbatim output.
2. **Binary-search the cause.** Seed hypotheses with [Codebase Q&A](../codebase-qa/SKILL.md) when the bug looks like a regression or deliberate code. Each pass, run the check that rules out the most hypotheses. Instrument when program state is unclear; for large logs, read [Guard the Context Window](../ship/references/guard-the-context-window.md). Done when one mechanism survives with runtime evidence (a plausible reading of the source is not evidence).
3. **Lock the failure in a test.** Follow [Failing Test First](FAILING-TEST-FIRST.md). Done when the check is _red_ for the bug's reason.
4. **Fix at the root cause.** Make the smallest change at the first wrong step. If the fix crosses a module boundary or changes an interface, use [Design](../design/SKILL.md). Remove temporary instrumentation.
5. **Verify on the same surface.** Rerun the Step 1 repro on the same surface, the regression check from Step 3, and the repo's own checks. If the fix touches shared code, a wire/data format, or a public interface, run [Review — Blast Radius](../review/references/blast-radius.md).
6. **Commit and deliver (when shipping a PR).** Commit the failing test first and the fix on top per [Sequence Verifiable Units](../ship/SEQUENCE-VERIFIABLE-UNITS.md) so a reviewer watches it go red then green. Push and open a draft PR only with the user's authorization, writing the body with [PR](../pr/SKILL.md) and delivering with [Deliver Green CI](../ship/DELIVER-GREEN-CI.md). Never push to the default branch, force-push, or merge.

**Reply:** what was broken, the root cause and runtime evidence, the fix, verbatim failing and passing repro output, and the branch/commits/PR URL when delivered. If the deciding fact took a deep dig to find, propose the cheap, always-on signal that would have surfaced it immediately.
