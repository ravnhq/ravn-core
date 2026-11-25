---
name: principle-test-the-contract
description: >-
  Mandatory for test work: invoke before investigating failing tests or
  adding, editing, or deleting tests. Applies to "get the tests green" and
  "add tests" requests. Read this principle before choosing a fix: the spec
  decides whether code or tests change. Stop after three failed rounds.
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Test the Contract

"Behavior, not implementation" is adapted from pstack `principle-test-behavior-not-implementation`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

A test is a claim about the **contract**: what the code promises its users, as stated in the spec, request, issue, docs, or exposed types/schemas. Code and tests both answer to it.

## The spec decides

- Find the spec before writing or changing a test. If unwritten, state the behavior and edge cases you test against in your report.
- When a test and the spec disagree, treat the test as a finding (cite both lines). If the spec is clear, fix the test openly; if not, ask. Production code keeps matching the spec.
- Edit or delete an existing test only when the contract changed or the test contradicts the spec. Report each change with its reason and keep assertions as strong as before.
- Before finishing, list every departure from the spec and why.

## Behavior, not implementation

**Behavior** is what callers or external systems observe across the interface: return values, error types, readable state, external effects (requests, DB writes, emitted messages), and invariants. **Implementation** is internal: private helpers, call order, intermediate data.

Judge every test against two imagined edits:

- **Break the behavior** (wrong return value, skipped or duplicated effect): if the test still passes, it proves nothing.
- **Change the internals** (same observable result, different structure): if the test fails, it is coupled to implementation.

Keep tests that catch the first and survive the second; rewrite or delete the rest. Drive the public interface with concrete inputs, take expected values from the spec (never from running the code under test), and assert what the contract promises.

## Keep the check out of reach

- Settle the tests that judge a change before making the change, then hold them fixed. Any later test edit is a reported spec decision, never a step toward green.
- When delegating implementation, keep tests outside the delegate's write scope (per [Build the Lever](../principle-build-the-lever/SKILL.md)) and read the delegate's test diff before its summary.
- Work inside repository check protections (base-branch CI, protected test paths, required reviews); report missing protections as findings (see [Agent Readiness](../agent-readiness/SKILL.md)).
- Disclose every test, fixture, spec, and CI change per [Prove It Works](../principle-prove-it-works/SKILL.md).

## Bound the loop

Turn a red test green only through a spec-supported code change or a justified, reported test change. Never use retries, sleeps, skips, special-cased inputs, or loosened assertions.

- A **round** is one change rerun against the same failing check.
- After **two** failed rounds on one premise, apply [Attack the Premise](../principle-attack-the-premise/SKILL.md).
- After **three** failed rounds on the same failing check, **stop and bring in a person**. Report the failing check, what each round tried, the evidence, and what would unblock it.
- For flaky tests, control the nondeterministic cause (time, order, randomness, network, concurrency) per [Fix Root Causes](../principle-fix-root-causes/SKILL.md).

## Choose the strongest check

Rank checks by how hard they are to fool:

1. **End-to-end** through the real surface (`verify-<app>` or [Prove It Works](../principle-prove-it-works/SKILL.md)).
2. **Property** tests for invariants (round-trip, idempotency, ordering, equivalence with a simpler reference).
3. **Differential** tests for rewrites or migrations (old vs. new on the same inputs).
4. **Example** tests with expected values from the spec.

Use the strongest check the repo's test command can run, and add others where risk warrants.

You skipped this principle if a test changed without a reported reason, production code changed to satisfy a spec-contradicting test, a fourth round started on the same failing check, or an expected value came from running the code.

Distinct from [Prove It Works](../principle-prove-it-works/SKILL.md) (verifying a finished output) and [Fix Root Causes](../principle-fix-root-causes/SKILL.md) (debugging a failure).
