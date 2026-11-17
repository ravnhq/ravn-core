---
name: bad-test-terminator
description: Install, update or reconfigure the lint rules and Vitest settings that ban flaky tests (real clocks, timers, randomness, network, retries) and change-detector tests (module mocks, spies, call matchers, snapshots) in a repository that uses Oxlint and Vitest, and prune tests that guard no behavior in any test suite. Use when asked to ban flaky, real-clock or change-detector tests, to make a test suite deterministic, or to prune or clean up tests.
license: See LICENSE.txt
---

# Bad test terminator

A test earns its place by guarding intended behavior: it fails on a regression, and only on a regression. A guard makes a nondeterministic or implementation-coupled test fail before it merges. The lint guards prevent: they reject the construct in the editor and in CI. The Vitest guards detect: shuffled order exposes order dependence, repeats expose intermittence, and `retry: 0` stops a flaky test from passing on a later attempt. The prune rule reaches what no guard can see, because no tool reads a test and reports that it guards nothing: it deletes or rewrites each test anchored to something other than the behavior.

The guards are vendored: the target repository owns the copied plugin, the configuration block and every later change to them.

Verified on Oxlint 1.93.0 with Vitest 3.2.7 and 5.1.0, and @effect/vitest 4.1.3. Oxlint JS plugins are alpha, so after an Oxlint upgrade the self-check in step 5 is the evidence that the guards still bite.

## Choose the path

Read the repository's agent instructions, when it has them, and `git status`. Find the package that owns the tests, its package manager, its lint configuration and its test runner.

- **The request is to prune or clean up tests, with nothing to install:** follow [Prune the suite](#prune-the-suite). It runs on any runner and linter.
- **Tests run on Vitest and the package is linted by Oxlint, or has no linter:** continue with the fresh install.
- **A `bad-test-terminator` or `test-guards` entry in `jsPlugins`, or a `tools/oxlint/bad-test-terminator/` or `tools/oxlint/test-guards/` directory, already exists:** read [Update an installation](references/update.md) and follow it in place of the fresh install. A `test-guards` install predates the rename; update.md migrates it first.
- **Tests run on another runner, or ESLint is the only linter:** stop and report that the bundled block targets Oxlint and Vitest, and name what the repository uses.

In a monorepo, run the procedure once for each package that owns tests.

Complete when the path (fresh install, update, prune or stop), the package directory, the package manager and the lint configuration file (or "none") are named, and pre-existing uncommitted work is identified.

## Prune the suite

Works on any test suite, installed or not. Read [Pruning](references/prune.md) for the rubric with examples, and follow it:

1. **Classify every test** by what it depends on. Keep a test only when it depends on the intended behavior; a test anchored to the past, to nothing, or to the implementation is a candidate, as is a second test guarding a behavior another test already guards.
2. **Settle every candidate:** delete it, or rewrite it against the behavior something relies on. Delete production code that only existed for the tests you removed.
3. **Run the suite and report.** Report each deletion with the dependency it had, and each rewrite with the behavior it now guards. Where the guards are installed, the findings in step 8 of the install take these same routes, and a deletion removes its baseline entry.

Complete when every test left is anchored to intended behavior, and the report names each deletion and rewrite with its reason.

## Fresh install

Run the commands from the package directory. Keep the facts from step 1 for the final report.

1. **Survey the tests.** Record:
   - the directories that hold test files and how the files are named;
   - whether `effect` or `@effect/vitest` is a direct dependency in the package manifest;
   - the file that configures Vitest (`vitest.config.*`, or the `test` key of `vite.config.*`);
   - the CI workflow that runs the tests, and the exact lint and test commands it uses;
   - the result of the repository's lint, typecheck and test commands before any change.

   Complete when each fact is recorded, with "none" where the repository has no such file or command.

2. **Copy the plugin.**

   ```bash
   node <skill-directory>/scripts/install.ts
   ```

   This creates `tools/oxlint/bad-test-terminator/` with both plugins and an `UPSTREAM.md` that records the bundle and a hash of each file. Pass another relative destination as the first argument when the repository keeps lint tooling elsewhere. The `effect/` plugin stays in place, unregistered, in a package without Effect.

   The plugin is vendored tooling: the block in step 4 excludes its directory from linting. When the repository's typecheck covers the directory and reports TS5097 on its `.ts` imports, add the directory to that tsconfig's `exclude`.

   Complete when the plugin's two entry points, the `rules/` and `shared/` directories and `UPSTREAM.md` exist at the destination.

3. **Install matching dependencies.** The plugin imports `@oxlint/plugins`, which is released together with `oxlint` under one version number.
   - **The package depends on `oxlint`:** read the installed version from the lockfile and make sure `@oxlint/plugins` is a development dependency pinned to exactly that version (no range).
   - **The package has no `oxlint`:** query `npm view oxlint version` and add `oxlint` and `@oxlint/plugins` pinned to exactly that version as development dependencies (`--save-exact` on npm and pnpm, `--exact` on Bun and Yarn). Create `.oxlintrc.json` as `{ "categories": { "correctness": "off" } }`, so the new linter enforces the guards alone, and add a `lint` script that runs `oxlint --deny-warnings`.
   - Keep the package manager and every unrelated dependency range as they are.

   Complete when `oxlint` and `@oxlint/plugins` resolve to one identical version.

4. **Merge the lint block.** Use `assets/config/oxlint-bad-test-terminator.effect.json` when the survey found Effect as a direct dependency, and `assets/config/oxlint-bad-test-terminator.json` otherwise. Edit the block's content into `.oxlintrc.json` or `oxlint.config.ts`, keeping the file's formatting:
   - Add its `ignorePatterns` and `jsPlugins` entries to the existing lists, creating a list that is missing.
   - Append its override as the last entry of `overrides`, so it wins over earlier overrides for the same files.
   - Keep all five bundled `files` patterns, so a test added later in a new location is guarded too. Add a pattern for each test location from the survey that the five leave out. Helper modules inside a test directory are test code and stay under the override.
   - When the plugin was copied elsewhere, change the two `specifier` paths and the ignore pattern to match.

   The override's `"plugins": ["vitest"]` adds the Vitest plugin for those files and leaves the base plugin set in force. The block sets every rule it relies on explicitly, switches off five default style rules of that plugin, and replaces its focused and disabled test rules with `bad-test-terminator/no-focused-or-skipped-tests`, which also sees wrapper APIs such as `it.effect.only`. A rule the repository already enables for the same construct stays as it is beside the block's rule.

   Complete when the configuration holds the plugin entries and the override, and in `git diff` on a configuration file that existed before, each removed line returns with a trailing comma as its only change.

5. **Prove the guards bite.**

   ```bash
   node <skill-directory>/scripts/verify.ts <test-directory>
   ```

   `<test-directory>` is one directory from the survey that holds test files, relative to the package directory; it defaults to `test`. The script copies fixtures of banned and allowed test code into `<test-directory>/bad-test-terminator-selfcheck/`, lints them with the repository's own configuration, prints one line per rule and removes them. It adds the Effect fixtures when the package manifest lists Effect, and its first line names the fixtures it checks: confirm that matches the block merged in step 4.

   A `FAIL` line names a rule that stayed silent or reported allowed code: correct the configuration (the `files` patterns, the plugin registration, the plugin path) and run it again. The fixtures and the script stay as bundled.

   Complete when the script exits 0 for the block that was merged.

6. **Set the Vitest guards.** Bring the seven values of `assets/config/vitest.config.ts` into the Vitest configuration from the survey, or copy the file when there is none:

   | Setting | Effect |
   | --- | --- |
   | `sequence.shuffle: true` | Runs files and tests in a random order and prints the seed |
   | `retry: 0` | A test passes on its first attempt or fails |
   | `allowOnly: false` | A committed `.only` fails locally as well as in CI |
   | `passWithNoTests: false` | An empty run fails |
   | `restoreMocks: true`, `unstubGlobals: true`, `unstubEnvs: true` | Mock, global and environment state ends with each test |

   Keep the repository's other settings. A `retry` above 0 that was already configured is a finding for step 8: name the tests that pass only when retried.

   ```bash
   node <skill-directory>/scripts/check-vitest.ts
   ```

   Complete when the script reports all seven settings as resolved by Vitest.

7. **Add the repeat run.** Add a `test:repeat` script to the package manifest:
   - **`vitest run --help` lists `--repeats`:** `vitest run --repeats 20`, which runs every test 20 more times in one process. The summary keeps the usual test count; the longer duration shows the repeats ran.
   - **Otherwise (Vitest 3):** `for run in $(seq 1 20); do vitest run || exit 1; done`, which runs the suite 20 times, each with a new shuffle seed.

   Complete when the script exists and starts the tests through the package manager (`npm run test:repeat`, `bun run test:repeat`).

8. **Run the checks and settle the findings.** Run the repository's lint, typecheck and test commands and `test:repeat`.

   Findings in existing tests are what the install exists to surface. List each one with its rule, file and line, grouped by rule. For a test that fails only on some orders or repeats, record the seed Vitest printed and the test name; `--sequence.seed=<seed>` reproduces it.

   Then bring the lint command back to green by the route the request names:
   - **The user asked for the tests to be cleaned up:** settle each finding — fix it by [Fixing a finding](#fixing-a-finding), or rewrite it against the behavior something relies on, or delete it with its dependency recorded, by the routes in [Prune the suite](#prune-the-suite).
   - **Otherwise:** add a baseline, a second override after the guards override that turns off exactly the reported rules for exactly the reported files:

     ```json
     {
       "files": ["test/retry.test.ts"],
       "plugins": ["vitest"],
       "rules": { "no-restricted-properties": "off", "vitest/no-restricted-matchers": "off", "bad-test-terminator/no-current-date": "off" }
     }
     ```

     Oxlint switches a `vitest/*` rule off only in an override that carries `"plugins": ["vitest"]`, so the baseline always includes it. A rule is switched off whole for a listed file, so every other rule in that file and every other file stay guarded. The baseline is the cleanup list: each fix or deletion removes an entry.

   A test that fails on an order or a repeat stays visible as a failing `test:repeat`; report it as the first cleanup item, and delete it with the seed and the reason recorded when its root cause stays unfound after three fix rounds.

   Complete when all four commands have run, every finding is listed and either settled or in the baseline, lint exits 0, and step 5 still exits 0.

9. **Wire CI.** In the workflow from the survey:
   - Add a step before the test step that runs the `lint` script when step 3 created it.
   - Add a step after the test step that runs `test:repeat`. When the local repeat run took longer than a minute, put that step in a workflow with a `schedule` trigger that repeats the test job's setup steps.

   Complete when the workflow runs lint, the tests and the repeat run, or the report says there is no workflow to extend.

10. **Record and report.** Fill the six empty fields of `UPSTREAM.md`: the block merged, the `files` patterns, where the Vitest settings live, the repeat command and where CI runs it, the baseline entries, and each deviation from the bundled files (an edited rule, a rule switched off for every file, a pattern removed); baseline entries belong in the Baseline field alone. Update the repository's documentation where it lists the lint rules or the checks CI runs.

    Review `git status --short` and `git diff` together, since most of the install is new files. Report the installed path, the dependency and configuration changes, the findings with the route taken for each, and the result of each check before and after.

    Complete when the record matches the files installed and the report covers every command that ran.

## Fixing a finding

| Finding | Replace it with |
| --- | --- |
| Real timer, `Date.now()`, `new Date()`, `performance.now()` | A clock the test controls: `vi.useFakeTimers()` with `vi.setSystemTime(fixedInstant)`, or `it.effect` with `TestClock.adjust` |
| `it.live`, `Effect.run*`, `excludeTestServices` | `it.effect`, returning the effect so it runs on the test services |
| `Math.random()` | Fixed values, or a generator with a fixed seed |
| `fetch`, `FetchHttpClient` | The handler called in process, or an injected fake client |
| `retry`, `it.flakyTest` | Control of the input that varies: time, order, concurrency or network |
| `.only`, `.skip` | The test fixed, deleted, or gated with `skipIf` on a platform condition |
| `vi.mock`, `vi.spyOn`, `toHaveBeenCalled*` | An injected fake that records what it received, and an assertion on that record or on the result |
| A mock standing in for the unit under test | The real unit with its dependencies injected; delete the test when the mock was all it proved |
| Snapshot matcher | Assertions on the properties the behaviour requires |
| Test without an assertion | The assertion that states what the test proves; delete the test when nothing is proved |

An assertion on calls is legitimate when the number or order of calls is the behaviour (a cache, a retry policy, exactly one email). A recording fake expresses it and passes the guards.

A suite that needs real time or a real network by design, such as an end-to-end suite, gets its own override after the guards override that turns off the clock, timer and network rules for its file pattern, agreed with the user and recorded under Deviations in `UPSTREAM.md`.

A test can pass every guard and still prove nothing: one that compares the code's configuration with itself or with a literal copied from it, and one that seeds state production never creates. [Bad tests the guards miss](references/why.md#bad-tests-the-guards-miss) shows both from a real change. Read it before writing or keeping a test for a fix, and when reviewing the tests in step 8.

## More guards

[Optional guards](references/optional-guards.md) covers pinning the test runtime in CI, failing real network use at runtime, mutation testing as the check that tests detect behaviour changes, type-aware rules for unawaited promises, and flaky-test tracking services. Read it when the user asks for more than the core install or when a finding points at one of those causes.

[Why each guard exists](references/why.md) maps every rule to the cause of flakiness or the change-detector marker it stops, with sources. Read it when the user asks why a rule is on.
