import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

const anchorScript = join(
  import.meta.dirname,
  "../../../plugins/agent/ravn-core/skills/why/scripts/anchor.ts",
);

const repoDir = realpathSync(mkdtempSync(join(tmpdir(), "why-anchor-")));

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "Ada",
  GIT_AUTHOR_EMAIL: "ada@example.com",
  GIT_COMMITTER_NAME: "Ada",
  GIT_COMMITTER_EMAIL: "ada@example.com",
  GIT_CONFIG_GLOBAL: join(repoDir, ".no-global-gitconfig"),
  GIT_CONFIG_NOSYSTEM: "1",
};

function git(args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: repoDir,
    env: gitEnv,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);

  return result.stdout.trim();
}

function commitFile(contents: string, message: string): string {
  writeFileSync(join(repoDir, "retry.ts"), contents);

  git(["add", "retry.ts"]);

  git(["commit", "-q", "-m", message]);

  return git(["rev-parse", "HEAD"]);
}

function runAnchor(args: string[]) {
  const result = spawnSync(process.execPath, [anchorScript, ...args], {
    cwd: repoDir,
    env: { ...gitEnv, PATH: process.env.PATH, GH_TOKEN: "" },
    encoding: "utf8",
  });

  return {
    status: result.status,
    stderr: result.stderr,
    anchor: result.status === 0 ? JSON.parse(result.stdout) : null,
  };
}

let firstCommit = "";

let secondCommit = "";

before(() => {
  git(["init", "-q"]);

  firstCommit = commitFile(
    "export const maxAttempts = 5;\n",
    "feat: add retry helper (#12)",
  );

  secondCommit = commitFile(
    "export const maxAttempts = 3;\nexport const backoffMs = 200;\n",
    "fix: cap retries at 3 (#18)\n\nThe gateway rate-limits after 5 requests. Refs PAY-42.",
  );
});

after(() => {
  rmSync(repoDir, { recursive: true, force: true });
});

test("collects commits, PR numbers, and ticket IDs for a file", () => {
  const { status, anchor } = runAnchor(["retry.ts"]);

  assert.equal(status, 0);

  assert.deepEqual(
    anchor.commits.map((commit: { hash: string }) => commit.hash),
    [secondCommit, firstCommit],
  );

  assert.equal(anchor.commits[0].author, "Ada");

  assert.match(anchor.commits[0].body, /rate-limits after 5 requests/);

  assert.deepEqual(anchor.prNumbers, [18, 12]);

  assert.deepEqual(anchor.ticketIds, ["PAY-42"]);

  assert.deepEqual(anchor.blameCommits, []);
});

test("blames only the requested lines", () => {
  const { anchor } = runAnchor(["retry.ts", "--lines", "1,1"]);

  assert.deepEqual(anchor.blameCommits, [secondCommit]);

  assert.equal(anchor.lines, "1,1");
});

test("reports unreachable pull requests as gaps instead of failing", () => {
  const { status, anchor } = runAnchor(["retry.ts"]);

  assert.equal(status, 0);

  assert.deepEqual(anchor.pullRequests, []);

  assert.equal(anchor.gaps.length, 2);

  assert.match(anchor.gaps[0], /\b18\b/);
});

test("reports a file with no history as a gap", () => {
  writeFileSync(join(repoDir, "untracked.ts"), "export {};\n");

  const { status, anchor } = runAnchor(["untracked.ts"]);

  assert.equal(status, 0);

  assert.deepEqual(anchor.commits, []);

  assert.match(anchor.gaps[0], /untracked\.ts/);
});

test("exits with usage when no file is given", () => {
  const { status, stderr } = runAnchor([]);

  assert.equal(status, 2);

  assert.match(stderr, /Usage/);
});
