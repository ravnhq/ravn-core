---
name: principle-test-the-contract
description: >-
  Use when writing, changing, or deleting a test, when a test and the spec
  disagree, and before a loop of "make the tests pass". The spec decides: test
  behavior through the interface, keep the check out of reach of the change it
  judges, and stop after three failed rounds.
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Test the Contract

"Behavior, not implementation" is adapted from pstack `principle-test-behavior-not-implementation`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

A test is a claim about the contract: what the code promises its users. The spec states the contract, in a spec file, the request, the issue, the docs, or the types and schemas the code exposes. Code and tests both answer to it.

## The spec decides

- Find the spec before you write or change a test. When the contract is unwritten, write down the behavior and edge cases you test against, and put them in the report.
- When a test and the spec disagree, the test is a finding. Report the spec line and the test line. When the spec is clear, correct the test in the open; when it is not, ask. The production code keeps matching the spec.
- Change or delete an existing test only when the contract changed or the test contradicts the spec. Name each one in the report with its reason, and keep the assertions as strong as they were.
- Before you finish, list every place the change departs from the spec, and why.

## Behavior, not implementation

Behavior is what the code's users (a caller, an end user, another service) can observe through the interface they use: return values, errors, state they can read back, and effects outside the code, such as a request sent, a row written, or a message emitted. Implementation is what they cannot observe: private helpers, internal call order, intermediate data, and which internal collaborator did the work.

Judge each test against two imagined edits:

- **Break the behavior.** Make the code return a wrong value, skip an effect, or do the effect twice. If the test still passes, it proves nothing. The usual causes are an assertion looser than the contract, an expected value computed by the code under test, a restated constant or prompt string that never runs the code that reads it, and an assertion on data that the test built itself.
- **Change the internals.** Keep every observable result the same and restructure the code underneath. If the test now fails, it is pinned to the implementation.

Keep a test that catches the first edit and survives the second; rewrite or delete the rest. Drive the code through its users' interface with a concrete input, take the expected value from the spec, and assert what the contract promises, no less and no more.

The contract decides, not the shape of the assertion. When "an empty cart never charges" is the promise, an assertion that the payment client got no call is behavior; pair it with a case where the charge happens, so the test shows it can see a call. The payload a faked external service receives is behavior, because that service observes it. A call to an internal helper is implementation. An exact error message pins wording no caller reads; the error type callers branch on is the contract. An invariant, such as a key that must exist in two tables or a compile-time type check, is behavior too.

## Keep the check out of reach

A check that the change can edit judges nothing.

- Settle the tests that judge a change before you make it, then hold them fixed. A test edit after that is a spec decision you report, never a step toward green.
- When you delegate the implementation, keep its tests outside the delegate's write scope, as [Build the Lever](../principle-build-the-lever/SKILL.md) keeps its contract, and read the delegate's test diff before its summary.
- Where the repository protects its checks (CI that runs from the base branch, protected test paths, required reviews), work inside that protection. Report a missing one as a finding; [Agent Readiness](../agent-readiness/SKILL.md) audits it.
- Disclose every test, fixture, spec, and CI change by [Prove It Works](../principle-prove-it-works/SKILL.md).

## Bound the loop

A red test is information about the code or about the test. It turns green by a code change the spec supports, or by a test change you name and justify. Retries, sleeps, skips, special-cased inputs, and loosened assertions are never a fix.

- A round is one change rerun against the same failing check.
- After two failed rounds on one idea, apply [Attack the Premise](../principle-attack-the-premise/SKILL.md).
- After three failed rounds on the same failing check, stop and bring in a person. Report the failing check, what each round tried, the evidence, and what would unblock it. Reporting that the task cannot be done as posed is a valid finish.
- For a flaky test, control its cause (time, order, randomness, network, concurrency) by [Fix Root Causes](../principle-fix-root-causes/SKILL.md).

## Choose a check that is hard to fool

Rank checks by how hard they are to pass without the behavior:

1. **End to end** through the real surface, with the project's `verify-<app>` skill or as [Prove It Works](../principle-prove-it-works/SKILL.md) runs the feature. The feature works or it does not.
2. **Property** tests for invariants: round trip, idempotency, ordering, equivalence with a simpler reference. Generated inputs do not share your assumptions about edge cases.
3. **Differential** tests for a rewrite or migration: run the old and new code on the same recorded or generated inputs and compare.
4. **Example** tests whose expected values come from the spec.

Use the strongest one the repository's test command can run, and add the others where the risk is.

You skipped this when a test changed without a reason in the report, when production code changed to satisfy a test the spec contradicts, when a fourth round started on the same failing check, or when an expected value came from a run of the code.

Distinct from [Prove It Works](../principle-prove-it-works/SKILL.md), which checks a finished output, and [Fix Root Causes](../principle-fix-root-causes/SKILL.md), which debugs a failure. This decides what a test claims and who may change it.
