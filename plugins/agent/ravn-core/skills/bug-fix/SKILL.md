---
name: bug-fix
description: Reproduce a reported bug, find its cause with runtime evidence, and ship the smallest fix as a PR whose history shows the failure before the fix.
disable-model-invocation: true
license: See LICENSE.txt
---

# Bug Fix

Adapted from the pstack Bug fix playbook and `tdd` skill, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

You own the diagnosis and the proof. Work like a scientist: every shipped line traces to runtime evidence. A change that "might help" is a hypothesis, and a hypothesis does not ship. When evidence refutes a hypothesis, revert what it motivated. Ship the smallest change the evidence justifies.

Apply [Fix Root Causes](../principle-fix-root-causes/SKILL.md) throughout.

Work on a new branch, never the default branch. If the working tree has changes you did not make, leave them untouched: do the work in a new worktree beside the repository (`git worktree add ../<repo>-<branch> -b <branch>`) and tell the user where it is.

## Step 1. Reproduce it yourself

Drive the bug on the surface where it was reported: the UI, CLI, or service, through the project's `verify-<app>` skill when it has one, and otherwise with the tools the repo already uses to run it. Creating a verification skill is separate work: when the surface lacked one, offer [Create Verification Skill](../create-verification-skill/SKILL.md) in your reply, and do not create it unasked. For library code, a script or test that calls the public interface is the surface.

If the bug will not reproduce directly, synthesize the trigger, tighten the conditions, or add instrumentation until it fires. Ask the user to reproduce only after you have driven the surface as far as it goes, and name the specific thing it cannot reach.

Done when you hold a repro that is _red_: a command or recipe that shows the wrong behavior every time you run it. Keep its output verbatim.

## Step 2. Binary-search the cause

List candidate hypotheses. Seed them with [How](../how/SKILL.md) over the affected subsystem, and with [Why](../why/SKILL.md) when the bug looks like a regression or the code looks deliberate. Each pass, pick the check that rules out the most remaining hypotheses, run it, and eliminate. When program state is unclear, add logging or instrumentation and read it as the code runs. When large logs or traces crowd the session, use [Guard the Context Window](../principle-guard-the-context-window/SKILL.md).

Done when one mechanism survives and you have runtime evidence for it: a log line, a value read at the faulty step, or a reverted change that makes the bug disappear. A plausible reading of the source is not evidence.

## Step 3. Lock the failure in a test

Follow [Failing Test First](FAILING-TEST-FIRST.md). It decides whether the bug gets a regression test or another executable check, and keeps that check honest.

## Step 4. Fix it

Make the smallest change at the root cause. If the fix crosses a module boundary or changes an interface, use the `codebase-design` skill to place it. Grep for the same faulty pattern elsewhere and fix each instance the evidence covers. Remove the instrumentation you added in Step 2 unless it belongs in the product.

## Step 5. Verify on the same surface

Re-run the Step 1 repro on the same surface. It now shows the correct behavior. An inconclusive run, or a run on a different surface, is not a pass; report it as such. Run the regression check from Step 3 and the repo's own checks. A passing unit test shows branch behavior, not that the bug is gone.

If the fix touches shared code, a data or wire format, or a public interface, use [Blast Radius](../blast-radius/SKILL.md).

## Step 6. Commit the history

Always commit, even when the user said not to push: the failing test or check first, then the fix on top, so a reviewer can watch it go red, then green. See [Sequence Verifiable Units](../ship/SEQUENCE-VERIFIABLE-UNITS.md). Use the repo's commit convention.

Done when `git log` on the branch shows the test commit, then the fix commit, and `git status` shows none of your changes uncommitted.

## Step 7. Deliver

Ask the user before pushing unless they already authorized delivery; when they said not to push, stop here. Otherwise push, open a draft PR with a body written by the `pr` skill, and put the red and green repro output under Evidence. Deliver it with [Deliver Green CI](../ship/DELIVER-GREEN-CI.md). Never push to the default branch, force-push, or merge.

**Reply:** what was broken, the root cause and the evidence for it, the fix, and how you verified it. Paste the failing and passing repro output verbatim. Give the branch, its worktree if you made one, and its two commits, and the PR URL when you delivered. For a delivered PR, end with how to land it: the user runs [Babysit](../babysit/SKILL.md) on it, which clears later review threads and merges only when they ask.
