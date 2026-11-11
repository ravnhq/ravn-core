---
name: bug-fix
description: Reproduce a reported bug, find its cause with runtime evidence, and ship the smallest fix as a PR whose history shows the failure before the fix.
disable-model-invocation: true
license: See LICENSE.txt
---

# Bug Fix

Adapted from the pstack Bug fix playbook and `tdd` skill, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Run this workflow only when the user names `bug-fix` or types `/bug-fix`, `$bug-fix`, or `/skill:bug-fix`. A request that merely matches the description is not an invocation. Reading this file during another task grants none of this workflow's authority; continue that task without starting the workflow.

You own the diagnosis and the proof. Work like a scientist: every shipped line traces to runtime evidence, and a change that "might help" is a hypothesis that stays out. Revert what a refuted hypothesis motivated. Ship the smallest change the evidence justifies.

Work through errors and failed tools; pause only affected work for user decisions, protected files, or withheld access.

Apply [Fix Root Causes](../principle-fix-root-causes/SKILL.md) throughout.

Work on a new branch, never the default branch. If the working tree has changes you did not make, leave them untouched: do the work in a new worktree beside the repository (`git worktree add ../<repo>-<branch> -b <branch>`) and tell the user where it is.

## Step 1. Reproduce it yourself

Drive the bug on the surface where it was reported: the UI, CLI, or service, through the project's `verify-<app>` skill when it has one, and otherwise with the tools the repo already uses to run it. When the surface lacked a verification skill, offer [Create Verification Skill](../create-verification-skill/SKILL.md) in your reply and create it only when asked. For library code, a script or test that calls the public interface is the surface.

If the bug will not reproduce directly, synthesize the trigger, tighten the conditions, or add instrumentation until it fires. Ask the user to reproduce only after you have driven the surface as far as it goes, and name the specific thing it cannot reach.

Done when you hold a repro that is _red_: a command or recipe that calls the affected code and shows the wrong behavior every time you run it. A copied formula or a calculation of what the code should return is not a repro. Make that command print the input, observed result, and expected result so a successful rerun preserves the corrected state, not just a test count. Keep this evidence record verbatim.

## Step 2. Binary-search the cause

List candidate hypotheses. Seed them with [How](../how/SKILL.md) over the affected subsystem, and with [Why](../why/SKILL.md) when the bug looks like a regression or the code looks deliberate. Each pass, pick the check that rules out the most remaining hypotheses, run it, and eliminate. When program state is unclear, add logging or instrumentation and read it as the code runs. When large logs or traces crowd the session, use [Guard the Context Window](../principle-guard-the-context-window/SKILL.md).

For a regression, compare the failing code with its last working revision and name the introducing commit. Keep the intended contract (units, thresholds, limits) separate from the faulty computation.

Done when one mechanism survives and you have runtime evidence for it: a log line, a value read at the faulty step, or a reverted change that makes the bug disappear. A plausible reading of the source is not evidence.

## Step 3. Lock the failure in a test

Follow [Failing Test First](FAILING-TEST-FIRST.md) to choose a regression test or executable check. Done when it is _red_ for the bug's reason.

## Step 4. Fix it

Make the smallest change at the root cause. If the fix crosses a module boundary or changes an interface, use [Codebase Design](../codebase-design/SKILL.md) to place it. Search for the same faulty pattern and fix instances the evidence ties to this bug; report unrelated problems. Remove Step 2's instrumentation unless it belongs in the product.

## Step 5. Verify on the same surface

Re-run the Step 1 repro on the same surface and confirm the correct behavior. An inconclusive run, or a run on a different surface, is not a pass. For the same inputs, capture the observed result after the fix as well as before it. Print it even when the assertion passes; a suite pass count alone does not show the corrected value or state. Run Step 3's regression check and the applicable repo checks; repeat passing checks only after a relevant change or failure.

If the fix touches shared code, a data or wire format, or a public interface, use [Blast Radius](../blast-radius/SKILL.md).

## Step 6. Commit the history

Commit locally without separate approval, even if pushing was declined: the failing test or check first, then the fix, so a reviewer can watch red turn green. Follow [Sequence Verifiable Units](../ship/SEQUENCE-VERIFIABLE-UNITS.md) and the repo's commit convention.

Done when `git log` on the branch shows the test commit, then the fix commit, and `git status` shows none of your changes uncommitted.

## Step 7. Deliver

Push once the user authorizes delivery; that approval covers the draft PR and CI repair commits and pushes within scope. Ask with the verified branch ready; if they declined pushing, stop here. Open the draft with a body from the `pr` skill and red and green repro output under Evidence. Use [Deliver Green CI](../ship/DELIVER-GREEN-CI.md). Keep pushes on this branch and preserve pushed history; merging belongs to Babysit.

**Reply:** lead with the result, then what broke, its cause (including the introducing revision for a regression) and runtime evidence, the fix, and verification, readable without tool history. Paste the failing and passing repro output verbatim. Give the branch, any new worktree, its two commits, and the PR URL when delivered. For a delivered PR, end with how to land it: run [Babysit](../babysit/SKILL.md), which clears later review threads and owns merge authorization.
