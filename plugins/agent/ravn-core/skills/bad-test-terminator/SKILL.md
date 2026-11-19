---
name: bad-test-terminator
description: Prune tests that prove no behavior, or install or update Oxlint guards and runner settings for flaky or implementation-coupled tests. Guard installation supports Vitest, Jest, Bun, and Node; pruning works with any suite.
license: See LICENSE.txt
---

# Bad test terminator

Keep tests that fail on a regression and only on a regression. Guards reject flaky or implementation-coupled constructs; pruning addresses tests that prove nothing even when every guard passes.

## Choose the path

Read the repo's agent instructions and `git status`. Identify the package, package manager, lint config, and test runner. Use the user's scope: prune only, install or update guards, or both. A cleanup request alone selects prune only. With no scope, ask which path and wait.

- **Prune only:** Follow [Prune the suite](#prune-the-suite), then stop. Works on any runner and linter. Leave dependencies, installed guards, lint and runner settings, repeat scripts, and CI unchanged. For a deleted test, drop only its baseline entries.
- **An existing `bad-test-terminator` or `test-guards` install:** Read [Update an installation](references/update.md) instead of installing anew. Migrate the old name before updating.
- **Vitest, Jest, Bun, or Node, with Oxlint or no linter:** Read [Fresh install](references/install.md). For mixed suites give each runner its own file-pattern override and verify it independently. Run once per package that owns tests.
- **Other runner or ESLint only:** Report which tooling the package uses and which install precondition it lacks.

On a combined request, complete guard installation and settle each finding directly before finishing the prune pass. When the tooling, guard version, or file patterns change, re-run the self-check under the target repo's own config.

## Prune the suite

Read [Pruning](references/prune.md) for the rubric. Classify every test by its dependency and retain only those that prove intended behavior. Settle each candidate by deleting it or asserting the behavior someone relies on. Remove production code that existed only for the deleted tests. Run the suite; report each deletion and its previous dependency, each rewrite and its contract, and the observed test result. Prune-only is complete when `git diff` confirms that guard and runner configuration, dependency pins, and CI stayed untouched, apart from removing baseline entries for deleted tests.

## Fixing a finding

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

For runner commands and exceptions see [Runner setup](references/runners.md). For real time or network that an end-to-end test requires, agree on a narrow file override and record it under Deviations in `UPSTREAM.md`. For tests that pass every guard while proving nothing, read [Bad tests the guards miss](references/why.md#bad-tests-the-guards-miss). For more protections or explanations, read [Optional guards](references/optional-guards.md) or [Why each guard exists](references/why.md).
