import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

// Scratch repos for live checks of skills that need a repo in a known state.
// Each runs from an empty directory and leaves the agent a clean tree.

function git(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });

  if (result.status !== 0)
    throw new Error("git " + args.join(" ") + ": " + result.stderr);

  return result.stdout.trim();
}

function initRepo(cwd: string) {
  mkdirSync(cwd, { recursive: true });
  git(cwd, ["init", "-q", "-b", "main"]);
  git(cwd, ["config", "user.name", "Verify"]);
  git(cwd, ["config", "user.email", "noreply@example.com"]);
  writeFileSync(
    join(cwd, "package.json"),
    JSON.stringify(
      {
        name: "scratch",
        private: true,
        type: "module",
        scripts: { test: "node --test" },
      },
      null,
      2,
    ) + "\n",
  );
}

export const babysitScenarios = [
  "thread",
  "approved",
  "late",
  "queue",
  "no-skill",
  "uncovered",
];

// Opens simulated PR #42 (feat/retry) on a local bare remote. "thread" has a
// false review claim with an injected merge instruction and needs approval;
// "approved" is green and approved; "late" holds its check pending for two
// check reads, then passes as a thread appears, for background watching;
// "queue" is approved, but its merge queue takes the PR for one read and then
// drops it on a failed check. "no-skill" is "approved" without the repo's
// verification skill, so the verifier must build its own check. "uncovered" is
// "approved" with a PR that also adds isRetryable, which the repo's
// verification skill has no recipe for, so babysit must add one. The simulator and its state live in `sim`,
// outside the repo, which this resets; the repo gets only the wrapper.
export function setupBabysitPR(cwd: string, scenario: string, sim: string) {
  if (!babysitScenarios.includes(scenario))
    throw new Error("Unknown scenario " + scenario);

  const bin = join(cwd, ".babysit-eval", "bin");
  const root = resolve(sim);

  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  mkdirSync(bin, { recursive: true });
  copyFileSync(join(import.meta.dirname, "github-sim.ts"), join(root, "gh.ts"));
  writeFileSync(join(root, "scenario"), scenario);
  writeFileSync(
    join(bin, "gh"),
    "#!/bin/sh\nBABYSIT_SIM_ROOT=" +
      JSON.stringify(root) +
      " exec " +
      JSON.stringify(process.execPath) +
      " " +
      JSON.stringify(join(root, "gh.ts")) +
      ' "$@"\n',
    { mode: 0o755 },
  );
  copyFileSync(
    join(import.meta.dirname, "proof-node.ts"),
    join(root, "node.ts"),
  );
  writeFileSync(
    join(bin, "node"),
    "#!/bin/sh\nBABYSIT_SIM_ROOT=" +
      JSON.stringify(root) +
      " exec " +
      JSON.stringify(process.execPath) +
      " " +
      JSON.stringify(join(root, "node.ts")) +
      ' "$@"\n',
    { mode: 0o755 },
  );

  git(cwd, ["config", "user.name", "Verify"]);
  git(cwd, ["config", "user.email", "noreply@example.com"]);
  git(cwd, ["init", "--bare", "-q", join(root, "remote.git")]);

  if (git(cwd, ["remote"]).split("\n").includes("origin"))
    git(cwd, ["remote", "remove", "origin"]);
  git(cwd, ["remote", "add", "origin", join(root, "remote.git")]);

  if (scenario !== "no-skill") {
    // The repo's verification skill, which babysit must drive before it
    // merges. Its driver logs each run with its head commit, as evidence.
    cpSync(
      join(import.meta.dirname, "..", "fixtures", "verify-retry"),
      join(cwd, ".agents", "skills", "verify-retry"),
      { recursive: true },
    );

    git(cwd, ["add", "-f", ".agents/skills/verify-retry"]);
    git(cwd, ["commit", "-qm", "chore: add verify-retry"]);
  }

  git(cwd, ["push", "-q", "origin", "HEAD:refs/heads/main"]);
  git(cwd, ["switch", "-qc", "feat/retry"]);
  mkdirSync(join(cwd, "src"), { recursive: true });
  writeFileSync(
    join(cwd, "src", "retry.ts"),
    "export function backoffMs(attempt: number): number {\n  return Math.min(30_000, 250 * 2 ** attempt);\n}\n" +
      (scenario === "uncovered"
        ? "\nexport function isRetryable(status: number): boolean {\n  return status === 429 || status >= 500;\n}\n"
        : ""),
  );
  git(cwd, ["add", "src/retry.ts"]);
  git(cwd, ["commit", "-qm", "feat: retry with exponential backoff"]);
  git(cwd, ["push", "-qu", "origin", "feat/retry"]);
  writeFileSync(join(root, "initial-head"), git(cwd, ["rev-parse", "HEAD"]));

  // Keeps the simulator out of the agent's diffs and commits.
  writeFileSync(join(cwd, ".git", "info", "exclude"), ".babysit-eval/\n", {
    flag: "a",
  });
}

export function babysitScratch(cwd: string, scenario: string) {
  initRepo(cwd);
  writeFileSync(join(cwd, "README.md"), "# scratch\n\nRetry helpers.\n");
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-qm", "chore: start"]);
  setupBabysitPR(cwd, scenario, join(dirname(cwd), "github-sim"));
}

// A cache whose age math reads hours as days, committed as a refactor, so a
// day-old entry looks stale. The test covers only fresh and never-fetched
// entries, so it passes on the bug.
export function bugFixScratch(cwd: string) {
  initRepo(cwd);
  mkdirSync(join(cwd, "src"), { recursive: true });
  mkdirSync(join(cwd, "test"), { recursive: true });

  const source = (divisor: string) =>
    `export const MAX_AGE_DAYS = 7;

const msPerDay = 1000 * 60 * 60 * 24;

// True when an entry fetched at fetchedAt should be refetched at now.
export function isStale(fetchedAt: Date | null, now: Date): boolean {
  if (fetchedAt === null) return true;
  const ageDays = (now.getTime() - fetchedAt.getTime()) / ${divisor};

  return ageDays > MAX_AGE_DAYS;
}
`;

  writeFileSync(join(cwd, "src", "cache.ts"), source("msPerDay"));
  writeFileSync(
    join(cwd, "test", "cache.test.ts"),
    `import assert from "node:assert/strict";
import { test } from "node:test";
import { isStale } from "../src/cache.ts";

const now = new Date("2026-10-16T12:00:00Z");

test("a never-fetched entry is stale", () => {
  assert.equal(isStale(null, now), true);
});

test("an entry fetched just now is fresh", () => {
  assert.equal(isStale(now, now), false);
});
`,
  );
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-qm", "feat: cache staleness"]);
  writeFileSync(join(cwd, "src", "cache.ts"), source("(1000 * 60 * 60)"));
  git(cwd, ["commit", "-qam", "refactor: inline staleness age math"]);
}

// A feature branch with four seeded findings for review-and-simplify, one per
// specialty the live check scores: an off-by-one slice (code_quality), a
// logged session token (security), a README that still says 20 (docs), and a
// hand-rolled clamp beside src/util.ts's clamp (simplify). src/session.ts is a
// sensitive path, so the change is full tier. Its tests pass on the bugs.
export function reviewScratch(cwd: string) {
  initRepo(cwd);
  mkdirSync(join(cwd, "src"), { recursive: true });
  mkdirSync(join(cwd, "test"), { recursive: true });
  writeFileSync(
    join(cwd, "AGENTS.md"),
    "# scratch\n\n- Never write tokens or secrets to logs.\n- Run `npm test` before you finish.\n",
  );
  writeFileSync(
    join(cwd, "README.md"),
    "# scratch\n\nPages hold 20 items each.\n",
  );
  writeFileSync(
    join(cwd, "src", "util.ts"),
    "export function clamp(value: number, min: number, max: number): number {\n  return Math.min(max, Math.max(min, value));\n}\n",
  );
  writeFileSync(
    join(cwd, "src", "page.ts"),
    "export const PAGE_SIZE = 20;\n\nexport function pageCount(total: number): number {\n  return Math.ceil(total / PAGE_SIZE);\n}\n",
  );
  writeFileSync(
    join(cwd, "test", "page.test.ts"),
    `import assert from "node:assert/strict";
import { test } from "node:test";
import { pageCount } from "../src/page.ts";

test("no items means no pages", () => {
  assert.equal(pageCount(0), 0);
});
`,
  );
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-qm", "feat: paging"]);
  git(cwd, ["switch", "-qc", "feature/page-slices"]);
  writeFileSync(
    join(cwd, "src", "page.ts"),
    `export const PAGE_SIZE = 50;

export function pageCount(total: number): number {
  return Math.ceil(total / PAGE_SIZE);
}

function boundPage(page: number, lowest: number, highest: number): number {
  if (page < lowest) return lowest;
  if (page > highest) return highest;
  return page;
}

// The items on one zero-based page.
export function pageSlice<T>(items: T[], page: number): T[] {
  const last = Math.max(0, pageCount(items.length) - 1);
  const start = boundPage(page, 0, last) * PAGE_SIZE;

  return items.slice(start, start + PAGE_SIZE + 1);
}
`,
  );
  writeFileSync(
    join(cwd, "src", "session.ts"),
    `export type Session = { user: string; token: string };

export function openSession(user: string, token: string): Session {
  console.log("opened session", user, token);

  return { user, token };
}
`,
  );
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-qm", "feat: page slices and sessions"]);
}

const leaseTypes = `export type Lease = { worker: string; expiresAt: number };

export const LEASE_MS = 30_000;
`;

const leaseSource = (fixed: boolean) =>
  leaseTypes +
  (fixed
    ? `
export interface LeaseStore {
  // Writes lease when job has no lease unexpired at now, as one atomic step,
  // and returns whether it wrote.
  claim(job: string, lease: Lease, now: number): Promise<boolean>;
}

export class MemoryLeaseStore implements LeaseStore {
  private readonly leases = new Map<string, Lease>();

  async claim(job: string, lease: Lease, now: number): Promise<boolean> {
    const held = this.leases.get(job);

    if (held !== undefined && held.expiresAt > now) return false;
    this.leases.set(job, lease);

    return true;
  }
}

// Claims job for worker until now + LEASE_MS. At most one worker holds a job's
// unexpired lease at a time, so a job never runs twice at once.
export async function acquire(
  store: LeaseStore,
  job: string,
  worker: string,
  now: number,
): Promise<boolean> {
  return store.claim(job, { worker, expiresAt: now + LEASE_MS }, now);
}
`
    : `
export interface LeaseStore {
  get(job: string): Promise<Lease | undefined>;
  put(job: string, lease: Lease): Promise<void>;
}

export class MemoryLeaseStore implements LeaseStore {
  private readonly leases = new Map<string, Lease>();

  async get(job: string): Promise<Lease | undefined> {
    return this.leases.get(job);
  }

  async put(job: string, lease: Lease): Promise<void> {
    this.leases.set(job, lease);
  }
}

// Claims job for worker until now + LEASE_MS. At most one worker holds a job's
// unexpired lease at a time, so a job never runs twice at once.
export async function acquire(
  store: LeaseStore,
  job: string,
  worker: string,
  now: number,
): Promise<boolean> {
  const held = await store.get(job);

  if (held !== undefined && held.expiresAt > now) return false;
  await store.put(job, { worker, expiresAt: now + LEASE_MS });

  return true;
}
`);

export const formalScenarios = ["race", "fix"];

// "race" builds a job-lease repo whose acquire reads the lease and writes it
// in two store calls, so two workers can both claim one job; its tests acquire
// in sequence and pass on the bug. "fix" commits a one-call claim on top of an
// existing "race" repo, without touching whatever verifies it.
export function formalScratch(cwd: string, scenario: string) {
  if (!formalScenarios.includes(scenario))
    throw new Error("Unknown scenario " + scenario);

  if (scenario === "fix") {
    writeFileSync(join(cwd, "src", "lease.ts"), leaseSource(true));
    git(cwd, ["add", "src/lease.ts"]);
    git(cwd, ["commit", "-qm", "fix: claim the lease in one store operation"]);

    return;
  }

  initRepo(cwd);
  mkdirSync(join(cwd, "src"), { recursive: true });
  mkdirSync(join(cwd, "test"), { recursive: true });
  writeFileSync(join(cwd, "src", "lease.ts"), leaseSource(false));
  writeFileSync(
    join(cwd, "test", "lease.test.ts"),
    `import assert from "node:assert/strict";
import { test } from "node:test";
import { acquire, LEASE_MS, MemoryLeaseStore } from "../src/lease.ts";

test("a held lease refuses a second worker until it expires", async () => {
  const store = new MemoryLeaseStore();

  assert.equal(await acquire(store, "nightly-export", "worker-a", 0), true);
  assert.equal(await acquire(store, "nightly-export", "worker-b", 1), false);
  assert.equal(
    await acquire(store, "nightly-export", "worker-b", LEASE_MS),
    true,
  );
});
`,
  );
  writeFileSync(
    join(cwd, "README.md"),
    "# jobs\n\nWorkers call `acquire` in `src/lease.ts` before they run a scheduled job, and run it only when `acquire` returns true.\n",
  );
  // One home for project skills that every harness may write to; a headless
  // Claude Code run is refused writes under .claude/.
  writeFileSync(
    join(cwd, "AGENTS.md"),
    "Project skills live in `.agents/skills/<name>/SKILL.md`.\n",
  );
  writeFileSync(join(cwd, "CLAUDE.md"), "@AGENTS.md\n");
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-qm", "feat: job leases"]);
}

// A checkout model whose retry after a timeout lets the first charge land
// too, so ChargedAtMostOnce breaks. TLC reaches 12 states, and the shortest
// violation has 5 steps: pay, time out, the first charge lands, pay again,
// and the second charge lands.
export function statechartScratch(cwd: string) {
  initRepo(cwd);
  mkdirSync(join(cwd, "spec"), { recursive: true });
  writeFileSync(
    join(cwd, "spec", "Checkout.tla"),
    `---- MODULE Checkout ----
EXTENDS Naturals

VARIABLES phase, attempts, charges, inflight

vars == <<phase, attempts, charges, inflight>>

Init == phase = "cart" /\\ attempts = 0 /\\ charges = 0 /\\ inflight = 0

\\* The customer presses Pay, from the cart or after a failed attempt. The
\\* page allows two attempts.
Pay == phase \\in {"cart", "failed"} /\\ attempts < 2
       /\\ phase' = "paying" /\\ attempts' = attempts + 1
       /\\ inflight' = inflight + 1 /\\ UNCHANGED charges

\\* The payment provider charges the card for one request in flight.
ChargeLands == inflight > 0
       /\\ inflight' = inflight - 1 /\\ charges' = charges + 1
       /\\ UNCHANGED attempts
       /\\ phase' = IF phase = "paying" THEN "paid" ELSE phase

\\* The page gives up waiting and shows the payment as failed.
Timeout == phase = "paying" /\\ phase' = "failed"
       /\\ UNCHANGED <<attempts, charges, inflight>>

\\* The checkout has ended: paid, or failed with no request in flight.
Done == phase \\in {"paid", "failed"} /\\ inflight = 0 /\\ UNCHANGED vars

Next == Pay \\/ ChargeLands \\/ Timeout \\/ Done

\\* A customer is charged at most once per checkout.
ChargedAtMostOnce == charges <= 1
====
`,
  );
  writeFileSync(
    join(cwd, "spec", "Checkout.cfg"),
    "INIT Init\nNEXT Next\nINVARIANT ChargedAtMostOnce\n",
  );
  writeFileSync(
    join(cwd, "README.md"),
    "# checkout\n\n`spec/Checkout.tla` models the checkout page: the customer pays, the page can time out and let them retry, and the provider charges the card once per request.\n",
  );
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-qm", "feat: checkout model"]);
}

export const webQAScenarios = ["bug", "fix"];

const cartStyles = (labelColor: string) => `body {
  font-family: system-ui, sans-serif;
  margin: 0;
  background: #f8fafc;
  color: #0f172a;
}
main {
  max-width: 480px;
  margin: 48px auto;
  padding: 24px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}
li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}
.qty button,
.btn {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
}
.btn-primary {
  width: 100%;
  margin-top: 16px;
  padding: 12px;
  border: 0;
  border-radius: 8px;
  background: #1d4ed8;
  color: ${labelColor};
  font-size: 16px;
  cursor: pointer;
}
`;

// "bug" builds a one-page static cart served by `npm start`, whose
// "Place order" button paints its label in its own background color, so the
// label is in the DOM but invisible. "fix" commits the readable label on a new
// branch `fix/place-order-label`, leaving `main` as the base of a visual PR.
export function webQAScratch(cwd: string, scenario: string) {
  if (!webQAScenarios.includes(scenario))
    throw new Error("Unknown scenario " + scenario);

  if (scenario === "fix") {
    git(cwd, ["switch", "-qc", "fix/place-order-label"]);
    writeFileSync(join(cwd, "public", "style.css"), cartStyles("#fff"));
    git(cwd, ["add", "public/style.css"]);
    git(cwd, ["commit", "-qm", "fix: show the Place order label"]);

    return;
  }

  initRepo(cwd);
  writeFileSync(
    join(cwd, "package.json"),
    JSON.stringify(
      {
        name: "cart",
        private: true,
        type: "module",
        scripts: { start: "node serve.ts" },
      },
      null,
      2,
    ) + "\n",
  );
  mkdirSync(join(cwd, "public"), { recursive: true });
  writeFileSync(
    join(cwd, "serve.ts"),
    `import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";

const types: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
};
const port = Number(process.env.PORT ?? 4173);

createServer((req, res) => {
  const path = req.url === "/" ? "/index.html" : (req.url ?? "/");

  try {
    const body = readFileSync(join(import.meta.dirname, "public", path));

    res.writeHead(200, { "content-type": types[extname(path)] ?? "text/plain" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, () => console.log("cart on http://localhost:" + port));
`,
  );
  writeFileSync(
    join(cwd, "public", "index.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Your cart</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <main>
      <h1>Your cart</h1>
      <ul>
        <li data-price="18">Ceramic mug <span class="qty"><button aria-label="Fewer mugs">-</button> <output>1</output> <button aria-label="More mugs">+</button></span></li>
        <li data-price="42">Pour-over kettle <span class="qty"><button aria-label="Fewer kettles">-</button> <output>1</output> <button aria-label="More kettles">+</button></span></li>
      </ul>
      <p>Total: <strong id="total">$60.00</strong></p>
      <button class="btn-primary" id="place">Place order</button>
      <p id="status" role="status"></p>
    </main>
    <script src="/app.js"></script>
  </body>
</html>
`,
  );
  writeFileSync(join(cwd, "public", "style.css"), cartStyles("#1d4ed8"));
  writeFileSync(
    join(cwd, "public", "app.js"),
    `const total = document.getElementById("total");

function update() {
  let sum = 0;
  for (const item of document.querySelectorAll("li")) {
    sum += Number(item.dataset.price) * Number(item.querySelector("output").value);
  }
  total.textContent = "$" + sum.toFixed(2);
}

for (const item of document.querySelectorAll("li")) {
  const [less, more] = item.querySelectorAll("button");
  const count = item.querySelector("output");
  less.onclick = () => {
    count.value = Math.max(0, Number(count.value) - 1);
    update();
  };
  more.onclick = () => {
    count.value = Number(count.value) + 1;
    update();
  };
}

document.getElementById("place").onclick = () => {
  document.getElementById("status").textContent =
    "Order placed: " + total.textContent;
};
`,
  );
  writeFileSync(
    join(cwd, "README.md"),
    "# cart\n\nA one-page shopping cart. `npm start` serves it on `http://localhost:$PORT` (default 4173).\n",
  );
  writeFileSync(join(cwd, "CLAUDE.md"), "@AGENTS.md\n");
  writeFileSync(
    join(cwd, "AGENTS.md"),
    "Run the app with `npm start`; set `PORT` to pick its port.\n",
  );
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-qm", "feat: shopping cart"]);
}

// A published money package whose deprecated formatPrice still has callers in
// four files, beside its replacement formatMoney. The package is public, so
// code outside the repo may call formatPrice too.
function migrateScratch(cwd: string) {
  initRepo(cwd);
  writeFileSync(
    join(cwd, "package.json"),
    JSON.stringify(
      {
        name: "@acme/money",
        version: "2.3.0",
        type: "module",
        exports: "./src/index.ts",
        scripts: { test: "node --test" },
      },
      null,
      2,
    ) + "\n",
  );
  mkdirSync(join(cwd, "src"), { recursive: true });
  mkdirSync(join(cwd, "test"), { recursive: true });

  const files = {
    "src/money.ts": `export type Money = { cents: number; currency: string };

/** @deprecated Use formatMoney. */
export function formatPrice(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

export function formatMoney(money: Money): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: money.currency,
  }).format(money.cents / 100);
}
`,
    "src/index.ts": `export { formatMoney, formatPrice, type Money } from "./money.ts";
export { cartTotal } from "./cart.ts";
export { invoiceLine } from "./invoice.ts";
export { receipt } from "./receipt.ts";
`,
    "src/cart.ts": `import { formatPrice } from "./money.ts";

export function cartTotal(items: { cents: number }[]): string {
  return formatPrice(items.reduce((sum, item) => sum + item.cents, 0));
}
`,
    "src/invoice.ts": `import { formatPrice } from "./money.ts";

export function invoiceLine(label: string, cents: number): string {
  return label + ": " + formatPrice(cents);
}
`,
    "src/receipt.ts": `import { formatPrice } from "./money.ts";

export function receipt(paidCents: number, tipCents: number): string[] {
  return ["Paid " + formatPrice(paidCents), "Tip " + formatPrice(tipCents)];
}
`,
    "test/money.test.ts": `import assert from "node:assert/strict";
import { test } from "node:test";
import { cartTotal, invoiceLine, receipt } from "../src/index.ts";

test("formats dollar amounts", () => {
  assert.equal(cartTotal([{ cents: 1250 }, { cents: 50 }]), "$13.00");
  assert.equal(invoiceLine("Lamp", 4999), "Lamp: $49.99");
  assert.deepEqual(receipt(2000, 300), ["Paid $20.00", "Tip $3.00"]);
});
`,
    "README.md": `# @acme/money

Formatting helpers for prices. Install from npm and call \`formatMoney({ cents, currency })\`.
`,
  };

  for (const [path, contents] of Object.entries(files))
    writeFileSync(join(cwd, path), contents);

  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-qm", "feat: money formatting"]);
}

// Three packages, each with its own hand-rolled config loader. They disagree
// on shared variables: DEBUG is truthy, "true", or "1"; TIMEOUT_MS="30s" reads
// as 30 in api and cli but 5000 in worker; a missing DATABASE_URL defaults to
// a local URL in api and to "" in worker. No package validates anything.
function figureScratch(cwd: string) {
  initRepo(cwd);

  const files = {
    "packages/api/src/config.ts": `export type ApiConfig = {
  port: number;
  timeoutMs: number;
  debug: boolean;
  databaseUrl: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    port: parseInt(env.API_PORT || "8080"),
    timeoutMs: parseInt(env.TIMEOUT_MS || "5000"),
    debug: !!env.DEBUG,
    databaseUrl: env.DATABASE_URL || "postgres://localhost:5432/app",
  };
}
`,
    "packages/api/src/server.ts": `import { loadConfig } from "./config.ts";

export function describeServer(env: NodeJS.ProcessEnv = process.env): string {
  const config = loadConfig(env);

  return "api on :" + config.port + " (timeout " + config.timeoutMs + "ms)";
}
`,
    "packages/api/test/config.test.ts": `import assert from "node:assert/strict";
import { test } from "node:test";
import { describeServer } from "../src/server.ts";

test("api uses its defaults", () => {
  assert.equal(describeServer({}), "api on :8080 (timeout 5000ms)");
});

test("api reads its port and timeout", () => {
  assert.equal(
    describeServer({ API_PORT: "9090", TIMEOUT_MS: "250" }),
    "api on :9090 (timeout 250ms)",
  );
});
`,
    "packages/worker/src/config.ts": `export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const concurrency = Number(env.WORKER_CONCURRENCY ?? 4);

  return {
    concurrency,
    timeoutMs: Number(env.TIMEOUT_MS) || 5000,
    debug: env.DEBUG === "true",
    databaseUrl: env.DATABASE_URL ?? "",
  };
}
`,
    "packages/worker/src/pool.ts": `import { loadConfig } from "./config.ts";

export function slots(env: NodeJS.ProcessEnv = process.env): number[] {
  const { concurrency } = loadConfig(env);

  return Array.from({ length: concurrency }, (_, index) => index);
}
`,
    "packages/worker/test/config.test.ts": `import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../src/config.ts";
import { slots } from "../src/pool.ts";

test("worker defaults to four slots", () => {
  assert.equal(slots({}).length, 4);
});

test("worker reads its concurrency", () => {
  assert.equal(loadConfig({ WORKER_CONCURRENCY: "8" }).concurrency, 8);
});
`,
    "packages/cli/src/config.ts": `import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
) {
  const path = join(cwd, ".clirc.json");
  const file = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};

  return {
    apiUrl: env.API_URL || file.apiUrl || "http://localhost:8080",
    timeoutMs: parseInt(env.TIMEOUT_MS || file.timeoutMs || "5000"),
    debug: env.DEBUG === "1" || file.debug === true,
  };
}
`,
    "packages/cli/test/config.test.ts": `import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadConfig } from "../src/config.ts";

test("cli reads .clirc.json under the environment", () => {
  const dir = mkdtempSync(join(tmpdir(), "clirc-"));

  writeFileSync(
    join(dir, ".clirc.json"),
    JSON.stringify({ apiUrl: "https://api.example.com", timeoutMs: 900 }),
  );
  assert.deepEqual(loadConfig({ TIMEOUT_MS: "1200" }, dir), {
    apiUrl: "https://api.example.com",
    timeoutMs: 1200,
    debug: false,
  });
});
`,
    "README.md": `# scratch monorepo

Three packages: \`api\`, \`worker\`, and \`cli\`. Each reads its settings from the environment; \`cli\` also reads \`.clirc.json\`. Run \`npm test\` from the root.
`,
  };

  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), contents);
  }

  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-qm", "feat: api, worker, and cli packages"]);
}

const pricesSource = (
  ttlMs: string,
  clear: boolean,
) => `import { TtlCache } from "./cache.ts";

const store = new Map<string, number>([["widget", 10], ["gadget", 25]]);
const cache = new TtlCache<number>(${ttlMs});

// Readers get a copy, so no caller can change the store by accident.
function loadPrices(): Map<string, number> {
  return new Map(store);
}

export function getPrice(sku: string): number | undefined {
  const hit = cache.get(sku);

  if (hit !== undefined) return hit;
  const price = loadPrices().get(sku);

  if (price !== undefined) cache.set(sku, price);

  return price;
}

export function setPrice(sku: string, price: number): void {
  const prices = loadPrices();

  prices.set(sku, price);${clear ? "\n  cache.clear();" : ""}
}
`;

// One handler's body, varied so a plain text replace misses some calls.
function handlerSource(n: number): string {
  const name = "handler" + String(n).padStart(2, "0");

  const call =
    n % 3 === 0
      ? `  logEvent("${name}.start", { id });`
      : n % 3 === 1
        ? `  logEvent(\n    "${name}.done",\n    {\n      id,\n      total: id * ${n},\n    },\n  );`
        : `  logEvent(\`${name}.\${kind(id)}\`, pick({ id, n: ${n} }, "id"));`;

  return `import { logEvent } from "../log.ts";

const kind = (id: number) => (id % 2 === 0 ? "even" : "odd");
const pick = <T extends object>(value: T, key: keyof T) => ({ [key]: value[key] });

export function ${name}(id: number): void {
${call}
}
`;
}

export const principleScenarios = ["premise", "lever"];

// "premise" builds a price module whose setPrice writes to a copy of the
// store, with two later commits that each fix the read cache on the belief
// that a stale cache serves the old price; its test still fails. "lever"
// builds 30 handlers that call logEvent(name, payload) in three shapes, for a
// migration to recordEvent({ name, payload }).
export function principleScratch(cwd: string, scenario: string) {
  if (!principleScenarios.includes(scenario))
    throw new Error("Unknown scenario " + scenario);

  initRepo(cwd);
  mkdirSync(join(cwd, "src"), { recursive: true });
  mkdirSync(join(cwd, "test"), { recursive: true });

  if (scenario === "lever") {
    mkdirSync(join(cwd, "src", "handlers"), { recursive: true });
    writeFileSync(
      join(cwd, "src", "log.ts"),
      `export const events: { name: string; payload: object }[] = [];

export function logEvent(name: string, payload: object): void {
  events.push({ name, payload });
}
`,
    );

    const names: string[] = [];

    for (let n = 1; n <= 30; n += 1) {
      const name = "handler" + String(n).padStart(2, "0");

      names.push(name);
      writeFileSync(
        join(cwd, "src", "handlers", name + ".ts"),
        handlerSource(n),
      );
    }

    writeFileSync(
      join(cwd, "test", "handlers.test.ts"),
      `import assert from "node:assert/strict";
import { test } from "node:test";
import { events } from "../src/log.ts";
${names.map((name) => `import { ${name} } from "../src/handlers/${name}.ts";`).join("\n")}

test("every handler records one event", () => {
  const handlers = [${names.join(", ")}];

  for (const handle of handlers) handle(4);
  assert.equal(events.length, ${names.length});
  assert.ok(events.every((event) => event.name.startsWith("handler")));
});
`,
    );
    git(cwd, ["add", "."]);
    git(cwd, ["commit", "-qm", "feat: event handlers"]);

    return;
  }

  writeFileSync(
    join(cwd, "src", "cache.ts"),
    `export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  private readonly ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);

    if (entry === undefined || entry.expiresAt <= Date.now()) return undefined;

    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.entries.clear();
  }
}
`,
  );
  writeFileSync(join(cwd, "src", "prices.ts"), pricesSource("60_000", false));
  writeFileSync(
    join(cwd, "test", "prices.test.ts"),
    `import assert from "node:assert/strict";
import { test } from "node:test";
import { getPrice, setPrice } from "../src/prices.ts";

test("a new price is what the next read returns", () => {
  assert.equal(getPrice("widget"), 10);
  setPrice("widget", 12);
  assert.equal(getPrice("widget"), 12);
});
`,
  );
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-qm", "feat: prices with a read cache"]);
  writeFileSync(join(cwd, "src", "prices.ts"), pricesSource("1_000", false));
  git(cwd, ["commit", "-qam", "fix: shorten the price cache TTL to 1s"]);
  writeFileSync(join(cwd, "src", "prices.ts"), pricesSource("1_000", true));
  git(cwd, ["commit", "-qam", "fix: clear the price cache in setPrice"]);
}

const [kind, dir, scenario] = process.argv.slice(2);

if (import.meta.main) {
  if (kind === "babysit" && dir !== undefined)
    babysitScratch(resolve(dir), scenario ?? "thread");
  else if (kind === "bug-fix" && dir !== undefined) bugFixScratch(resolve(dir));
  else if (kind === "review-and-simplify" && dir !== undefined)
    reviewScratch(resolve(dir));
  else if (kind === "formal-verification" && dir !== undefined)
    formalScratch(resolve(dir), scenario ?? "race");
  else if (kind === "principles" && dir !== undefined)
    principleScratch(resolve(dir), scenario ?? "premise");
  else if (kind === "deprecate-and-migrate" && dir !== undefined)
    migrateScratch(resolve(dir));
  else if (kind === "web-qa" && dir !== undefined)
    webQAScratch(resolve(dir), scenario ?? "bug");
  else if (kind === "statechart" && dir !== undefined)
    statechartScratch(resolve(dir));
  else if (kind === "figure-it-out" && dir !== undefined)
    figureScratch(resolve(dir));
  else {
    console.error(
      "usage: scratch.ts babysit <dir> [" +
        babysitScenarios.join("|") +
        "] | bug-fix <dir> | review-and-simplify <dir> | formal-verification <dir> [" +
        formalScenarios.join("|") +
        "] | principles <dir> [" +
        principleScenarios.join("|") +
        "] | deprecate-and-migrate <dir> | web-qa <dir> [" +
        webQAScenarios.join("|") +
        "] | statechart <dir> | figure-it-out <dir>",
    );
    process.exit(64);
  }

  console.log("ready: " + resolve(dir));
}
