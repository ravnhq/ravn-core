import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { test } from "node:test";

const runScript = join(import.meta.dirname, "..", "..", "evals", "run.ts");

const run = (...args: string[]) =>
  spawnSync(process.execPath, [runScript, ...args], {
    encoding: "utf8",
    timeout: 30_000,
  });

test("--name=value options are read like --name value", () => {
  const result = run("--runners=no-such-runner");

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown --runners value\(s\): no-such-runner/);
});

test("--smoke rejects --skills instead of ignoring it", () => {
  const result = run("--smoke", "--skills", "why");

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--skills does not apply to --smoke/);
});

test("a cursor runner requires CURSOR_API_KEY", () => {
  const env = { ...process.env };

  delete env.CURSOR_API_KEY;

  const result = spawnSync(
    process.execPath,
    [runScript, "--smoke", "--runners", "cursor/composer-2.5"],
    { encoding: "utf8", timeout: 30_000, env },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CURSOR_API_KEY is unset/);
});
