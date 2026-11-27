---
name: test
description: >-
  Mandatory for test work: invoke before investigating failing tests, adding,
  editing, or deleting tests ("get the tests green", "add tests"), pruning
  useless or flaky tests, or installing Oxlint test guards. The spec decides
  whether code or tests change; stop after three failed rounds.
license: See LICENSE.txt
---

# Test

"Behavior, not implementation" is adapted from pstack `principle-test-behavior-not-implementation`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

A test is a claim about the contract: what the code promises its users. Code and tests both answer to the spec.

## Choose the path

- **Writing, editing, or fixing failing tests (default):** apply the contract rules below.
- **Pruning useless tests ("prune tests", "clean up the test suite"):** read [Pruning](references/prune.md) and settle each candidate by deleting it or asserting behavior someone relies on. Leave guard/runner config and CI untouched unless asked.
- **Installing or updating Oxlint test guards (Vitest, Jest, Bun, or Node):** read [Update an installation](references/update.md) if `bad-test-terminator` or `test-guards` is already installed, otherwise read [Fresh install](references/install.md).

## The spec decides

- Find the spec before writing or changing a test (spec file, request, issue, docs, or exposed types/schemas). When unwritten, write down the behavior and edge cases you test against and include them in the report.
- When a test and the spec disagree, the test is a finding: report both lines. Correct the test in the open when the spec is clear; ask when it is not.
- Change or delete an existing test only when the contract changed or the test contradicts the spec. Name each one in the report with its reason, and keep assertions as strong as they were.

## Behavior, not implementation

Judge each test against two imagined edits:

- **Break the behavior** (wrong return value, skipped or duplicated effect): if the test still passes, it proves nothing.
- **Change the internals** (same observable results, restructured internals): if the test fails, it is pinned to implementation.

Keep tests that catch the first edit and survive the second; rewrite or delete the rest. Drive the code through its users' interface with concrete inputs and expected values from the spec.

## Keep the check out of reach

- Settle the tests that judge a change before making it, then hold them fixed.
- When delegating implementation, keep its tests outside the delegate's write scope (see [Build the Lever](../migrate/references/build-the-lever.md)), and read the delegate's test diff before its summary.
- Disclose every test, fixture, spec, and CI change per [Verify](../verify/SKILL.md).

## Bound the loop

Retries, sleeps, skips, special-cased inputs, and loosened assertions are never a fix.

- After **two failed rounds** on one idea, apply [Attack the Premise](../debug/references/attack-the-premise.md).
- After **three failed rounds** on the same failing check, stop and bring in a person with the failing check, what each round tried, evidence, and what would unblock it.
- For a flaky test, control its cause (time, order, randomness, network, concurrency) using [Debug](../debug/SKILL.md).

## Choose a check that is hard to fool

Rank checks strongest to weakest: **1. End to end** through the real surface ([Verify](../verify/SKILL.md)) → **2. Property tests** for invariants → **3. Differential tests** for rewrites/migrations → **4. Example tests** from the spec.

## Fixing guard or flake findings

| Finding | Replace it with |
| --- | --- |
| Wall-clock time or timers | A test-controlled clock, fake timers with a fixed instant, or `it.effect` with `TestClock.adjust` |
| `it.live`, `Effect.run*`, `excludeTestServices` | `it.effect`, returning the effect so it runs on test services |
| Randomness | Fixed values or a generator with a fixed seed |
| Real network | The handler called in process or an injected fake client |
| Retry or `.flakyTest` | Control of what varies: time, order, concurrency, or network |
| `.only`, `.skip` | Fix, delete, or gate on a genuine platform condition |
| Module mocks, spies, call trackers | Exercise the real behavior; inject a recording fake if calls are the contract |
| Snapshot or no assertion | Assert properties behavior requires; delete a test that proves nothing |

For runner commands and exceptions see [Runner setup](references/runners.md). For tests that pass every guard while proving nothing, read [Bad tests the guards miss](references/why.md#bad-tests-the-guards-miss). For more protections, read [Optional guards](references/optional-guards.md) or [Why each guard exists](references/why.md).
