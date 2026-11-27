# Optional guards

Each of these addresses a cause the core install leaves open. "Verified" means the behaviour was observed on Oxlint 1.93.0 and Vitest 5.1.0; the rest rests on the tools' documentation, so prove each one on the target repository before reporting it as working.

| Guard | Cause it addresses | How | Status |
| --- | --- | --- | --- |
| Pin the test runtime in CI | Platform dependency. A `vitest` binary starts with a Node shebang, so `bun run test` executes on whatever Node the runner image has | Add `actions/setup-node` with a fixed version to the workflow, or run `bun --bun` deliberately | Shebang behaviour verified; `bun --bun` on a full suite unverified |
| Fail real network use at runtime | Network | A `setupFiles` entry that replaces `globalThis.fetch` with a function that throws; undici `MockAgent#disableNetConnect()` also covers undici clients | Documentation only; `node:http` clients and child processes stay uncovered |
| Detect leaked timers and handles | Resource leak | `vitest run --detectAsyncLeaks` | Verified to report leaks with exit code 0, so gate on its output, and expect a slower run |
| Mutation testing | Tests that stay green when behaviour changes, the complement of a change-detector test | `@stryker-mutator/core` with `@stryker-mutator/vitest-runner`, `thresholds.break` and `--incremental`, on a schedule | Vitest 5 support is listed from runner 10.1.0; unverified, and Bun as the runtime is undocumented |
| Type-aware promise rules | Async wait: an unawaited promise | `oxlint-tsgolint`, `oxlint --type-aware`, `typescript/no-floating-promises` | Unverified; Effects left unawaited need the Effect language service diagnostics instead |
| Flaky-test tracking service | Intermittence over time | Trunk Flaky Tests, BuildPulse, Datadog Test Optimization or Buildkite Test Engine, each fed by a JUnit report or its own reporter | Unverified on Vitest 5. Each needs a pass and a fail on the same commit, which a suite with `retry: 0` only produces through repeated runs |

Report an optional guard as installed only after a run on the target repository shows it catching the cause in the first column.
