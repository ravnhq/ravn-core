// Self-contained coding questions for comparing guides on replies written from scratch. Each task
// gives the writer a question and the evidence it may use (tool output it has already seen), and
// gives the judge a key the writer never sees:
//   know   what the reader must learn from the reply with every stretch closed
//   defer  what the reply should still say somewhere, but may keep inside a stretch
//   never  claims the reply must not make or leave the reader believing, open or closed
// The tasks are invented, and differ on purpose: a reply that needs no stretch, a negative answer,
// an unproved fix, an untested environment, a limited scope, a destructive command, a required
// order, several actions, an answer that is mostly code, a diagnosis, a decision and a status.
// The tasks after those ask, in ordinary words, for answers that are lists, where a guide without a
// rule for lists hid the whole list in one stretch; one rewrites a given reply instead. The last ones
// give evidence that supports less than a reader would assume: a check run but not reported, a
// proposal described as working, a release still under observation. Held-out
// tasks are kept out of choosing a guide, so a report can show how the choice does on unseen ones.

export type Task = {
  id: string;
  key: { know: string[]; defer: string[]; never: string[] };
  /** The items a good answer lists, each one visible with a stretch of its own; each item is the words that name it. */
  items?: string[][];
  /** A good answer is short enough to need no stretch. */
  needsNoStretch?: true;
  /** The person's instruction that requires a closing block, which the answer must make its last stretch. */
  closing?: string;
  /** Kept out of choosing a guide. */
  heldOut?: true;
} /** A question, and the evidence the writer may use. */ & (
  | { kind?: "question"; question: string; evidence: string }
  /** A reply written before stretches, for the writer to rewrite with them. */
  | { kind: "rewrite"; reply: string }
);

/** The fields of a task the layout rules read. */
export type Layout = Pick<Task, "items" | "needsNoStretch" | "closing">;

/** `value` when it is a list of strings. */
export const stringsOf = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((s): s is string => typeof s === "string")
    ? value
    : undefined;

/** A task read back from a run's manifest, or an error naming the field that is wrong. */
export function readTask(value: unknown): Task {
  const get = (from: unknown, key: string): unknown =>
    typeof from === "object" && from !== null
      ? Reflect.get(from, key)
      : undefined;
  const strings = stringsOf;
  const [id, kind, question, evidence, reply, key] = [
    "id",
    "kind",
    "question",
    "evidence",
    "reply",
    "key",
  ].map((name) => get(value, name));
  const know = strings(get(key, "know")),
    defer = strings(get(key, "defer")),
    never = strings(get(key, "never"));
  const [items, needsNoStretch, closing, heldOut] = [
    "items",
    "needsNoStretch",
    "closing",
    "heldOut",
  ].map((name) => get(value, name));
  const itemList = Array.isArray(items) ? items.map(strings) : undefined;
  if (
    typeof id !== "string" ||
    know === undefined ||
    defer === undefined ||
    never === undefined
  )
    throw new Error(`task ${JSON.stringify(id)} has no id or key`);
  if (
    (items !== undefined &&
      (itemList === undefined ||
        itemList.some((item) => item === undefined))) ||
    (needsNoStretch !== undefined && needsNoStretch !== true) ||
    (closing !== undefined && typeof closing !== "string") ||
    (heldOut !== undefined && heldOut !== true)
  ) {
    throw new Error(
      `task ${id} has a malformed items, needsNoStretch, closing or heldOut`,
    );
  }
  const common = {
    id,
    key: { know, defer, never },
    ...(itemList !== undefined && {
      items: itemList.flatMap((item) => (item === undefined ? [] : [item])),
    }),
    ...(needsNoStretch === true && { needsNoStretch: true as const }),
    ...(typeof closing === "string" && { closing }),
    ...(heldOut === true && { heldOut: true as const }),
  };
  if (kind === "rewrite" && typeof reply === "string")
    return { ...common, kind, reply };
  if (
    (kind === undefined || kind === "question") &&
    typeof question === "string" &&
    typeof evidence === "string"
  ) {
    return {
      ...common,
      ...(kind === "question" && { kind }),
      question,
      evidence,
    };
  }
  throw new Error(
    `task ${id} is neither a question with evidence nor a reply to rewrite`,
  );
}

const KEYBOARD_EVIDENCE =
  "Treat this supplied capability report as given. Client elements inside a reply accept keyboard events only after a mouse click gives focus; Escape returns focus. A toolbar above the prompt is reachable with Ctrl+X Tab and supports one-letter or digit buttons; Escape returns to typing. A custom keybinding can invoke an existing engine action only when the engine is not handling that action itself, making it fragile. Slash commands such as /stretch open 2 are keyboard-only but require typing a command for each operation.";
const KEYBOARD_ITEMS = [
  ["client", "click", "in-reply"],
  ["band", "toolbar"],
  ["keybinding"],
  ["slash"],
];
const KEYBOARD_POINTS = [
  "Client needs an initial mouse click.",
  "Toolbar is reachable without a mouse.",
  "Custom keybindings can conflict with engine actions.",
  "Slash commands are keyboard-only but slow.",
];

export const TASKS: Task[] = [
  {
    id: "brief",
    needsNoStretch: true,
    question: "Which git command shows the last five commits, one line each?",
    evidence: "$ git --version\ngit version 2.50.1",
    key: {
      know: [
        "`git log --oneline -5` (or `-n 5`) shows the last five commits, one per line.",
      ],
      defer: [],
      never: [],
    },
  },
  {
    id: "negation",
    question: "I changed parseDate in src/date.ts. Do the tests pass now?",
    evidence: `$ npm test
 ✓ src/date.test.ts > parseDate > accepts plain dates
 ✓ src/date.test.ts > parseDate > accepts times with offsets
 ✗ src/date.test.ts > parseDate > accepts ISO week dates
   AssertionError: expected Invalid Date to equal 2026-01-07T00:00:00.000Z
   ❯ src/date.test.ts:41:32
       expect(parseDate('2026-W02-3')).toEqual(new Date('2026-01-07'))

 Test Files  1 failed | 11 passed (12)
      Tests  1 failed | 46 passed (47)`,
    key: {
      know: [
        "No: one test fails.",
        'The failing test is "accepts ISO week dates": an ISO week date such as 2026-W02-3 now parses as Invalid Date.',
      ],
      defer: [
        "The other 46 tests pass.",
        "The test expected 2026-W02-3 to parse to 2026-01-07.",
      ],
      never: [
        "All the tests pass.",
        "The failure is unrelated to the parseDate change.",
      ],
    },
  },
  {
    id: "unproved",
    question: "Did my change fix the flaky upload test?",
    evidence: `The change, in src/upload.ts: the handler now awaits the write stream's "finish" event before
reading the file back. Before, it read the file as soon as write() returned.

$ for i in $(seq 200); do npx vitest run upload.test.ts >/dev/null 2>&1 || echo fail; done | wc -l
       0
The same loop on the commit before the change printed 3.

CI history for upload.test.ts on main: 4 failures in the last 120 runs, all "file is empty".
The CI pipeline for this change is queued and has not started.`,
    key: {
      know: [
        "Probably, but it is not confirmed yet.",
        "It has not run in CI, where the test failed about 1 run in 30, so one passing CI run would prove little.",
      ],
      defer: [
        "Locally, 0 of 200 runs failed after the change, against 3 of 200 before.",
        "The cause the change addresses: the file was read back before the write stream finished.",
      ],
      never: ["The flaky test is fixed.", "The change passes in CI."],
    },
  },
  {
    id: "untested-env",
    question: "Is migration 0042 ready to deploy?",
    evidence: `migrations/0042_event_source.sql:
  ALTER TABLE events ADD COLUMN source text NOT NULL DEFAULT 'web';
  CREATE INDEX events_source_idx ON events (source);

$ npm run test:db      (runs every migration on an in-memory SQLite database)
  migrations 0001-0042 applied; 18 tests passed

Production: PostgreSQL 16. The events table holds about 40 million rows and takes writes all day.
The migration runner wraps each file in one transaction. Nobody has run 0042 on PostgreSQL.`,
    key: {
      know: [
        "Not yet: it has only been tested on SQLite, never on PostgreSQL.",
        "CREATE INDEX without CONCURRENTLY on the 40-million-row events table blocks writes to it while the index builds.",
      ],
      defer: [
        "On PostgreSQL 11 and later, adding a column with a constant default is fast.",
        "The index can be built with CREATE INDEX CONCURRENTLY, which cannot run inside the runner's transaction, so it needs its own migration outside one.",
      ],
      never: [
        "The migration is ready to deploy.",
        "The migration was tested on PostgreSQL.",
      ],
    },
  },
  {
    id: "scope",
    question: "Can I run scripts/reset-db.sh to get a clean database?",
    evidence: `scripts/reset-db.sh:
  #!/bin/sh
  set -e
  . ./.env
  psql "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
  npm run migrate && npm run seed

$ grep DATABASE_URL .env
DATABASE_URL=postgres://app@db.staging.internal:5432/app

docs/environments.md: "db.staging.internal is the shared staging database. QA runs its test plans
against it; ask in #qa before changing its data."`,
    key: {
      know: [
        "Not as things are: .env points at db.staging.internal, the shared staging database, so the script would wipe it.",
        "Point DATABASE_URL at a local database first; against a local database it is safe.",
      ],
      defer: [
        "What the script does: drops every table in the public schema, then migrates and seeds.",
      ],
      never: [
        "It is safe to run the script now.",
        "The script only touches a local database.",
      ],
    },
  },
  {
    id: "destructive",
    question: "How do I get rid of the old worktree at ../app-payments?",
    evidence: `$ git worktree list
/Users/me/app            4f2c1d0 [main]
/Users/me/app-payments   9b7e3a1 [feat/payments]

$ git -C ../app-payments status --short
 M src/charge.ts
?? src/refund.ts

$ git branch --merged main
* main

$ git log -1 --format=%cr feat/payments
3 weeks ago`,
    key: {
      know: [
        "It holds uncommitted work, a modified src/charge.ts and an untracked src/refund.ts, which removing it would lose.",
        "Commit or copy that work first, then run `git worktree remove ../app-payments`.",
        "Adding --force would delete those changes.",
      ],
      defer: [
        "The branch feat/payments is not merged into main, and removing the worktree keeps the branch.",
      ],
      never: [
        "The worktree is clean.",
        "Removing the worktree with --force loses nothing.",
      ],
    },
  },
  {
    id: "order",
    question: "How do I upgrade from queuelib 2 to queuelib 3?",
    evidence: `queuelib CHANGELOG, 3.0.0:
  Breaking: the job payload format changed. queuelib 3 workers cannot read jobs enqueued in the
  2.x format; such jobs fail with PayloadVersionError. Run \`queuelib migrate-payloads\` while no
  2.x worker is running and nothing enqueues, then start 3.x workers. The 3.x client enqueues in
  the new format.

Our setup: four workers on queuelib 2.9, started by deploy/workers.yml. The web app enqueues jobs
all day through the queuelib client, also 2.9.`,
    key: {
      know: [
        "The order matters: stop all 2.x workers and pause enqueueing, run `queuelib migrate-payloads`, then start 3.x workers.",
        "A 3.x worker cannot read jobs in the 2.x format, so a rolling upgrade would fail those jobs.",
        "Upgrade the web app's client to 3.x in the same window, or it keeps enqueueing 2.x jobs.",
      ],
      defer: ["Jobs in the old format fail with PayloadVersionError."],
      never: [
        "The workers can be upgraded one at a time while the others keep running.",
      ],
    },
  },
  {
    id: "actions",
    question: "What's left before I can publish 1.4.0 to npm?",
    evidence: `$ git status --short
(clean)
$ git log origin/main..main
(nothing: main is pushed)
$ node -p "require('./package.json').version"
1.4.0
$ grep -n '^## ' CHANGELOG.md | head -2
3:## 1.3.2
14:## 1.3.1
$ git tag --list 'v1.4*'
(no output)
$ npm run build && npm publish --dry-run
... + my-lib@1.4.0  (dry run)
$ npm profile get two-factor-auth
auth-and-writes`,
    key: {
      know: [
        "Add a 1.4.0 entry to CHANGELOG.md.",
        "Create the v1.4.0 tag and push it.",
        "Run npm publish yourself: the account asks for a two-factor code on every publish.",
      ],
      defer: [
        "Already done: the version is bumped to 1.4.0, main is pushed, the build and the dry run pass.",
      ],
      never: ["Nothing is left: it is ready to publish as is."],
    },
  },
  {
    id: "code",
    question:
      "Write a TypeScript function that retries an async call up to 3 times with exponential backoff, but never retries a 4xx error.",
    evidence: `src/http.ts:
  export class HttpError extends Error {
    constructor(readonly status: number, message: string) { super(message) }
  }

src/util.ts:
  export const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

package.json has no retry library, and the team does not want a new dependency for this.`,
    key: {
      know: [
        "The function itself, in a code block: it retries failed calls with growing delays, using sleep from src/util.ts.",
        "An HttpError with a status from 400 to 499 is thrown at once, without a retry.",
      ],
      defer: [
        "The delays it waits between attempts.",
        "Why a 4xx is not retried: the same request would fail the same way.",
      ],
      never: ["It uses or installs a retry library."],
    },
  },
  {
    id: "diagnosis",
    question: "Why do due dates show a day early for our users in California?",
    evidence: `The API returns due dates as date-only strings, e.g. {"due": "2026-03-14"}.

src/format.ts, line 12:
  export const dueLabel = (due: string) => new Date(due).toLocaleDateString()

$ TZ=America/Los_Angeles node -e "console.log(new Date('2026-03-14').toLocaleDateString('en-US'))"
3/13/2026
$ TZ=Europe/Berlin node -e "console.log(new Date('2026-03-14').toLocaleDateString('en-US'))"
3/14/2026

The database row holds 2026-03-14.`,
    key: {
      know: [
        'new Date("2026-03-14") reads a date-only string as midnight UTC, which is still the previous day in California, so the label shows a day early.',
        'Fix dueLabel in src/format.ts: format in UTC, e.g. toLocaleDateString(undefined, { timeZone: "UTC" }), or build a local date from the year, month and day.',
      ],
      defer: [
        "The stored date is right; users east of UTC, such as in Berlin, see the right day.",
      ],
      never: [
        "The database stores the wrong date.",
        "The API returns the wrong date.",
      ],
    },
  },
  {
    id: "decision",
    question: "Should the job status page use websockets or polling?",
    evidence: `Hosting: the app runs on a serverless platform. Its docs: "Functions time out after 10 seconds.
WebSocket connections are not supported; use a separate service for long-lived connections."

Jobs take from 30 seconds to 5 minutes. About 50 people watch the status page at the busiest hour.
GET /jobs/:id/status reads one row by primary key; its p95 latency is 12 ms.`,
    key: {
      know: [
        "Use polling, every few seconds.",
        "The current host does not support websockets; they would need a separate always-on service.",
        "The cost of polling is a few seconds of delay before a status change shows, which these job lengths can afford.",
      ],
      defer: [
        "Load estimate: 50 viewers polling every 3 seconds is about 17 cheap requests a second.",
      ],
      never: ["Websockets work on the current host."],
    },
  },
  {
    id: "status",
    question: "Where are we on the auth migration?",
    evidence: `$ gh pr list --label auth-migration --state all
#212  Move sessions to Redis            MERGED   3 days ago
#218  Refresh tokens in the background  OPEN     approved; checks failing
#220  Remove the old cookie path        OPEN     review requested from @org/security 2 days ago, no response

$ gh pr checks 218
e2e  fail   login > remembers this device
unit pass
lint pass

$ gh run list --branch main --workflow e2e --limit 3
completed  failure  main  "Bump vite"          (yesterday)   failed: login > remembers this device
completed  failure  main  "Fix footer links"   (yesterday)   failed: login > remembers this device
completed  success  main  "Move sessions to Redis" (3 days ago)`,
    key: {
      know: [
        "#218 is approved but blocked by a failing e2e test, which also fails on main since yesterday, so #218 did not cause it.",
        "#220 is waiting on the security team's review, requested 2 days ago with no answer.",
        "The migration is not done: two of its three pull requests are open.",
      ],
      defer: [
        "#212, moving sessions to Redis, merged 3 days ago.",
        'The failing test is "login > remembers this device".',
      ],
      never: ["#218 broke the e2e test.", "The auth migration is finished."],
    },
  },
  {
    id: "keyboard-options",
    question:
      "Could we make reply navigation keyboard-only? What does the API give us?",
    evidence: KEYBOARD_EVIDENCE,
    items: KEYBOARD_ITEMS,
    key: { know: KEYBOARD_POINTS, defer: [], never: [] },
  },
  {
    id: "cache-options",
    question: "What are the tradeoffs among our available cache options?",
    evidence:
      "We have three implemented adapters. Memory cache has the lowest latency but is lost on restart and cannot share state across processes. SQLite persists locally and needs no separate service, but replicas cannot share one local file. Redis shares cached data across replicas, but needs a running service and adds a network hop. All three support the same TTL interface; no new adapter needs to be written.",
    items: [["memory"], ["sqlite"], ["redis"]],
    key: {
      know: [
        "Memory is fast but temporary and process-local.",
        "SQLite persists locally but is not shared across replicas.",
        "Redis shares across replicas but requires a service.",
      ],
      defer: [],
      never: [],
    },
  },
  {
    id: "keyboard-rewrite",
    kind: "rewrite",
    reply:
      "What the API offers:\n\n- The reply itself. The plugin draws replies with a Client element, which can listen for keys. But keys reach it only after a click gives it focus, and Esc gives focus back. Inside a reply, arrows, Tab, Enter and Backspace could move between stretches and open or close them, but you need one click to start.\n- A band above the prompt. Focus it with Ctrl+X Tab without the mouse, and its buttons then answer one digit or letter each. Esc returns to the prompt.\n- Your own keybinding. A button can claim an existing engine keybinding action, so the chord you bound in keybindings.json presses it straight from the prompt. Only engine action names are allowed, and only while the engine is not handling that action itself, so it is fragile.\n- Slash commands. Something like /stretch open 2, which is keyboard-only but slow.",
    items: KEYBOARD_ITEMS,
    key: { know: KEYBOARD_POINTS, defer: [], never: [] },
  },
  {
    id: "export-formats",
    needsNoStretch: true,
    question: "List the three supported export formats. Names only.",
    evidence: "The application exports CSV, JSON, and Parquet.",
    key: {
      know: ["The formats are CSV, JSON and Parquet."],
      defer: [],
      never: [],
    },
  },
  {
    id: "verification-results",
    question: "What was verified on the exact commit?",
    evidence:
      "The working tree was clean at commit 9c31a7e for both checks. npm run typecheck exited 0. npm test reported 47 passed, 0 failed and exited 0. No browser tests were run on that commit.",
    key: {
      know: ["Typecheck and unit tests passed.", "Browser tests were not run."],
      defer: ["The checked commit was 9c31a7e.", "All 47 unit tests passed."],
      never: ["Browser tests passed.", "Every test suite was run."],
    },
  },
  {
    id: "verification-summary",
    question: "Give me the verification summary for this change.",
    evidence: `At clean commit 9c31a7e, npm run typecheck exited 0, and npm test passed all 47 unit tests.
The unit tests cover parsing nested stretches, preserving literal code, and closing malformed input.
The CLI smoke check also passed: a fresh run wrote its manifest, resuming identical inputs added no rows,
and resuming changed inputs stopped before a model call. It used a stand-in model process.
The same commit has not been tested with a real model or in a running terminal.
The real-model run and terminal keyboard/resize checks remain to be done before release.
All recorded checks refer to that commit; there are no later edits.`,
    key: {
      know: [
        "Typecheck, unit tests and the CLI smoke check passed on the same commit.",
        "The smoke check used a stand-in, so it does not show real-model behavior.",
        "Real-model and running-terminal checks remain before release.",
      ],
      defer: [
        "The checked commit was 9c31a7e.",
        "All 47 unit tests passed.",
        "The smoke check covered fresh runs, unchanged resumes and refusal of changed inputs.",
      ],
      never: [
        "Real-model behavior was verified.",
        "Terminal keyboard and resize behavior was verified.",
        "The change is ready for release.",
      ],
    },
  },
  {
    id: "current-capabilities",
    question:
      "What is actually in place, and what would developer mode change?",
    evidence: `The current application keeps draft edits in process memory. A restart loses those drafts.
Only an explicit Save writes a file. The file writer takes a lock while saving; the lock is released
when the save ends. There is no persistent editing lock and no background autosave.
The proposed developer mode would save each edit to a local journal and replay it after a restart.
That proposal has not been implemented or tested. It would not change save-time locking.
The product sketch says drafts already survive restart, but the current implementation does not do that.`,
    key: {
      know: [
        "Current drafts are lost on restart; only explicit Save persists them.",
        "The current lock lasts only during a save.",
        "Developer mode proposes a local journal for restart recovery, but it is not implemented.",
      ],
      defer: [
        "Developer mode would leave save-time locking unchanged.",
        "The product sketch incorrectly describes current restart recovery.",
      ],
      never: [
        "Current drafts survive restart.",
        "Developer mode already works.",
        "An editing lock persists between saves.",
      ],
    },
  },
  {
    id: "unreported-check",
    question: "What was verified on this commit?",
    evidence:
      "At clean commit 7b92eac, typecheck exited 0 and all 84 unit tests passed. The CLI smoke run used a stand-in model. The browser resize check has not been run. No code changed after these checks.",
    key: {
      know: [
        "Typecheck and unit tests passed.",
        "The outcome of the CLI smoke run is not given.",
        "The browser resize check has not been run.",
      ],
      defer: [
        "All 84 unit tests passed.",
        "The supplied record concerns commit 7b92eac.",
      ],
      never: [
        "The CLI smoke run passed.",
        "The CLI smoke run failed.",
        "The browser resize check passed.",
      ],
    },
  },
  {
    id: "rollout-evidence",
    heldOut: true,
    question: "Can you sum up where the release stands?",
    evidence: `The release candidate passed 63 integration tests in staging. The same artifact was then
installed on one production canary, serving 5% of requests. Its first ten minutes showed no errors.
The planned observation period is one hour, so fifty minutes remain. No rollback rehearsal has been run
for this candidate. Full rollout is waiting for that rehearsal and the rest of the observation period.
The other production instances still serve the previous release. No customer-wide success claim has been made.`,
    key: {
      know: [
        "The candidate passed staging tests and is running on a 5% production canary.",
        "Ten error-free minutes do not complete the required one-hour observation.",
        "Full rollout is waiting for the remaining observation and a rollback rehearsal.",
      ],
      defer: [
        "Staging passed 63 integration tests.",
        "The other instances still serve the previous release.",
      ],
      never: [
        "Full rollout is complete.",
        "The rollback rehearsal passed.",
        "The full observation period passed.",
      ],
    },
  },
  {
    id: "search-options-zh",
    heldOut: true,
    question: "列出这三个搜索方案，各自有什么取舍？",
    evidence:
      "方案一：前缀搜索，只匹配词开头；延迟最低，但不能找词中间。方案二：全文搜索，支持按相关性排序；适合文章，但默认不保证任意子串匹配。方案三：三元组搜索，支持子串和近似拼写；索引较大，写入也更慢。",
    items: [["前缀"], ["全文"], ["三元组"]],
    key: {
      know: [
        "前缀搜索快，但不匹配词中间。",
        "全文搜索适合文章相关性，不保证任意子串。",
        "三元组支持子串和近似拼写，但索引大、写入慢。",
      ],
      defer: [],
      never: [],
    },
  },
  {
    id: "auth-options",
    heldOut: true,
    question:
      "List the three authentication approaches and explain the tradeoffs. Include the implementation notes where they help.",
    evidence:
      "Sessions store a random token in a cookie and its state on the server; immediate revocation is easy, but every request needs a state lookup. Implementation notes: rotate the token at login, expire it on logout. Signed bearer tokens can be verified without a database lookup, but revocation needs extra state or waiting for expiry. Implementation notes: verify issuer and audience, keep expiry short. API keys suit scripts and service accounts, but copied keys remain usable until revoked. Implementation notes: store only hashes, support per-key revocation.",
    items: [["session"], ["signed", "bearer", "jwt"], ["api key"]],
    key: {
      know: [
        "Sessions offer immediate revocation but require server state.",
        "Signed tokens avoid lookups but complicate revocation.",
        "API keys suit automation but copied keys work until revoked.",
      ],
      defer: [],
      never: [],
    },
  },
  {
    id: "parser-status",
    heldOut: true,
    question:
      "Give me a bulleted update on the parser, renderer, and export work. End with the required status block.",
    closing:
      "A closing status block is required: a horizontal rule, a Done line, a Next line, and a closing horizontal rule.",
    evidence:
      "Parser work is merged and the malformed-input test passes. The renderer change compiles, but nobody has tested resize behavior in a running app. Export work is blocked because the downstream CSV column order has not been agreed; the next step is to obtain that contract. There is no release yet.",
    items: [["parser"], ["renderer"], ["export"]],
    key: {
      know: [
        "Parser merged and malformed-input test passed.",
        "Renderer resize remains untested.",
        "Export is blocked on CSV column order.",
      ],
      defer: [],
      never: [],
    },
  },
];
