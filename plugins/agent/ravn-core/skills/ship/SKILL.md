---
name: ship
description: Take a change from idea to a ready PR with passing CI, running research, grilling, design, verification, and the pr skill in sequence.
disable-model-invocation: true
metadata:
  proof: subjective
---

# Ship

Take a change from a loose idea to a ready pull request with evidence that it works and passing CI on its latest commit. The clarifying in the first steps matters more than any document they produce.

Run every step in order. Skip a step only when the user says to, or when its condition below does not hold.

When the request is a bug with a known symptom, switch to [Debug](../debug/SKILL.md) and follow it in place of this skill: it owns the repro, the cause, and the red-then-green history.

## Step 1. Shape the idea

If the user brings only an idea or a problem, lay out two or three ways to approach it, with the trade-off of each, and recommend one. Then state in two or three sentences what the change is, who it serves, and the observable condition that means it is done, such as a passing check or a behavior a user can see. Continue once the user confirms the goal.

## Step 2. Gather the facts

Trace the code the change touches until you can explain how it works, and use [Codebase Q&A](../codebase-qa/SKILL.md) when existing behavior looks deliberate or odd. For a library, API, or tool the change builds on, use [Research](../research/SKILL.md). For reading that spans many files or large outputs, read [Guard the Context Window](references/guard-the-context-window.md).

For a bug you find mid-change, run [Debug](../debug/SKILL.md) Steps 1 to 3 before choosing a fix. For a measured performance or eval claim, use [Verify](../verify/SKILL.md) to vet the baseline before planning from it.

## Step 3. Grill the assumptions

Use [Plan](../plan/SKILL.md) (grill mode) on the goal and everything you assumed while gathering facts. This step is the core of the plan. Wait for the user's answers before each next round. Move to Step 4 only when the frontier is empty.

## Step 4. Settle the terms

If the change introduces a domain term, or the user and the code name one thing differently, use [Design — Domain Modeling](../design/references/domain-modeling.md) to settle the term and record any decision worth an ADR.

If the change introduces stateful logic or repeated shape assumptions, use [Model the Domain](../design/MODEL-THE-DOMAIN.md) to choose the representation.

## Step 5. Shape the design

If the change adds a module or reshapes an interface, use [Design](../design/SKILL.md).

Apply its disclosed references when their conditions hold:

- For types or function signatures in a statically typed language, read [Type System Discipline](../design/references/type-system-discipline.md), and in TypeScript also [TypeScript Best Practices](../design/references/typescript.md).
- For validation, error handling, or framework adapters, read [Boundary Discipline](../design/references/boundary-discipline.md) and apply [Debug](../debug/SKILL.md)'s root-cause rules.
- For mutating commands, retries, or concurrent writers of shared state, read [Concurrency and Idempotency](../design/references/concurrency-and-idempotency.md).

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

For multi-step work or stacked delivery, use [Sequence Verifiable Units](SEQUENCE-VERIFIABLE-UNITS.md). Pair each principle's decision with a verification check in Steps.

Show the plan in your reply. Write it to a file only when the user asks, or when the work will span sessions; then put it where the repo keeps its docs and report the path.

## Step 7. Confirm the plan

Ask the user to approve the plan; write code only after they approve.

## Step 8. Create the branch and prepare verification

Create the branch from the plan; never work on the default branch.

Skip the rest of this step if the repo has no user-facing surface, such as a UI, CLI, or service; Step 10 then relies on the repo's own checks.

Find the repo's `verify-<app>` skill with a `features/` map. If absent, follow [verification-skill create](../verification-skill/references/create.md) and commit the proven guide separately on this branch. If present, drive one affected journey; if its recipe has drifted, follow [verification-skill maintain](../verification-skill/references/maintain.md) and commit the correction here. Step 9 consumes a runnable guide and its baseline evidence, or a named blocker; a launch or fixture change invalidates the affected baseline.

## Step 9. Build

Work the steps in order and run each step's verification before starting the next. If the work contradicts a decision from Step 3, stop and ask the user instead of choosing yourself.

If the user steps away while you build, keep a decision trail with [Plan — Decision Log](../plan/references/decision-log.md).

For a replacement with old callers or repeated edits that need a codemod/script lever, use [Migrate](../migrate/SKILL.md). For tests you write, change, or keep, use [Test](../test/SKILL.md).

## Step 10. Prove it works

Use [Verify](../verify/SKILL.md). Drive every user-facing behavior the change adds or alters through the verification skill, and keep the evidence it captures. Run the repo's own checks too.

If the change touches shared code, a data or wire format, or a public interface, use [Review — Blast Radius](../review/references/blast-radius.md) and keep its proof with the evidence.

Run every check paired with a principle's decision in Step 6 and keep the evidence. For a bug, re-run the original reproduction. For retries or interruptions, show that re-execution converges. For shared writes, exercise the ownership or serialization contract. For a measured performance or eval claim, use [Verify](../verify/SKILL.md) before reporting it.

If the repo has a verification skill, update it on this branch: add a `features/` file for each new feature, and correct the files for features the change altered. Re-drive each corrected recipe once.

## Step 11. Check it is ready to push

Show the user the branch, the files changed, how the change differs from the plan, and the checks with their results. Ask whether to push unless they already authorized delivery; push only with that authorization. It covers opening the PR and later CI repair commits and pushes within the approved scope.

## Step 12. Open the PR

Commit with the repo's commit convention, push the branch, and open a draft PR against the base branch from the plan. Write the body with the `pr` skill, and put the evidence from Step 10 under Evidence. Hard guardrails: no push to the default branch, no force-push, no merge.

## Step 13. Deliver green CI

Give [Deliver Green CI](DELIVER-GREEN-CI.md) the draft PR URL and the expected draft and ready checks from the plan. Every push invalidates the prior CI evidence. Finish only with the PR ready and every applicable check passing on the same verified final head. Report the URL, head, check links, and anything still open. If a check is missing or blocked, report incomplete delivery and name what opens it. For a verified PR, point the user to [PR (babysit mode)](../pr/SKILL.md) for later review threads and merging on request.
