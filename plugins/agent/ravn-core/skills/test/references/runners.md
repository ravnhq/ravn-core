# Runner setup

Use these settings at fresh-install step 6 and update step 6. Run `verify.ts <test-directory> --runner=<runner>` with the package’s merged lint configuration. The self-check exercises imports and APIs from that runner; it exits nonzero when a protection is absent or reports allowed code.

Verified with Oxlint 1.93.0, Jest 30.5.2, Bun 1.4.4, Node 24.22.3 and 26.13.1, and Vitest 5.1.0. Check the installed runner’s help when merging options, since runtime capabilities change by version.

## Coverage

All four blocks restrict real clocks, timers, randomness and network, focused and skipped tests, retries, module mocks, spies, snapshots and mock call assertions. The assertion checks recognize inline test callbacks. Review assertions delegated to helper functions when settling findings.

| Runner | Assertions | Runtime protections |
| --- | --- | --- |
| Vitest | Built-in Oxlint Vitest rules | Shuffle, zero retries, focus and empty-run failures, mock/global/environment cleanup |
| Jest | Built-in Oxlint Jest rules | Randomized tests within files, printed seed, empty-run failure, mock cleanup; focus and retries guarded by lint |
| Bun | Bundled assertion rule recognizes `bun:test`, including aliases | Randomization, zero retries, empty-discovery failure; focus guarded by lint, cleanup through hooks |
| Node | Bundled assertion rule recognizes `node:assert`, context assertions and subtests, including CommonJS | Context mocks restore automatically; randomization when the installed version provides it; focus and skips guarded by lint; empty runs succeed |

For Bun and Node the bundled assertion rule catches missing assertions, conditional assertions, snapshots and mock call assertions. Bun also checks incomplete and standalone `expect` calls. It counts assertion calls syntactically; pruning still judges whether an assertion guards behavior.

Effect’s test-service guards apply to Vitest with `@effect/vitest`. A direct dependency on `effect` in a Jest, Bun or Node package keeps the selected runner’s block.

## Vitest

Merge the seven settings from `assets/config/vitest.config.ts` into the existing config. Keep every unrelated setting. A pre-existing retry above zero is a finding to settle.

```bash
node <skill-directory>/scripts/check-vitest.ts
```

Set `test:repeat` to `vitest run --repeats 20` when `vitest run --help` lists `--repeats`. For older versions, use the installed repeat helper with Node and the installed Vitest CLI entry (`node_modules/vitest/vitest.mjs` for a node_modules installation):

```bash
node tools/oxlint/bad-test-terminator/repeat.ts 20 node node_modules/vitest/vitest.mjs run
```

Replay an order failure with `--sequence.seed=<seed>`.

## Jest

Merge `assets/config/jest.config.mjs` into the existing configuration. Keep transforms, environment, test patterns and other settings. In a multi-project config, put `randomize` and `showSeed` at the root and `restoreMocks` and `clearMocks` in every project. Jest’s `passWithNoTests` defaults to false; keep the test command’s empty-run behavior.

```bash
node <skill-directory>/scripts/check-runner.ts jest
```

Pass the test script’s CLI options after `jest`, including `--config <path>` when used. The checker asks the package’s installed Jest for `--showConfig` and checks every resolved project. Use a Jest version that exposes `randomize` and `showSeed`; the checker identifies missing settings.

Restore modified environment variables in `afterEach`, and pair `jest.useFakeTimers()` with `jest.useRealTimers()`. Mock restoration restores spies; it does not restore arbitrary writes to globals or the environment. A shared mutable fake needs its own reset.

Set `test:repeat` to the installed repeat helper and Jest CLI entry:

```bash
node tools/oxlint/bad-test-terminator/repeat.ts 20 node node_modules/jest/bin/jest.js
```

Carry the ordinary test command’s configuration options into the repeat command. Each process gets a fresh randomization seed. Replay with `--seed=<seed>`. Lint enforces `.only`, `.skip` and `jest.retryTimes`; Jest has no equivalent of Vitest’s `allowOnly: false` in this setup.

Sources: [Jest configuration](https://jestjs.io/docs/configuration), [Jest CLI](https://jestjs.io/docs/cli).

## Bun

Set the ordinary test script to `bun test --randomize --retry=0`, retaining its existing test paths and setup options. Check the same options:

```bash
node <skill-directory>/scripts/check-runner.ts bun --randomize --retry=0
```

The checker reads the installed runner’s help and validates the explicit command options. CLI options override bunfig defaults. It rejects suite filters and positive retry counts; the lint self-check catches per-test overrides. Keep `--pass-with-no-tests` out of both test scripts.

In the package’s setup hooks, call `mock.restore()` after each test and restore each global or environment value the tests change. Reset recording fakes between tests. Pair fake timers with the installed Bun version’s timer restoration API; read that version’s docs before using it.

Set `test:repeat` to:

```bash
node tools/oxlint/bad-test-terminator/repeat.ts 20 bun test --randomize --retry=0
```

Carry the ordinary test command’s paths and setup options into this command. Fresh processes expose state-dependent failures; replay order with `--seed=<seed>`. The installed Oxlint Jest rules ignore `bun:test` imports, so the Bun block uses the bundled assertion rule.

Source: [Bun test configuration](https://bun.com/docs/test/configuration).

## Node

Read the installed `node --help`. Keep `node --test` as the test command and add `--test-randomize` when available. Keep file patterns after runner options. Check those options:

```bash
node <skill-directory>/scripts/check-runner.ts node --test-randomize
```

For versions without randomization, omit the option in the test script and checker. The checker reports the coverage gap. On versions with it, replay order with `--test-random-seed=<seed>`. Awaiting sibling subtests sequentially preserves their declaration order even when randomization is enabled.

Prefer context mocks (`t.mock.fn` and `t.mock.timers`), whose lifetime ends with the test. Restore process-wide mocks with `mock.restoreAll()` and reset enabled mock timers in `afterEach`. Restore changed environment variables and other globals explicitly.

Set `test:repeat` to the installed repeat helper and the complete ordinary test command:

```bash
node tools/oxlint/bad-test-terminator/repeat.ts 20 node --test --test-randomize "test/**/*.test.ts"
```

Omit `--test-randomize` on versions that lack it. Node permits an empty run, so inspect the discovered test count when running the real suite and report it. Focus options, unconditional skip options, `.only`, `.skip` and `t.runOnly` are guarded by lint. A platform-dependent `skip` value stays allowed.

Sources: [Node test runner](https://nodejs.org/api/test.html), [Node CLI](https://nodejs.org/api/cli.html).

## Completion

Run the ordinary suite and repeat command, record their exit codes and discovered test counts, and record a shuffle seed where available. Record the checker command, cleanup hooks and coverage gaps under Runner settings in `UPSTREAM.md` (older installs label that field Vitest settings). Run the lint self-check for every runner again after merging a baseline.
