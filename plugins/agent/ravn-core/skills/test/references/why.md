# Why each guard exists

A flaky test "exhibits both a passing and a failing result with the same code" ([Google, 2016](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html)). A change-detector test "breaks in response to any change to the production code, without verifying correct behavior" ([Google, 2015](https://testing.googleblog.com/2015/01/testing-on-toilet-change-detector-tests.html)).

Shares are fix commits per root cause in [Luo et al., FSE 2014](https://mir.cs.illinois.edu/marinov/publications/LuoETAL14FlakyTestsAnalysis.pdf): 161 classified commits in Apache projects, of which 126 tests were flaky from the day they were written.

| Guard | Stops | Cause or marker |
| --- | --- | --- |
| `no-restricted-globals` on timers, `no-restricted-imports` on `node:timers` | Sleeping on the wall clock | Async wait, 45%. "Never use bare sleeps to wait for asynchonous responses" ([Fowler](https://martinfowler.com/articles/nonDeterminism.html)) |
| `no-restricted-properties` on `Date.now`, `performance.now`; `bad-test-terminator/no-current-date` | Reading the wall clock | Time. "Always wrap the system clock, so it can be easily substituted for testing" (Fowler) |
| `it.live`, `TestClock.withLive`, `bad-test-terminator-effect/no-live-test-runtime` | Leaving Effect's TestClock for the live clock | Async wait and time |
| `no-restricted-properties` on `Math.random` | Unrepeatable input | Randomness |
| `no-restricted-globals` on `fetch`, `no-restricted-imports` on `FetchHttpClient` | Reaching a real network | Network; 12.6% of fixes in a [JavaScript study](https://arxiv.org/pdf/2207.01047v1.pdf) |
| `bad-test-terminator/no-test-retries`, `it.flakyTest`, `retry: 0` | A flaky test passing on a later attempt | Retries "do not address the root causes of flaky tests" (Luo et al.) |
| `sequence.shuffle`, `restoreMocks`, `unstubGlobals`, `unstubEnvs` | State carried from one test to the next | Test order dependency, 12% |
| The `test:repeat` run in CI | A failure that shows only sometimes | Concurrency, 20%, and every other intermittent cause |
| `vitest/expect-expect`, `valid-expect`, `no-conditional-expect`, `no-standalone-expect` | A test that can pass without asserting | Tests that verify nothing |
| `bad-test-terminator/no-focused-or-skipped-tests`, `allowOnly: false` | A suite that silently stops running | — |
| `vitest/no-restricted-vi-methods` on `mock`, `doMock`, `spyOn` | Replacing internals | Change detector: stubbing "leaks implementation details of your code into your test" ([Software Engineering at Google, ch. 13](https://abseil.io/resources/swe-book/html/ch13.html)) |
| `vitest/no-restricted-matchers` on `toHaveBeenCalled*` | Asserting how the code got its result | Change detector: "interaction tests check how a system arrived at its result, whereas usually you should care only what the result is" ([ch. 12](https://abseil.io/resources/swe-book/html/ch12.html)) |
| `vitest/no-restricted-matchers` on snapshot matchers | Failing on any change to the output | Disputed as a change detector: the Vitest docs present change detection as the purpose of snapshots. Remove these entries when the repository relies on snapshots deliberately |

No tool reads a test and reports that it is a change detector. The mock, spy and matcher bans are proxies for its markers; mutation testing measures the complementary property, that tests fail when behaviour changes.

## Bad tests the guards miss

Both examples come from one change to pi-superagent (PR #98, 2026-11-17), and both passed every guard above. The change moved the agent from one model provider to another and kept the old provider id registered as an alias, because a compaction that a deploy interrupts resumes from a checkpoint naming the old provider.

### A test that restates configuration

```ts
it("answers a checkpoint's opendesign model through OpenCode Go", () => {
  const { models } = createChatHarnessOptions();
  const catalog = typeof models === "function" ? models() : models;
  const old = catalog.getModel("opendesign", "deepseek-v4.1-flash");
  const current = catalog.getModel("opencode-go", "deepseek-v4.1-flash");
  expect(old).toMatchObject({ provider: "opendesign", baseUrl: current?.baseUrl, api: current?.api });
  expect(current?.baseUrl).toBe("https://opencode.ai/inference/go/openai/v1");
});
```

The alias exists so that an interrupted compaction finishes, and this test never resumes one. It reads the catalog the code under test just built, compares two of its entries, and pins a URL copied from a dependency's generated data. It still passes when the alias cannot answer (wrong key, missing header, wrong API map), and it fails when the dependency updates its URL, with nothing broken.

The markers: the expected value comes from the code under test or is a literal copied out of it, and no input passes through the behaviour the change is about. Test the behaviour instead (seed a compaction checkpoint on the old provider, open the session, assert the summary lands), or, when that costs more than the change is worth, add no test and put the evidence in the pull request. This test was deleted.

The cheapest catch is to break the fix and run the test again before committing it: point the alias at the wrong key or drop its session header, and this test still passes. A test that passes against a broken fix does not test the fix. Watching it fail before the fix is not enough: without the alias the lookup returned nothing, so this test failed first too, for the missing entry rather than the failure the fix is for. Deriving the test from the reported failure scenario, as the reviewer suggested here, forces it through the broken path.

### A fixture production never creates

The first draft of the test for the same change seeded the conversations to migrate as ownerless conversations, the shortest call the API offers. The application deletes ownerless conversations as unreachable when a session opens, so the test failed on `Conversation 7 does not exist` for a reason unrelated to the change, and a passing variant could have proved the migration on state that never occurs. The kept test seeds each conversation the way production creates a worker's: owned by a waiting task of the main conversation. Seed through the path production uses, or a test proves the code on states it never meets.
