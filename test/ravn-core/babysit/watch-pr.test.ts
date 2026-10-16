import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  changes,
  fingerprint,
  inspect,
  type Options,
  type Run,
  readState,
  seconds,
  stateKey,
  watch,
  writeState,
} from "../../../plugins/agent/ravn-core/skills/babysit/scripts/watch-pr.ts";

type Pr = {
  number?: number;
  state?: string;
  isDraft?: boolean;
  mergeable?: string;
  mergeStateStatus?: string;
  reviewDecision?: string;
  head?: string;
  base?: string;
  checks?: { name: string; bucket: string }[];
  threads?: { resolved: boolean; replies?: number }[];
  changesRequestedBy?: string[];
  queue?: { state: string; position: number } | null;
  autoMerge?: boolean;
  lastRemoval?: { createdAt: string; reason: string } | null;
};

const green = { name: "build", bucket: "pass" };

function ok(stdout: string) {
  return { status: 0, stderr: "", stdout };
}

function fakeGh(...prs: Pr[]): Run {
  const find = (ref: string | undefined) => {
    const pr = prs.find((candidate) => String(candidate.number ?? 1) === ref);
    assert.ok(pr !== undefined, "Unknown PR " + ref);

    return pr;
  };

  return (args) => {
    const numberArg = args.find((arg) => arg.startsWith("number="))?.slice(7);
    const pr = find(args[0] === "pr" ? args[2] : numberArg);
    const number = pr.number ?? 1;

    if (args[0] === "pr" && args[1] === "view")
      return ok(
        JSON.stringify({
          number,
          url: "https://github.com/acme/app/pull/" + number,
          state: pr.state ?? "OPEN",
          isDraft: pr.isDraft ?? false,
          mergeable: pr.mergeable ?? "MERGEABLE",
          mergeStateStatus: pr.mergeStateStatus ?? "CLEAN",
          reviewDecision: pr.reviewDecision ?? "",
          headRefOid: pr.head ?? "a".repeat(40),
          headRefName: "branch-" + number,
          baseRefName: pr.base ?? "main",
        }),
      );

    if (args[0] === "pr" && args[1] === "checks") {
      const checks = pr.checks ?? [green];

      if (checks.length === 0)
        return { status: 1, stdout: "", stderr: "no checks reported" };

      return {
        ...ok(
          JSON.stringify(
            checks.map((check) => ({
              ...check,
              state: check.bucket.toUpperCase(),
              link: "https://ci.example/" + check.name,
            })),
          ),
        ),
        status: checks.some((check) => check.bucket === "pending") ? 8 : 0,
      };
    }

    const query = args.find((arg) => arg.startsWith("query=")) ?? "";

    if (query.includes("isInMergeQueue"))
      return ok(
        JSON.stringify({
          data: {
            repository: {
              pullRequest: {
                isInMergeQueue: (pr.queue ?? null) !== null,
                mergeQueueEntry: pr.queue ?? null,
                autoMergeRequest: pr.autoMerge
                  ? { enabledAt: "2026-10-16T10:00:00Z" }
                  : null,
                timelineItems: {
                  nodes: pr.lastRemoval ? [pr.lastRemoval] : [],
                },
              },
            },
          },
        }),
      );

    const comment = (thread: number, index: number) => ({
      databaseId: 1000 + thread * 10 + index,
      url: "https://github.com/acme/app/pull/1#c" + thread + "-" + index,
      path: "src/a.ts",
      line: 3,
      body: "x".repeat(5000),
      author: { login: index === 0 ? "reviewer" : "author" },
    });

    return ok(
      JSON.stringify({
        data: {
          repository: {
            pullRequest: {
              latestReviews: {
                nodes: (pr.changesRequestedBy ?? []).map((login) => ({
                  state: "CHANGES_REQUESTED",
                  url: "https://github.com/acme/app/pull/1#review-" + login,
                  body: "please change",
                  author: { login },
                })),
              },
              reviewThreads: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: (pr.threads ?? []).map((thread, index) => ({
                  id: "PRRT_" + index,
                  isResolved: thread.resolved,
                  comments: {
                    totalCount: 1 + (thread.replies ?? 0),
                    nodes: Array.from(
                      { length: 1 + (thread.replies ?? 0) },
                      (_, reply) => comment(index, reply),
                    ),
                  },
                })),
              },
            },
          },
        },
      }),
    );
  };
}

const noChecks: string[] = [];

const defaults: Options = {
  allowDraft: false,
  allowNoChecks: false,
  required: noChecks,
  mergeRequested: null,
};

const merging = { ...defaults, mergeRequested: 1 };

function verdictOf(pr: Pr, options = defaults) {
  return inspect(["1"], options, fakeGh(pr));
}

function manualClock() {
  const clock = {
    time: 0,
    sleeps: 0,
    now: () => clock.time,
    sleep: async (ms: number) => {
      clock.sleeps += 1;
      clock.time += ms;
    },
  };

  return clock;
}

test("a clean PR with green checks is ready and exits 0", () => {
  const result = verdictOf({});
  assert.equal(result.verdict, "READY");
  assert.equal(result.exitCode, 0);
  assert.equal(result.frontier, null);
});

test("each blocker class gets its own verdict and exit code", () => {
  const cases: [Pr, string, number][] = [
    [{ mergeable: "CONFLICTING" }, "CONFLICT", 2],
    [{ mergeStateStatus: "DIRTY" }, "CONFLICT", 2],
    [{ mergeStateStatus: "BEHIND" }, "CONFLICT", 2],
    [{ threads: [{ resolved: false }] }, "THREADS", 3],
    [{ checks: [{ name: "t", bucket: "fail" }] }, "FAILING", 4],
    [{ checks: [{ name: "t", bucket: "cancel" }] }, "FAILING", 4],
    [{ checks: [{ name: "t", bucket: "pending" }] }, "WAITING", 5],
    [{ mergeable: "UNKNOWN" }, "WAITING", 5],
    [{ mergeStateStatus: "UNKNOWN" }, "WAITING", 5],
    [{ checks: [] }, "WAITING", 5],
    [{ isDraft: true }, "GATE", 6],
    [{ reviewDecision: "CHANGES_REQUESTED" }, "GATE", 6],
    [{ mergeStateStatus: "BLOCKED", reviewDecision: "APPROVED" }, "GATE", 6],
    [{ mergeStateStatus: "BLOCKED" }, "GATE", 6],
    [{ state: "CLOSED" }, "GATE", 6],
    [{ state: "MERGED" }, "MERGED", 0],
  ];

  for (const [pr, verdict, exitCode] of cases) {
    const result = verdictOf(pr);
    assert.equal(result.verdict, verdict, JSON.stringify(pr));
    assert.equal(result.exitCode, exitCode, JSON.stringify(pr));
  }
});

test("conflicts outrank threads, and threads outrank failing checks", () => {
  const all = {
    mergeable: "CONFLICTING",
    threads: [{ resolved: false }],
    checks: [{ name: "t", bucket: "fail" }],
  };

  assert.equal(verdictOf(all).verdict, "CONFLICT");
  assert.equal(
    verdictOf({ ...all, mergeable: "MERGEABLE" }).verdict,
    "THREADS",
  );
});

test("a PR awaiting a required review is ready and says so", () => {
  const result = verdictOf({
    reviewDecision: "REVIEW_REQUIRED",
    mergeStateStatus: "BLOCKED",
  });

  assert.equal(result.verdict, "READY");
  assert.match(result.stack[0]?.reason ?? "", /review/);
  assert.equal(result.stack[0]?.reviewDecision, "REVIEW_REQUIRED");
});

test("resolved threads and allowed drafts or missing CI do not block", () => {
  assert.equal(verdictOf({ threads: [{ resolved: true }] }).verdict, "READY");

  assert.equal(
    verdictOf({ isDraft: true }, { ...defaults, allowDraft: true }).verdict,
    "READY",
  );

  assert.equal(
    verdictOf({ checks: [] }, { ...defaults, allowNoChecks: true }).verdict,
    "READY",
  );
});

test("a required check that has not reported keeps the PR waiting", () => {
  const options = { ...defaults, required: ["build", "e2e"] };
  const result = verdictOf({}, options);

  assert.equal(result.verdict, "WAITING");
  assert.match(result.reason, /e2e/);

  assert.equal(
    verdictOf({ checks: [green, { name: "e2e", bucket: "pass" }] }, options)
      .verdict,
    "READY",
  );
});

test("the frontier carries whole threads with reply IDs, capped bodies, and change requests", () => {
  const result = verdictOf({
    threads: [{ resolved: false, replies: 2 }, { resolved: true }],
    changesRequestedBy: ["lead"],
  });

  const [thread] = result.frontier?.unresolvedThreads ?? [];
  assert.ok(thread !== undefined);
  assert.equal(result.frontier?.unresolvedThreads.length, 1);
  assert.equal(thread.comments.length, 3);
  assert.equal(thread.replyTo, 1000);
  assert.ok(thread.id.length > 0);
  assert.ok((thread.comments[0]?.body.length ?? 0) < 2200);
  assert.deepEqual(
    result.frontier?.changeRequests.map((r) => r.author),
    ["lead"],
  );

  const failing = verdictOf({
    checks: [green, { name: "lint", bucket: "fail" }],
  });

  assert.deepEqual(
    failing.frontier?.failingChecks.map((check) => check.name),
    ["lint"],
  );
});

test("watch returns the last read at the deadline so the caller can rearm", async () => {
  const clock = manualClock();

  const result = await watch(
    ["1"],
    { ...defaults, intervalMs: 1000, timeoutMs: 5000 },
    fakeGh({ checks: [{ name: "t", bucket: "pending" }] }),
    clock,
  );

  assert.equal(result.verdict, "WAITING");
  assert.equal(result.exitCode, 5);
  assert.ok(clock.time <= 5000);
});

test("watch never sleeps past its deadline", async () => {
  const clock = manualClock();

  await watch(
    ["1"],
    { ...defaults, intervalMs: 4000, timeoutMs: 5000 },
    fakeGh({ checks: [{ name: "t", bucket: "pending" }] }),
    clock,
  );

  assert.equal(clock.time, 5000);
});

test("watch gives up after repeated gh failures with exit 7", async () => {
  let calls = 0;

  const result = await watch(
    ["1"],
    { ...defaults, intervalMs: 1, timeoutMs: 60_000 },
    () => {
      calls += 1;

      return { status: 1, stdout: "", stderr: "HTTP 502" };
    },
    manualClock(),
  );

  assert.equal(result.verdict, "QUERY_ERROR");
  assert.equal(result.exitCode, 7);
  assert.equal(calls, 3);
});

test("a timed-out gh call or a malformed payload is a query error, not a crash", async () => {
  const timedOut = await watch(
    ["1"],
    { ...defaults, intervalMs: 1, timeoutMs: 60_000 },
    () => ({ status: null, stdout: "", stderr: "spawnSync gh ETIMEDOUT" }),
    manualClock(),
  );

  assert.equal(timedOut.verdict, "QUERY_ERROR");

  const malformed = await watch(
    ["1"],
    { ...defaults, intervalMs: 1, timeoutMs: 60_000 },
    () => ok("{}"),
    manualClock(),
  );

  assert.equal(malformed.verdict, "QUERY_ERROR");
});

test("a transient failure is retried and the watch recovers", async () => {
  const run = fakeGh({});
  let failures = 1;

  const result = await watch(
    ["1"],
    { ...defaults, intervalMs: 1, timeoutMs: 60_000 },
    (args) => {
      if (failures > 0) {
        failures -= 1;

        return { status: 1, stdout: "", stderr: "HTTP 502" };
      }

      return run(args);
    },
    manualClock(),
  );

  assert.equal(result.verdict, "READY");
});

test("changes reports every actionable difference on any PR", () => {
  const lower: Pr = { number: 1, checks: [{ name: "build", bucket: "pass" }] };
  const upper: Pr = { number: 2, base: "branch-1" };
  const run = fakeGh(lower, upper);
  const read = () => fingerprint(inspect(["1", "2"], defaults, run));
  const before = read();

  assert.deepEqual(changes(null, before), ["first observation"]);
  assert.deepEqual(changes(before, before), []);

  const edits: [string, () => void][] = [
    [
      "renamed check",
      () => (lower.checks = [{ name: "deploy", bucket: "pass" }]),
    ],
    [
      "pending check",
      () => (upper.checks = [green, { name: "e2e", bucket: "pending" }]),
    ],
    ["review", () => (lower.reviewDecision = "APPROVED")],
    ["head", () => (upper.head = "b".repeat(40))],
    ["upstack thread", () => (upper.threads = [{ resolved: false }])],
    ["thread reply", () => (upper.threads = [{ resolved: false, replies: 1 }])],
    ["change request", () => (lower.changesRequestedBy = ["lead"])],
  ];

  let previous = before;

  for (const [label, edit] of edits) {
    edit();
    const next = read();
    assert.ok(changes(previous, next).length > 0, label);
    previous = next;
  }
});

test("watch can wait for any change instead of a terminal verdict", async () => {
  const pr: Pr = { threads: [{ resolved: false }] };
  const run = fakeGh(pr);
  const seen = fingerprint(inspect(["1"], defaults, run));
  const clock = manualClock();

  const result = await watch(
    ["1"],
    { ...defaults, intervalMs: 1000, timeoutMs: 60_000 },
    run,
    {
      now: clock.now,
      sleep: async (ms) => {
        await clock.sleep(ms);

        if (clock.sleeps === 2) pr.threads = [{ resolved: true }];
      },
    },
    (report) => changes(seen, fingerprint(report)).length > 0,
  );

  // THREADS is terminal, but it was already seen, so polling continues.
  assert.equal(clock.sleeps, 2);
  assert.equal(result.verdict, "READY");
});

test("the frontier is the lowest PR that is neither merged nor ready", () => {
  const run = fakeGh(
    { number: 1, state: "MERGED" },
    { number: 2, base: "main" },
    { number: 3, base: "branch-2", checks: [{ name: "t", bucket: "fail" }] },
    { number: 4, base: "branch-3", mergeable: "CONFLICTING" },
  );

  const result = inspect(["1", "2", "3", "4"], defaults, run);
  assert.equal(result.verdict, "FAILING");
  assert.equal(result.frontier?.number, 3);

  assert.deepEqual(
    result.stack.map((row) => row.verdict),
    ["MERGED", "READY", "FAILING", "CONFLICT"],
  );
});

test("a stack is READY only when every open PR is ready", () => {
  const run = fakeGh(
    { number: 1 },
    { number: 2, base: "branch-1" },
    { number: 3, base: "branch-2", state: "MERGED" },
  );

  const ready = inspect(["1", "2"], defaults, run);
  assert.equal(ready.verdict, "READY");
  assert.equal(ready.frontier, null);
  assert.equal(inspect(["3"], defaults, run).verdict, "MERGED");
});

test("a PR whose base is not the branch below it breaks the stack", () => {
  const run = fakeGh({ number: 1 }, { number: 2, base: "main" });
  const result = inspect(["1", "2"], defaults, run);

  assert.equal(result.verdict, "GATE");
  assert.equal(result.frontier?.number, 2);
  assert.match(result.reason, /branch-1/);
});

test("the state key covers the options, and stale state reads as none", () => {
  const strict = { ...defaults, required: ["build"] };
  assert.notEqual(stateKey(["1"], defaults), stateKey(["1"], strict));
  assert.equal(stateKey(["1"], defaults), stateKey(["#1"], defaults));

  const dir = mkdtempSync(join(tmpdir(), "babysit-state-"));

  try {
    const path = join(dir, "nested", "state.json");
    assert.equal(readState(path), null);

    const seen = fingerprint(verdictOf({}));
    writeState(path, seen);
    assert.deepEqual(readState(path), seen);

    writeFileSync(path, JSON.stringify({ verdict: "READY", prs: [] }));
    assert.equal(readState(path), null);

    writeFileSync(path, "not json");
    assert.equal(readState(path), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("durations are seconds, defaults included", () => {
  assert.equal(seconds(undefined, 30), 30_000);
  assert.equal(seconds("2", 30), 2000);
  assert.throws(() => seconds("0", 30));
  assert.throws(() => seconds("soon", 30));
});

test("a queued or auto-merging PR is a wait after a merge request", () => {
  const queued = verdictOf(
    { queue: { state: "AWAITING_CHECKS", position: 2 } },
    merging,
  );

  assert.equal(queued.verdict, "WAITING");
  assert.match(queued.reason, /position 2/);
  assert.equal(verdictOf({ autoMerge: true }, merging).verdict, "WAITING");
});

test("an old removal event alone never marks a fresh merge request dropped", () => {
  const result = verdictOf(
    { lastRemoval: { createdAt: "2026-01-01T00:00:00Z", reason: "old" } },
    merging,
  );

  assert.equal(result.verdict, "WAITING");
  assert.match(result.reason, /register/);
});

test("a merge request that never registers is dropped after the grace reads", () => {
  const run = fakeGh({});

  assert.equal(
    inspect(["1"], merging, run, { seenPending: false, reads: 1 }).verdict,
    "WAITING",
  );

  const dropped = inspect(["1"], merging, run, {
    seenPending: false,
    reads: 2,
  });

  assert.equal(dropped.verdict, "DROPPED");
  assert.equal(dropped.exitCode, 8);
});

test("an unmergeable queue entry is dropped at once", () => {
  assert.equal(
    verdictOf({ queue: { state: "UNMERGEABLE", position: 1 } }, merging)
      .verdict,
    "DROPPED",
  );
});

test("watch reports a drop on the poll after the PR leaves the queue, with GitHub's reason", async () => {
  const pr: Pr = { queue: { state: "QUEUED", position: 1 } };
  const clock = manualClock();

  const result = await watch(
    ["1"],
    { ...merging, intervalMs: 1000, timeoutMs: 600_000 },
    fakeGh(pr),
    {
      now: clock.now,
      sleep: async (ms) => {
        await clock.sleep(ms);

        if (clock.sleeps === 2) {
          pr.queue = null;
          pr.lastRemoval = {
            createdAt: "2026-10-16T11:00:00Z",
            reason: "Failed checks: test (merge group)",
          };
        }
      },
    },
  );

  assert.equal(result.verdict, "DROPPED");
  assert.equal(clock.sleeps, 2);
  assert.match(result.reason, /merge group/);
});

test("watch follows a queued PR until it merges", async () => {
  const pr: Pr = { queue: { state: "QUEUED", position: 1 } };
  const clock = manualClock();

  const result = await watch(
    ["1"],
    { ...merging, intervalMs: 1000, timeoutMs: 60_000 },
    fakeGh(pr),
    {
      now: clock.now,
      sleep: async (ms) => {
        await clock.sleep(ms);

        if (clock.sleeps === 3) pr.state = "MERGED";
      },
    },
  );

  assert.equal(result.verdict, "MERGED");
  assert.equal(clock.sleeps, 3);
});

test("a merge watch reports the requested PR, not the stack above it", () => {
  const run = fakeGh(
    { number: 1, state: "MERGED" },
    { number: 2, base: "branch-1", checks: [{ name: "t", bucket: "fail" }] },
  );

  const result = inspect(["1", "2"], merging, run);
  assert.equal(result.verdict, "MERGED");
  assert.equal(result.exitCode, 0);
  assert.equal(result.stack[1]?.verdict, "FAILING");
});

test("merge state is read only for the requested PR", () => {
  const seen: string[] = [];
  const run = fakeGh({ number: 1 }, { number: 2, base: "branch-1" });

  inspect(["1", "2"], merging, (args) => {
    if (args.some((arg) => arg.includes("isInMergeQueue")))
      seen.push(args.find((arg) => arg.startsWith("number=")) ?? "");

    return run(args);
  });

  assert.deepEqual(seen, ["number=1"]);
});
