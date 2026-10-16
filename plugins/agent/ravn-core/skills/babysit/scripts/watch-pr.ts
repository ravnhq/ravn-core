import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export type Run = (args: string[]) => {
  status: number | null;
  stdout: string;
  stderr: string;
};

type PullRequest = {
  number: number;
  url: string;
  state: string;
  isDraft: boolean;
  mergeable: string;
  mergeStateStatus: string;
  reviewDecision: string;
  headRefOid: string;
  headRefName: string;
  baseRefName: string;
};

type Check = { name: string; state: string; bucket: string; link: string };

type Comment = { author: string | null; body: string };

type Thread = {
  id: string;
  url: string;
  path: string | null;
  line: number | null;
  // The database ID of the thread's first comment, for the replies endpoint.
  replyTo: number;
  comments: Comment[];
  omittedComments: number;
};

type ChangeRequest = { author: string | null; url: string; body: string };

// Where a requested merge stands; read only for the PR --until-merged names.
export type MergeRequest = {
  // Queued and still mergeable, or set to auto-merge: GitHub still intends to merge it.
  pending: boolean;
  inQueue: boolean;
  queueState: string | null;
  queuePosition: number | null;
  autoMerge: boolean;
  // GitHub's latest removal from the queue or auto-merge, for its reason. It
  // may predate this merge request, so it never decides the verdict.
  lastRemoval: { at: string; reason: string } | null;
};

type Snapshot = {
  pr: PullRequest;
  checks: Check[];
  threads: Thread[];
  changeRequests: ChangeRequest[];
  merge: MergeRequest | null;
};

export type Kind =
  | "READY"
  | "MERGED"
  | "WAITING"
  | "CONFLICT"
  | "THREADS"
  | "FAILING"
  | "GATE"
  | "QUERY_ERROR"
  | "DROPPED";

export const exitCodes: Record<Kind, number> = {
  READY: 0,
  MERGED: 0,
  CONFLICT: 2,
  THREADS: 3,
  FAILING: 4,
  WAITING: 5,
  GATE: 6,
  QUERY_ERROR: 7,
  DROPPED: 8,
};

// What the agent does next, printed with every result, so the step reaches
// the agent at the moment it decides. Mirrors the SKILL.md exit table.
export const nextSteps: Record<Kind, string> = {
  READY: "Step 8: confirm merge-ready.",
  MERGED: "End state: every PR merged. Report.",
  CONFLICT: "Step 5.",
  THREADS: "Step 4.",
  FAILING: "Step 5.",
  WAITING:
    "Not an end state: do not end your turn on it. Run the watcher again with the same arguments, dropping only --status-only, so it waits for the next change.",
  GATE: "Step 4 for requested changes; otherwise Step 10.",
  QUERY_ERROR:
    "Check gh auth status and the network, then run it again; Step 10 if it persists.",
  DROPPED: "Step 9: enqueue once more at the same head, then Step 10.",
};

export type Assessment = { kind: Kind; reason: string };

export type Options = {
  allowDraft: boolean;
  allowNoChecks: boolean;
  // Checks the repository requires; one that has not reported is a wait.
  required: string[];
  // The PR whose merge was requested; the watch follows it until it merges.
  mergeRequested: number | null;
};

// What earlier reads in this watch saw of the requested merge.
export type MergeHistory = { seenPending: boolean; reads: number };

const freshHistory = (): MergeHistory => ({ seenPending: false, reads: 0 });

// Reads GitHub gets to register a merge request before its absence counts.
const registrationReads = 2;

const prFields = [
  "number",
  "url",
  "state",
  "isDraft",
  "mergeable",
  "mergeStateStatus",
  "reviewDecision",
  "headRefOid",
  "headRefName",
  "baseRefName",
];

const reviewQuery = `
query($owner: String!, $repo: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      latestReviews(first: 100) {
        nodes { state url body author { login } }
      }
      reviewThreads(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          comments(first: 50) {
            totalCount
            nodes { databaseId url path line body author { login } }
          }
        }
      }
    }
  }
}`;

const mergeQuery = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      isInMergeQueue
      mergeQueueEntry { state position }
      autoMergeRequest { enabledAt }
      timelineItems(last: 1, itemTypes: [REMOVED_FROM_MERGE_QUEUE_EVENT, AUTO_MERGE_DISABLED_EVENT]) {
        nodes {
          ... on RemovedFromMergeQueueEvent { createdAt reason }
          ... on AutoMergeDisabledEvent { createdAt reason }
        }
      }
    }
  }
}`;

// Caps each comment so a long one cannot flood the agent's context; the
// thread URL holds the full text.
const bodyLimit = 2000;

function clip(body: string): string {
  return body.length <= bodyLimit
    ? body
    : body.slice(0, bodyLimit) +
        " [truncated; read the full comment at its URL]";
}

class QueryError extends Error {}

function gh(run: Run, args: string[]): string {
  const result = run(args);

  if (result.status !== 0)
    throw new QueryError(
      "gh " + args.slice(0, 2).join(" ") + " failed: " + result.stderr.trim(),
    );

  return result.stdout;
}

function readPullRequest(pr: string, run: Run): PullRequest {
  const payload: PullRequest = JSON.parse(
    gh(run, ["pr", "view", pr, "--json", prFields.join(",")]),
  );

  assert.match(payload.url, /^https:\/\/[^/]+\/[^/]+\/[^/]+\/pull\/\d+$/);
  assert.ok(Number.isInteger(payload.number), "Invalid PR number.");

  return payload;
}

function readChecks(pr: string, run: Run): Check[] {
  const result = run(["pr", "checks", pr, "--json", "name,state,bucket,link"]);

  // gh exits 8 while checks are pending, and 1 with this message when none exist.
  if (result.status === 1 && /no checks reported/i.test(result.stderr))
    return [];

  if (result.status !== 0 && result.status !== 8)
    throw new QueryError("gh pr checks failed: " + result.stderr.trim());
  const checks: Check[] = JSON.parse(result.stdout);
  assert.ok(Array.isArray(checks), "Invalid check list.");

  return checks;
}

type ReviewPage = {
  data: {
    repository: {
      pullRequest: {
        latestReviews: {
          nodes: {
            state: string;
            url: string;
            body: string;
            author: { login: string } | null;
          }[];
        };
        reviewThreads: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: {
            id: string;
            isResolved: boolean;
            comments: {
              totalCount: number;
              nodes: {
                databaseId: number;
                url: string;
                path: string | null;
                line: number | null;
                body: string;
                author: { login: string } | null;
              }[];
            };
          }[];
        };
      };
    };
  };
};

function readReviews(pr: PullRequest, run: Run) {
  const [owner = "", repo = ""] = new URL(pr.url).pathname
    .split("/")
    .slice(1, 3);

  const threads: Thread[] = [];
  const changeRequests: ChangeRequest[] = [];
  let after: string | null = null;
  let first = true;

  do {
    const page: ReviewPage = JSON.parse(
      gh(run, [
        "api",
        "graphql",
        "-f",
        "query=" + reviewQuery,
        "-F",
        "owner=" + owner,
        "-F",
        "repo=" + repo,
        "-F",
        "number=" + pr.number,
        ...(after === null ? [] : ["-F", "after=" + after]),
      ]),
    );

    const pull = page.data.repository.pullRequest;

    if (first)
      for (const review of pull.latestReviews.nodes)
        if (review.state === "CHANGES_REQUESTED")
          changeRequests.push({
            author: review.author?.login ?? null,
            url: review.url,
            body: clip(review.body),
          });

    first = false;

    for (const node of pull.reviewThreads.nodes) {
      const [opening] = node.comments.nodes;

      if (node.isResolved || opening === undefined) continue;
      threads.push({
        id: node.id,
        url: opening.url,
        path: opening.path,
        line: opening.line,
        replyTo: opening.databaseId,
        comments: node.comments.nodes.map((comment) => ({
          author: comment.author?.login ?? null,
          body: clip(comment.body),
        })),
        omittedComments: node.comments.totalCount - node.comments.nodes.length,
      });
    }

    after = pull.reviewThreads.pageInfo.hasNextPage
      ? pull.reviewThreads.pageInfo.endCursor
      : null;
  } while (after !== null);

  return { threads, changeRequests };
}

type MergePayload = {
  data: {
    repository: {
      pullRequest: {
        isInMergeQueue: boolean;
        mergeQueueEntry: { state: string; position: number } | null;
        autoMergeRequest: { enabledAt: string } | null;
        timelineItems: {
          nodes: { createdAt?: string; reason?: string | null }[];
        };
      };
    };
  };
};

function readMergeRequest(pr: PullRequest, run: Run): MergeRequest {
  const [owner = "", repo = ""] = new URL(pr.url).pathname
    .split("/")
    .slice(1, 3);

  const payload: MergePayload = JSON.parse(
    gh(run, [
      "api",
      "graphql",
      "-f",
      "query=" + mergeQuery,
      "-F",
      "owner=" + owner,
      "-F",
      "repo=" + repo,
      "-F",
      "number=" + pr.number,
    ]),
  );

  const pull = payload.data.repository.pullRequest;
  const removal = pull.timelineItems.nodes[0];
  const queueState = pull.mergeQueueEntry?.state ?? null;
  const autoMerge = pull.autoMergeRequest !== null;

  return {
    pending: (pull.isInMergeQueue && queueState !== "UNMERGEABLE") || autoMerge,
    inQueue: pull.isInMergeQueue,
    queueState,
    queuePosition: pull.mergeQueueEntry?.position ?? null,
    autoMerge,
    lastRemoval:
      removal?.createdAt === undefined
        ? null
        : {
            at: removal.createdAt,
            reason: removal.reason ?? "no reason given",
          },
  };
}

export function snapshot(pr: string, run: Run, merging = false): Snapshot {
  const facts = readPullRequest(pr, run);

  if (facts.state !== "OPEN")
    return {
      pr: facts,
      checks: [],
      threads: [],
      changeRequests: [],
      merge: null,
    };

  return {
    pr: facts,
    checks: readChecks(pr, run),
    ...readReviews(facts, run),
    merge: merging ? readMergeRequest(facts, run) : null,
  };
}

// Judged on what this watch observed, never on old timeline events alone.
function mergeRequestState(
  merge: MergeRequest,
  history: MergeHistory,
): Assessment {
  if (merge.inQueue && merge.queueState === "UNMERGEABLE")
    return { kind: "DROPPED", reason: "the merge queue marked it unmergeable" };

  if (merge.inQueue)
    return {
      kind: "WAITING",
      reason:
        "in the merge queue at position " +
        merge.queuePosition +
        " (" +
        merge.queueState +
        ")",
    };

  if (merge.autoMerge)
    return { kind: "WAITING", reason: "auto-merge is waiting on requirements" };

  if (!history.seenPending && history.reads < registrationReads)
    return {
      kind: "WAITING",
      reason: "waiting for GitHub to register the merge request",
    };

  const removal =
    merge.lastRemoval === null
      ? ""
      : "; GitHub's latest removal, at " +
        merge.lastRemoval.at +
        ": " +
        merge.lastRemoval.reason;

  return {
    kind: "DROPPED",
    reason:
      (history.seenPending
        ? "left the merge queue or auto-merge without merging"
        : "open, not queued, and no auto-merge: the merge request did not take") +
      removal,
  };
}

const failed = (check: Check) =>
  check.bucket === "fail" || check.bucket === "cancel";

export function assess(
  state: Snapshot,
  options: Options,
  history: MergeHistory = freshHistory(),
): Assessment {
  const { pr, checks, threads, merge } = state;

  if (pr.state === "MERGED") return { kind: "MERGED", reason: "merged" };

  if (pr.state === "CLOSED")
    return { kind: "GATE", reason: "closed without merge" };

  // After a merge request, the queue or auto-merge owns the outcome.
  if (merge !== null) return mergeRequestState(merge, history);

  if (pr.mergeable === "CONFLICTING" || pr.mergeStateStatus === "DIRTY")
    return { kind: "CONFLICT", reason: "merge conflicts with the base branch" };

  if (pr.mergeStateStatus === "BEHIND")
    return {
      kind: "CONFLICT",
      reason: "behind its base, which requires up-to-date branches",
    };

  if (threads.length > 0)
    return {
      kind: "THREADS",
      reason: threads.length + " unresolved review thread(s)",
    };

  const failing = checks.filter(failed);

  if (failing.length > 0)
    return { kind: "FAILING", reason: failing.length + " failing check(s)" };
  const pending = checks.filter((check) => check.bucket === "pending");

  if (pending.length > 0)
    return { kind: "WAITING", reason: pending.length + " pending check(s)" };

  const missing = options.required.filter(
    (name) => !checks.some((check) => check.name === name),
  );

  if (missing.length > 0)
    return {
      kind: "WAITING",
      reason: "required check not reported: " + missing.join(", "),
    };

  if (pr.mergeable === "UNKNOWN" || pr.mergeStateStatus === "UNKNOWN")
    return { kind: "WAITING", reason: "GitHub is computing mergeability" };

  if (checks.length === 0 && !options.allowNoChecks)
    return { kind: "WAITING", reason: "no checks reported yet" };

  if (pr.isDraft && !options.allowDraft)
    return { kind: "GATE", reason: "draft PR" };

  if (pr.reviewDecision === "CHANGES_REQUESTED")
    return { kind: "GATE", reason: "changes requested" };

  // A required review is the human's call, so it does not hold back READY.
  if (pr.reviewDecision === "REVIEW_REQUIRED")
    return { kind: "READY", reason: "merge-ready; awaiting required review" };

  // Nothing above explains the block, so a rule GitHub does not name holds it.
  if (pr.mergeStateStatus === "BLOCKED")
    return {
      kind: "GATE",
      reason:
        "GitHub blocks the merge for a reason it does not report; check the gate list",
    };

  return { kind: "READY", reason: "merge-ready" };
}

// A stack PR's base must be the branch of the open PR below it.
function stackOrder(rows: Snapshot[], index: number): Assessment | null {
  const below = rows[index - 1];
  const row = rows[index];

  if (below === undefined || row === undefined) return null;

  if (below.pr.state !== "OPEN" || row.pr.state !== "OPEN") return null;

  return row.pr.baseRefName === below.pr.headRefName
    ? null
    : {
        kind: "GATE",
        reason:
          "not stacked: its base " +
          row.pr.baseRefName +
          " is not #" +
          below.pr.number +
          "'s branch " +
          below.pr.headRefName,
      };
}

function frontierDetails(state: Snapshot) {
  const { pr, checks, threads, changeRequests } = state;

  return {
    number: pr.number,
    url: pr.url,
    head: pr.headRefOid,
    branch: pr.headRefName,
    base: pr.baseRefName,
    reviewDecision: pr.reviewDecision,
    mergeStateStatus: pr.mergeStateStatus,
    failingChecks: checks.filter(failed),
    pendingChecks: checks.flatMap((check) =>
      check.bucket === "pending" ? [check.name] : [],
    ),
    unresolvedThreads: threads,
    changeRequests,
  };
}

function stackRow(state: Snapshot, verdict: Assessment) {
  const { pr, checks, threads, changeRequests } = state;

  return {
    number: pr.number,
    url: pr.url,
    head: pr.headRefOid,
    branch: pr.headRefName,
    base: pr.baseRefName,
    verdict: verdict.kind,
    reason: verdict.reason,
    reviewDecision: pr.reviewDecision,
    mergeStateStatus: pr.mergeStateStatus,
    checks: checks.map((check) => check.name + ": " + check.bucket),
    unresolvedThreads: threads.map(
      (thread) => thread.url + " (" + thread.comments.length + " comments)",
    ),
    changesRequestedBy: changeRequests.map(
      (request) => request.author ?? "unknown",
    ),
    mergeRequest: state.merge,
  };
}

function report(rows: Snapshot[], options: Options, history: MergeHistory) {
  const assessed = rows.map((row, index) => ({
    row,
    verdict:
      row.merge === null
        ? (stackOrder(rows, index) ?? assess(row, options))
        : assess(row, options, history),
  }));

  // A watch on a requested merge reports that PR alone; the stack rides along.
  const target = assessed.find(
    ({ row }) => row.pr.number === options.mergeRequested,
  );

  if (target !== undefined)
    return {
      verdict: target.verdict.kind,
      exitCode: exitCodes[target.verdict.kind],
      reason: target.verdict.reason,
      frontier: frontierDetails(target.row),
      stack: assessed.map(({ row, verdict }) => stackRow(row, verdict)),
    };

  // The frontier is the lowest PR that is neither merged nor ready: merging
  // is the human's call, so the work moves up past a ready PR.
  const frontier = assessed.find(
    ({ verdict }) => verdict.kind !== "MERGED" && verdict.kind !== "READY",
  );

  assert.ok(assessed.length > 0, "No PRs to watch.");

  const kind: Kind =
    frontier !== undefined
      ? frontier.verdict.kind
      : assessed.some(({ verdict }) => verdict.kind === "READY")
        ? "READY"
        : "MERGED";

  return {
    verdict: kind,
    exitCode: exitCodes[kind],
    reason:
      frontier?.verdict.reason ??
      (kind === "READY" ? "every open PR is merge-ready" : "every PR merged"),
    frontier: frontier === undefined ? null : frontierDetails(frontier.row),
    stack: assessed.map(({ row, verdict }) => stackRow(row, verdict)),
  };
}

export type Report = ReturnType<typeof report>;

export function inspect(
  prs: string[],
  options: Options,
  run: Run,
  history: MergeHistory = freshHistory(),
): Report {
  return report(
    prs.map((pr) => snapshot(pr, run, prNumber(pr) === options.mergeRequested)),
    options,
    history,
  );
}

export type Fingerprint = { verdict: string; facts: string[] };

// Every actionable fact about every PR, so any change shows up.
export function fingerprint(result: Report): Fingerprint {
  return {
    verdict: result.verdict,
    facts: result.stack.flatMap((row) => {
      const tag = "#" + row.number + " ";

      return [
        tag + "verdict " + row.verdict + " (" + row.reason + ")",
        tag + "head " + row.head,
        tag + "base " + row.base,
        tag + "review " + row.reviewDecision,
        tag + "merge state " + row.mergeStateStatus,
        ...row.checks.map((check) => tag + "check " + check),
        ...row.unresolvedThreads.map((thread) => tag + "thread " + thread),
        ...row.changesRequestedBy.map(
          (author) => tag + "changes requested by " + author,
        ),
        ...(row.mergeRequest === null
          ? []
          : [
              tag +
                "merge request " +
                (row.mergeRequest.inQueue
                  ? "queued at " + row.mergeRequest.queuePosition
                  : row.mergeRequest.autoMerge
                    ? "auto-merge"
                    : "not pending"),
            ]),
      ];
    }),
  };
}

// Lists what differs from the last run, so a background or between-steps
// check surfaces only news. An empty list means nothing changed.
export function changes(
  previous: Fingerprint | null,
  next: Fingerprint,
): string[] {
  if (previous === null) return ["first observation"];
  const found: string[] = [];

  if (previous.verdict !== next.verdict)
    found.push("verdict " + previous.verdict + " -> " + next.verdict);

  for (const fact of next.facts)
    if (!previous.facts.includes(fact)) found.push("now: " + fact);

  for (const fact of previous.facts)
    if (!next.facts.includes(fact)) found.push("was: " + fact);

  return found;
}

export type Clock = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};

const maxConsecutiveErrors = 3;

type QueryFailure = {
  verdict: "QUERY_ERROR";
  exitCode: number;
  reason: string;
};

function queryFailure(reason: string): QueryFailure {
  return { verdict: "QUERY_ERROR", exitCode: exitCodes.QUERY_ERROR, reason };
}

// Polls until `settled` or the timeout. A failed read (gh, network, or an
// unexpected payload) is retried; three in a row end the watch.
export async function watch(
  prs: string[],
  options: Options & { intervalMs: number; timeoutMs: number },
  run: Run,
  clock: Clock,
  settled: (result: Report) => boolean = (result) =>
    result.verdict !== "WAITING",
): Promise<Report | QueryFailure> {
  const deadline = clock.now() + options.timeoutMs;
  const history = freshHistory();
  let errors = 0;
  let last: Report | null = null;

  for (;;) {
    try {
      const result = inspect(prs, options, run, history);

      errors = 0;
      last = result;
      history.reads += 1;

      if (
        result.stack.some(
          (row) =>
            row.number === options.mergeRequested && row.mergeRequest?.pending,
        )
      )
        history.seenPending = true;

      if (settled(result)) return result;
    } catch (error) {
      errors += 1;

      if (errors >= maxConsecutiveErrors)
        return queryFailure(
          error instanceof Error ? error.message : String(error),
        );
    }

    const remaining = deadline - clock.now();

    if (remaining <= 0)
      return last ?? queryFailure("timed out before a complete read");

    await clock.sleep(Math.min(options.intervalMs, remaining));
  }
}

const usage =
  "Usage: node watch-pr.ts <PR-url|number>... [--status-only] [--interval <s>] [--timeout <s>] [--since-last] [--until-merged <PR>] [--require <check>]... [--allow-draft] [--allow-no-checks]";

// Accepts a PR number, "#12", or a pull request URL.
function prNumber(ref: string): number {
  const match = ref.match(/^#?(\d+)$/) ?? ref.match(/\/pull\/(\d+)/);

  if (match?.[1] === undefined) throw new Error("Not a PR reference: " + ref);

  return Number(match[1]);
}

// Reads a flag given in seconds, or the fallback in seconds, as milliseconds.
export function seconds(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);

  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error("Expected a positive number of seconds, got " + value);

  return parsed * 1000;
}

const stateVersion = 2;

// State lives in the git dir, so it is per clone and never committed. The key
// covers every input that changes the verdicts.
export function stateKey(prs: string[], options: Options): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        prs: prs.map(prNumber),
        required: [...options.required].sort(),
        allowDraft: options.allowDraft,
        allowNoChecks: options.allowNoChecks,
        mergeRequested: options.mergeRequested,
      }),
    )
    .digest("hex")
    .slice(0, 16);
}

function statePath(key: string): string {
  const gitDir = spawnSync("git", ["rev-parse", "--absolute-git-dir"], {
    encoding: "utf8",
  });

  if (gitDir.status !== 0)
    throw new Error("--since-last must run inside a git repository.");

  return join(gitDir.stdout.trim(), "babysit", key + ".json");
}

// A missing, unreadable, or older state file counts as no previous run.
export function readState(path: string): Fingerprint | null {
  if (!existsSync(path)) return null;

  try {
    const state: { version?: number; fingerprint?: Fingerprint } = JSON.parse(
      readFileSync(path, "utf8"),
    );

    const seen = state.fingerprint;

    if (state.version !== stateVersion || seen === undefined) return null;

    return Object.keys(exitCodes).includes(seen.verdict) &&
      Array.isArray(seen.facts)
      ? seen
      : null;
  } catch {
    return null;
  }
}

export function writeState(path: string, next: Fingerprint) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({ version: stateVersion, fingerprint: next }),
  );
}

async function main() {
  let options: Options & { intervalMs: number; timeoutMs: number };
  let positionals: string[];
  let values: { "status-only": boolean; "since-last": boolean };

  try {
    const parsed = parseArgs({
      allowPositionals: true,
      options: {
        "status-only": { type: "boolean", default: false },
        interval: { type: "string" },
        timeout: { type: "string" },
        "allow-draft": { type: "boolean", default: false },
        "allow-no-checks": { type: "boolean", default: false },
        "since-last": { type: "boolean", default: false },
        require: { type: "string", multiple: true },
        "until-merged": { type: "string" },
      },
    });

    positionals = parsed.positionals;
    values = parsed.values;

    if (positionals.length === 0) throw new Error(usage);
    const watched = positionals.map(prNumber);

    const target =
      parsed.values["until-merged"] === undefined
        ? null
        : prNumber(parsed.values["until-merged"]);

    if (target !== null && !watched.includes(target))
      throw new Error("--until-merged must name one of the watched PRs.");

    options = {
      allowDraft: parsed.values["allow-draft"],
      allowNoChecks: parsed.values["allow-no-checks"],
      required: parsed.values.require ?? [],
      mergeRequested: target,
      intervalMs: seconds(parsed.values.interval, 30),
      timeoutMs: seconds(parsed.values.timeout, 510),
    };
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 64;

    return;
  }

  // Each gh call gets at most the time left, plus a short grace for the last
  // read, so one run stays under every harness's ten-minute shell limit.
  const hardStop = performance.now() + options.timeoutMs + 30_000;

  const run: Run = (args) => {
    const left = Math.floor(Math.min(60_000, hardStop - performance.now()));

    if (left <= 0)
      return { status: null, stdout: "", stderr: "watch time limit reached" };

    const result = spawnSync("gh", args, { encoding: "utf8", timeout: left });

    return result.error === undefined
      ? result
      : { status: null, stdout: "", stderr: result.error.message };
  };

  const path = values["since-last"]
    ? statePath(stateKey(positionals, options))
    : null;

  const previous = path === null ? null : readState(path);

  const settled = values["status-only"]
    ? () => true
    : path === null
      ? undefined
      : (result: Report) => changes(previous, fingerprint(result)).length > 0;

  const result = await watch(
    positionals,
    options,
    run,
    { now: () => performance.now(), sleep: (ms) => sleep(ms) },
    settled,
  );

  const next = nextSteps[result.verdict];

  if (path !== null && "stack" in result) {
    const seen = fingerprint(result);
    writeState(path, seen);
    console.log(
      JSON.stringify(
        { ...result, next, changes: changes(previous, seen) },
        null,
        2,
      ),
    );
  } else console.log(JSON.stringify({ ...result, next }, null, 2));

  process.exitCode = result.exitCode;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
)
  await main();
