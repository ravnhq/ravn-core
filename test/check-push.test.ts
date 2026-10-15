import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { installGitHooks } from "../scripts/install-git-hooks.ts";

let root: string;

let work: string;

let remote: string;

let env: NodeJS.ProcessEnv;

function git(args: string[]) {
  return spawnSync("git", args, { cwd: work, env, encoding: "utf8" });
}

function requiredGit(args: string[]) {
  const result = git(args);

  assert.equal(result.status, 0, result.stderr);

  return result.stdout.trim();
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ravn-push-gate-"));
  work = join(root, "work");
  remote = join(root, "remote.git");
  const bin = join(root, "bin");

  mkdirSync(join(work, "scripts"), { recursive: true });
  mkdirSync(bin);

  const stub = join(
    bin,
    process.platform === "win32" ? "pnpm-stub.cjs" : "pnpm",
  );

  writeFileSync(
    stub,
    '#!/usr/bin/env node\nprocess.exit(Number(process.env.PUSH_CHECK_EXIT ?? "0"));\n',
    { mode: 0o755 },
  );

  if (process.platform === "win32")
    writeFileSync(join(bin, "pnpm.cmd"), '@node "%~dp0pnpm-stub.cjs" %*\n');

  env = {
    ...process.env,
    PATH: bin + (process.platform === "win32" ? ";" : ":") + process.env.PATH,
  };
  copyFileSync(
    join(import.meta.dirname, "..", "scripts", "check-push.ts"),
    join(work, "scripts", "check-push.ts"),
  );
  requiredGit(["init", "-q", "-b", "main"]);
  requiredGit(["config", "user.name", "Fixture"]);
  requiredGit(["config", "user.email", "noreply@example.com"]);
  requiredGit(["config", "core.hooksPath", join(work, ".git", "hooks")]);
  requiredGit(["add", "."]);
  requiredGit(["commit", "-qm", "test: baseline"]);
  requiredGit(["init", "--bare", "-q", remote]);
  requiredGit(["remote", "add", "origin", remote]);
  installGitHooks(work);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

test("a failed check blocks the actual push even when a later command succeeds", () => {
  env.PUSH_CHECK_EXIT = "1";
  const pushed = git(["push", "origin", "main"]);

  assert.notEqual(pushed.status, 0);
  assert.match(pushed.stderr, /push blocked/);
  assert.equal(
    spawnSync(process.execPath, ["-e", "process.exit(0)"]).status,
    0,
  );
  assert.notEqual(
    git(["--git-dir", remote, "rev-parse", "refs/heads/main"]).status,
    0,
  );
});

test("a clean validated commit and its release tag reach the remote", () => {
  requiredGit(["push", "origin", "main"]);
  requiredGit(["tag", "-a", "fixture--v0.5.0", "-m", "release"]);
  requiredGit(["push", "origin", "fixture--v0.5.0"]);
  assert.equal(
    requiredGit(["--git-dir", remote, "rev-parse", "refs/heads/main"]),
    requiredGit(["rev-parse", "HEAD"]),
  );
  requiredGit(["push", "origin", "main"]);
});

test("an uncommitted repair cannot validate a different committed tree", () => {
  writeFileSync(
    join(work, "scripts", "check-push.ts"),
    "// uncommitted repair\n",
  );
  const pushed = git(["push", "origin", "main"]);

  assert.notEqual(pushed.status, 0);
  assert.match(pushed.stderr, /commit or stash/);
});

test("an outgoing branch from a different checkout is blocked", () => {
  requiredGit(["branch", "older"]);
  writeFileSync(join(work, "next.txt"), "next\n");
  requiredGit(["add", "next.txt"]);
  requiredGit(["commit", "-qm", "test: next"]);
  const pushed = git(["push", "origin", "older"]);

  assert.notEqual(pushed.status, 0);
  assert.match(pushed.stderr, /check out the outgoing commit/);
});

test("installation preserves custom hooks and rejects external hooks directories", () => {
  const hook = join(work, ".git", "hooks", "pre-push");

  writeFileSync(hook, "#!/bin/sh\nexit 0\n");
  assert.throws(
    () => installGitHooks(work),
    /Existing pre-push hook preserved/,
  );
  assert.equal(readFileSync(hook, "utf8"), "#!/bin/sh\nexit 0\n");
  const external = join(root, "shared-hooks");

  requiredGit(["config", "core.hooksPath", external]);
  assert.throws(() => installGitHooks(work), /external hooks directory/);
  assert.equal(existsSync(external), false);
});

test("reinstallation restores executable permissions without duplicating the hook", () => {
  const hook = join(work, ".git", "hooks", "pre-push");
  const original = readFileSync(hook, "utf8");

  chmodSync(hook, 0o644);
  installGitHooks(work);
  assert.equal(readFileSync(hook, "utf8"), original);
  requiredGit(["push", "origin", "main"]);
});

test("the prepare script skips production installs and never fails an install on a conflict", () => {
  const hooks = join(work, ".git", "hooks");
  const script = join(work, "scripts", "install-git-hooks.ts");
  const { CI: _ci, npm_config_omit: _omit, ...installEnv } = env;

  copyFileSync(
    join(import.meta.dirname, "..", "scripts", "install-git-hooks.ts"),
    script,
  );
  rmSync(join(hooks, "pre-push"));
  rmSync(join(hooks, "ravn-check-push.ts"));

  const prepare = (extra: NodeJS.ProcessEnv) =>
    spawnSync(process.execPath, [script], {
      cwd: work,
      env: { ...installEnv, ...extra },
      encoding: "utf8",
    });

  assert.equal(prepare({ npm_config_omit: "dev" }).status, 0);
  assert.equal(existsSync(join(hooks, "pre-push")), false);

  const external = join(root, "shared-hooks");

  requiredGit(["config", "core.hooksPath", external]);
  assert.equal(prepare({}).status, 0);
  assert.equal(existsSync(external), false);
  assert.equal(existsSync(join(hooks, "pre-push")), false);

  requiredGit(["config", "core.hooksPath", hooks]);
  assert.equal(prepare({}).status, 0);
  assert.equal(existsSync(join(hooks, "pre-push")), true);
});
