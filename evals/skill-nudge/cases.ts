// Each case is the session as the mod sees it after a turn ends: the recent
// messages, and the ravn-core skill names (without the prefix) a good nudge
// may name. `expect: []` means the right answer is no nudge.
// A tool written `Skill:<name>` records that the session already ran that skill.

type Row = [role: "user" | "assistant", text: string, tools?: string[]];

export type Case = {
  id: string;
  kind: "fit" | "route" | "stay-out";
  expect: string[];
  // Written after the first run and kept out of prompt tuning, to catch overfitting.
  heldOut?: boolean;
  messages: Row[];
};

export const cases: Case[] = [
  // fit: a skill fits the next step.
  {
    id: "open-ended-approach",
    kind: "fit",
    expect: ["research"],
    messages: [
      [
        "user",
        "we need rate limiting on the public API. not sure if we should roll our own token bucket, use the gateway's built-in limiter, or pull in a library. what do other teams do?",
      ],
      [
        "assistant",
        "There are a few common options: a token bucket in Redis, a sliding-window counter, or the API gateway's native limiter. Each trades accuracy for operational cost. Want me to dig into which fits our stack?",
      ],
    ],
  },
  {
    id: "plan-ready-to-start",
    kind: "fit",
    expect: ["grilling", "grill-me"],
    messages: [
      [
        "user",
        "here's my plan for the billing migration: dual-write to the new ledger for two weeks, backfill old invoices with a script, then flip reads behind a flag and delete the old tables",
      ],
      [
        "assistant",
        "That sequence makes sense. Dual-write first, backfill, flip reads, then drop the old tables. Want me to start on the dual-write?",
      ],
    ],
  },
  {
    id: "shared-helper-changed",
    kind: "fit",
    expect: ["blast-radius"],
    messages: [
      ["user", "make formatCurrency round half-even instead of half-up"],
      [
        "assistant",
        "Done. I changed the rounding mode in src/lib/money/formatCurrency.ts and updated its unit tests, which pass. Note that formatCurrency is imported by checkout, invoices, refunds, and the email templates.",
        ["Read", "Edit", "Bash"],
      ],
    ],
  },
  {
    id: "user-leaving-soon",
    kind: "fit",
    expect: ["pause-safely"],
    messages: [
      ["user", "refactor the session store to use the new cache client"],
      [
        "assistant",
        "I've moved the read path over and I'm halfway through the write path; three call sites still use the old client.",
        ["Read", "Edit", "Edit"],
      ],
      [
        "user",
        "ok I have to jump into a meeting in 5 and won't be back until tomorrow",
      ],
      [
        "assistant",
        "Understood. The write path in src/session/store.ts is partly migrated; the remaining call sites are in auth, admin, and the worker.",
      ],
    ],
  },
  {
    id: "resume-yesterday",
    kind: "fit",
    expect: ["session-pickup"],
    messages: [
      [
        "user",
        "I was halfway through the search indexing work in another session yesterday, there should be a handoff note and a pushed branch",
      ],
      [
        "assistant",
        "I don't have that session's context. Can you tell me which branch, or paste what was done so far?",
      ],
    ],
  },
  {
    id: "unexplained-magic-number",
    kind: "fit",
    expect: ["why"],
    messages: [
      [
        "user",
        "why do we retry webhook deliveries exactly 7 times with that weird backoff? feels arbitrary",
      ],
      [
        "assistant",
        "Probably to cover roughly a day of retries with exponential backoff, but I don't see a comment explaining the choice in webhooks/retry.ts.",
        ["Read"],
      ],
    ],
  },
  {
    id: "where-should-it-live",
    kind: "fit",
    expect: ["how", "codebase-design"],
    messages: [
      [
        "user",
        "where should the notification preferences logic go, the users service or the notifications package? I don't really get how those two talk to each other",
      ],
      [
        "assistant",
        "Either could work. The users service owns profile data, while notifications handles delivery. I'd lean toward notifications, but it depends on how they're wired.",
      ],
    ],
  },
  {
    id: "ready-for-pr",
    kind: "fit",
    expect: ["pr"],
    messages: [
      ["user", "looks good, commit it and push the branch"],
      [
        "assistant",
        "Committed as `feat(search): index archived projects` and pushed `feat/search-archived` to origin. Ready for a pull request whenever you are.",
        ["Bash", "Bash"],
      ],
    ],
  },
  {
    id: "editing-agents-md",
    kind: "fit",
    expect: ["writing-for-agents"],
    messages: [
      [
        "user",
        "agents keep writing tests that mock the database, add something to AGENTS.md so they stop doing that",
      ],
      [
        "assistant",
        "I drafted a new section for AGENTS.md: 'Testing: Prefer integration tests against the local Postgres container. Avoid mocking the database layer.' Want me to add it?",
        ["Read"],
      ],
    ],
  },
  {
    id: "cannot-verify-ui",
    kind: "fit",
    expect: ["create-verification-skill", "principle-prove-it-works"],
    messages: [
      ["user", "fix the date picker so it doesn't close when you tab out"],
      [
        "assistant",
        "I changed the blur handler in DatePicker.tsx. I couldn't confirm it in the running app: this repo has no script to launch it and drive the UI, so I only checked that it compiles.",
        ["Read", "Edit", "Bash"],
      ],
    ],
  },
  {
    id: "null-check-bandaid",
    kind: "fit",
    expect: ["principle-fix-root-causes"],
    messages: [
      [
        "user",
        "prod keeps crashing in the session handler with 'cannot read id of undefined'",
      ],
      [
        "assistant",
        "I added a guard in sessionHandler.ts so it returns early when `user` is undefined. That stops the crash.",
        ["Read", "Edit"],
      ],
    ],
  },
  {
    id: "concurrent-writers",
    kind: "fit",
    expect: ["principle-separate-before-serializing-shared-state"],
    messages: [
      [
        "user",
        "two workers sometimes write the same report file and we get corrupted output. add a lock around the write?",
      ],
      [
        "assistant",
        "I can add a file lock around writeReport so only one worker writes at a time. Should I go ahead?",
      ],
    ],
  },

  // route: a near-miss that belongs to a sibling skill.
  {
    id: "how-not-why",
    kind: "route",
    expect: ["how"],
    messages: [
      [
        "user",
        "how does a job get from the API into the worker queue and back? I need to change the retry step",
      ],
      [
        "assistant",
        "At a high level the API enqueues a job and the worker picks it up. I'd need to trace the code to give you the exact flow.",
      ],
    ],
  },
  {
    id: "why-not-research",
    kind: "route",
    expect: ["why"],
    messages: [
      [
        "user",
        "why did we move the job queue from Redis to Postgres last year? I want to know before I propose moving it back",
      ],
      [
        "assistant",
        "I don't know the original reasoning. It may have been about durability or reducing infrastructure.",
      ],
    ],
  },
  {
    id: "pickup-not-pause",
    kind: "route",
    expect: ["session-pickup"],
    messages: [
      ["user", "continue where the last agent left off on the export feature"],
      [
        "assistant",
        "I'm not sure what was finished. Is there a handoff or branch I should look at?",
      ],
    ],
  },

  // stay-out: no skill should fire.
  {
    id: "trivial-rename",
    kind: "stay-out",
    expect: [],
    messages: [
      ["user", "rename `cnt` to `retryCount` in utils/retry.ts"],
      [
        "assistant",
        "Renamed `cnt` to `retryCount` in utils/retry.ts (4 occurrences).",
        ["Edit"],
      ],
    ],
  },
  {
    id: "thanks",
    kind: "stay-out",
    expect: [],
    messages: [
      ["user", "perfect, thanks!"],
      ["assistant", "You're welcome!"],
    ],
  },
  {
    id: "git-trivia",
    kind: "stay-out",
    expect: [],
    messages: [
      [
        "user",
        "what's the git command to undo my last commit but keep the changes?",
      ],
      [
        "assistant",
        "`git reset --soft HEAD~1` undoes the commit and keeps the changes staged.",
      ],
    ],
  },
  {
    id: "bug-fixed-and-proven",
    kind: "stay-out",
    expect: [],
    messages: [
      ["user", "the CSV export drops the last row"],
      [
        "assistant",
        "Found it: the loop in exportCsv.ts used `< rows.length - 1`. I fixed the bound, added a regression test with a 3-row fixture, and ran the export against the seed data: all rows are present now.",
        ["Read", "Edit", "Bash", "Bash"],
      ],
    ],
  },
  {
    id: "research-already-done",
    kind: "stay-out",
    expect: [],
    messages: [
      ["user", "research how other apps handle offline sync conflicts"],
      [
        "assistant",
        "I wrote the findings to docs/research/offline-sync.md: CRDTs, last-writer-wins with vector clocks, and server-side merge queues, with sources.",
        ["Skill:ravn-core:research", "Write"],
      ],
      ["user", "nice, which one is simplest?"],
      [
        "assistant",
        "Last-writer-wins with per-field timestamps is the simplest to build; it loses concurrent edits to the same field.",
      ],
    ],
  },
  {
    id: "mid-task-progress",
    kind: "stay-out",
    expect: [],
    messages: [
      ["user", "add a dark mode toggle to the settings page"],
      [
        "assistant",
        "Added the toggle component and wired it to the theme context. Next I'll persist the choice in localStorage.",
        ["Read", "Write", "Edit"],
      ],
    ],
  },
  {
    id: "css-question",
    kind: "stay-out",
    expect: [],
    messages: [
      ["user", "how do I center a div vertically with flexbox again?"],
      [
        "assistant",
        "On the parent: `display: flex; align-items: center;` and give it a height.",
      ],
    ],
  },

  // held out: written before the first prompt tuning and never tuned against.
  {
    id: "overnight-unattended",
    kind: "fit",
    heldOut: true,
    expect: ["show-me-your-work", "pause-safely"],
    messages: [
      [
        "user",
        "I'm going to let you run the logging migration across all 40 services overnight on your own, I'll review in the morning",
      ],
      [
        "assistant",
        "Sounds good. I'll go service by service, starting with the gateway.",
      ],
    ],
  },
  {
    id: "too-good-speedup",
    kind: "fit",
    heldOut: true,
    expect: ["principle-explain-the-number"],
    messages: [
      [
        "user",
        "p95 went from 800ms to 90ms after my caching change, put that in the PR description",
      ],
      [
        "assistant",
        "Added to the PR description: 'Caching the pricing lookup cut p95 latency from 800ms to 90ms.'",
        ["Bash"],
      ],
    ],
  },
  {
    id: "duplicate-after-crash",
    kind: "fit",
    heldOut: true,
    expect: ["principle-make-operations-idempotent"],
    messages: [
      [
        "user",
        "when the import worker crashes halfway and restarts, we end up with duplicate rows",
      ],
      [
        "assistant",
        "I can add a check that skips the import if a run already started today. Want me to add that?",
      ],
    ],
  },
  {
    id: "muddled-terms",
    kind: "fit",
    heldOut: true,
    expect: ["domain-modeling"],
    messages: [
      [
        "user",
        "tenant, workspace and org all seem to mean the same thing in this codebase and I keep getting confused. which is which?",
      ],
      [
        "assistant",
        "They overlap: `Org` is the billing entity, while `Tenant` and `Workspace` are both used for the data partition in different modules.",
        ["Grep"],
      ],
    ],
  },
  {
    id: "patch-bump",
    kind: "stay-out",
    heldOut: true,
    expect: [],
    messages: [
      ["user", "bump zod to the latest patch"],
      [
        "assistant",
        "Bumped zod 4.6.4 to 4.6.5; typecheck and tests pass.",
        ["Bash", "Bash"],
      ],
    ],
  },
  {
    id: "explain-regex",
    kind: "stay-out",
    heldOut: true,
    expect: [],
    messages: [
      ["user", "what does /^\\d{4}-\\d{2}$/ match?"],
      [
        "assistant",
        "A four-digit year, a hyphen, and a two-digit month, like `2026-10`, and nothing else.",
      ],
    ],
  },
  {
    id: "blast-radius-already-run",
    kind: "stay-out",
    heldOut: true,
    expect: [],
    messages: [
      [
        "user",
        "I changed the auth middleware's token parsing, what could this break?",
      ],
      [
        "assistant",
        "I traced every caller and ran the API and admin flows against the change: both still authenticate, and the webhook path never reaches this middleware. It's safe.",
        ["Skill:ravn-core:blast-radius", "Grep", "Bash"],
      ],
    ],
  },
];
