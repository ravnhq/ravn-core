---
name: ship
description: Take a change from idea to a ready PR with passing CI, chaining research, grilling, domain-modeling, codebase-design, the verification skills, and pr.
disable-model-invocation: true
metadata:
  proof: subjective
---

# Ship

Take a change from a loose idea to a ready pull request with evidence that it works and passing CI on its latest commit. The clarifying in the first steps matters more than any document they produce: where a request is ambiguous, an agent that builds now builds the wrong thing.

Run every step in order. Skip a step only when the user says to, or when its condition below does not hold. This is the full path on purpose; the user learns which steps a small change can drop.

When the request is a bug with a known symptom, switch to [Bug Fix](../bug-fix/SKILL.md) and follow it in place of this skill: it owns the repro, the cause, and the red-then-green history.

## Step 1. Shape the idea

If the user brings only an idea or a problem, lay out two or three ways to approach it, with the trade-off of each, and recommend one. Then state in two or three sentences what the change is, who it serves, and the observable condition that means it is done, such as a passing check or a behavior a user can see. Ask the user to correct it. Do not continue on a goal the user has not confirmed.

## Step 2. Gather the facts

Read the code the change touches. Use [How](../how/SKILL.md) for how that code works now, and [Why](../why/SKILL.md) when existing behavior looks deliberate or odd. If the change builds on a library, API, or tool, use the `research` skill to read its official docs and examples for this use case. If the reading spans many files or large outputs, use [Guard the Context Window](../principle-guard-the-context-window/SKILL.md).

For a bug you find mid-change, run [Bug Fix](../bug-fix/SKILL.md)'s Steps 1 to 3 before choosing a fix. For a measured performance or eval claim, use [Explain the Number](../principle-explain-the-number/SKILL.md) to vet the baseline before planning from it.

## Step 3. Grill the assumptions

Use the `grilling` skill on the goal and everything you assumed while gathering facts. This step is the core of the plan. Ask each round through the harness's question tool when it has one, as `grilling` describes; otherwise make its questions your final message. Either way, wait for the user's answers before the next round. Move to Step 4 only when the frontier is empty.

## Step 4. Settle the terms

If the change introduces a domain term, or the user and the code name one thing differently, use the `domain-modeling` skill to settle the term and record any decision worth an ADR.

If the change introduces stateful logic or repeated shape assumptions, use `domain-modeling`'s [Model the Domain](../domain-modeling/MODEL-THE-DOMAIN.md) guidance to choose the representation.

## Step 5. Shape the design

If the change adds a module or reshapes an interface, use the `codebase-design` skill to place the seam and keep the module deep.

Apply these principles when their conditions hold:

- For types or function signatures in a statically typed language, use [Type System Discipline](../principle-type-system-discipline/SKILL.md), and in TypeScript also [TypeScript Best Practices](../typescript-best-practices/SKILL.md).
- For validation, error handling, or framework adapters, use [Boundary Discipline](../principle-boundary-discipline/SKILL.md). Validate external inputs at entry points. Inside, a guard is a fix only for a legitimate state, per [Fix Root Causes](../principle-fix-root-causes/SKILL.md); for a state that should never exist, fix what produced it.
- For mutating commands, lifecycle steps, or processing loops amid retries and interruptions, use [Make Operations Idempotent](../principle-make-operations-idempotent/SKILL.md).
- For concurrent actors that might write the same object, use [Separate Before Serializing Shared State](../principle-separate-before-serializing-shared-state/SKILL.md).

For each triggered principle, record the concrete design decision and the check that will prove it in Step 6.

## Step 6. Write the plan

Read the repo's CI workflows and the scripts they call. Identify the checks applicable to this change, their names, triggers, and local commands, including build, migration, security, and architecture gates. Account for conditional jobs and jobs that run only on ready PRs. Include these checks in Steps and Delivery below.

Write a short plan with these sections, dropping any that are empty:

- **Goal**: the confirmed goal and the done condition.
- **Decisions**: what grilling settled, one line each.
- **Out of scope**: what this change will not do.
- **Open questions**: anything still unsettled, with who decides.
- **Steps**: ordered work, each with how you will verify it.
- **Delivery**: the branch name, the base branch the PR targets, and the expected CI check names, separating draft checks from checks triggered by readiness.

For multi-step work or stacked delivery, use [Sequence Verifiable Units](SEQUENCE-VERIFIABLE-UNITS.md). Pair each principle's decision with a verification check in Steps. A citation alone does not satisfy the plan.

Show the plan in your reply. Write it to a file only when the user asks, or when the work will span sessions; then put it where the repo keeps its docs and report the path.

## Step 7. Confirm the plan

Ask the user to approve the plan. Do not write code before they approve.

## Step 8. Create the branch and prepare verification

Create the branch from the plan; never work on the default branch.

Skip the rest of this step if the repo has no user-facing surface, such as a UI, CLI, or service; Step 10 then relies on the repo's own checks.

Find the repo's project-local verification skill, a `verify-<app>` skill with a `features/` map. If none exists, use [Create Verification Skill](../create-verification-skill/SKILL.md) to bootstrap one. Put it where the repo already keeps its project skills, following its conventions. Commit it as its own commit. If one exists, drive a feature the change touches through it once; if its recipe no longer works, use [Maintain Verification Skill](../maintain-verification-skill/SKILL.md) to correct it. In both cases, commit the verification changes on this branch instead of opening a separate PR.

## Step 9. Build

Work the steps in order and run each step's verification before starting the next. If the work contradicts a decision from Step 3, stop and ask the user instead of choosing yourself.

If the user steps away while you build, keep a decision trail with [Show Me Your Work](../show-me-your-work/SKILL.md).

For a new internal API with old callers, use [Migrate Callers Then Delete Legacy APIs](../codebase-design/MIGRATE-CALLERS.md) when no external users need compatibility and the project permits coordinated breaking changes. For tests you write, change, or keep, use [Test Behavior, Not Implementation](../principle-prove-it-works/TEST-BEHAVIOR.md).

## Step 10. Prove it works

Use [Prove It Works](../principle-prove-it-works/SKILL.md). Drive every user-facing behavior the change adds or alters through the verification skill, and keep the evidence it captures. Run the repo's own checks too.

If the change touches shared code, a data or wire format, or a public interface, use [Blast Radius](../blast-radius/SKILL.md) and keep its proof with the evidence.

Run every check paired with a principle's decision in Step 6 and keep the evidence. For a bug, re-run the original reproduction. For retries or interruptions, show that re-execution converges. For shared writes, exercise the ownership or serialization contract. For a measured performance or eval claim, use [Explain the Number](../principle-explain-the-number/SKILL.md) before reporting it.

If the repo has a verification skill, update it on this branch: add a `features/` file for each new feature, and correct the files for features the change altered. Re-drive each corrected recipe once.

## Step 11. Check it is ready to push

Show the user the branch, the files changed, how the change differs from the plan, and the checks with their results. Ask whether to push unless they already authorized delivery. Approval covers opening the PR and subsequent CI repair commits and pushes within the approved scope. Do not push without authorization.

## Step 12. Open the PR

Commit with the repo's commit convention, push the branch, and open a draft PR against the base branch from the plan. Write the body with the `pr` skill, and put the evidence from Step 10 under Evidence. Never push to the default branch, force-push, or merge.

## Step 13. Deliver green CI

Use [Deliver Green CI](DELIVER-GREEN-CI.md) to wait for checks, repair failures, and verify the latest PR commit before marking it ready. Finish only when its applicable CI checks pass. Report the PR URL, verified head commit, local and CI results with evidence links, and anything from the plan left undone. If blocked, report the failing or missing checks and the concrete blocker as incomplete delivery. Otherwise end the report with how to land the PR: the user runs [Babysit](../babysit/SKILL.md) on it, which clears later review threads and merges only when they ask.
