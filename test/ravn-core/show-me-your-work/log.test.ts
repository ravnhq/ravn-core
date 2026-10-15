import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const logScript = join(
  import.meta.dirname,
  "../../../plugins/agent/ravn-core/skills/show-me-your-work/scripts/log.ts",
);

const workDir = mkdtempSync(join(tmpdir(), "show-me-your-work-"));

after(() => rmSync(workDir, { recursive: true, force: true }));

function runLog(args: string[]) {
  return spawnSync(process.execPath, [logScript, ...args], {
    encoding: "utf8",
  });
}

function rows(logfile: string): string[][] {
  return readFileSync(logfile, "utf8")
    .trimEnd()
    .split("\n")
    .map((line) => line.split("\t"));
}

test("creates the log directory and writes the header once", () => {
  const logfile = join(workDir, "nested", ".audit", "task.tsv");

  assert.equal(runLog([logfile, "frame", "a", "b", "c", "d"]).status, 0);
  assert.equal(runLog([logfile, "build", "e", "f", "g", "h"]).status, 0);

  const [head, first, second] = rows(logfile);

  assert.deepEqual(head, [
    "ts",
    "phase",
    "decision",
    "why",
    "evidence",
    "result",
  ]);
  assert.deepEqual(first?.slice(1), ["frame", "a", "b", "c", "d"]);
  assert.deepEqual(second?.slice(1), ["build", "e", "f", "g", "h"]);
  assert.match(first?.[0] ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
});

test("keeps every cell on one line", () => {
  const logfile = join(workDir, "flat.tsv");

  runLog([logfile, "phase", "two\nlines", "tab\there", "cr\rend", "ok"]);

  const lines = rows(logfile);

  assert.equal(lines.length, 2);
  assert.deepEqual(lines[1]?.slice(1), [
    "phase",
    "two lines",
    "tab here",
    "cr end",
    "ok",
  ]);
});

test("neutralizes cells a spreadsheet would run as formulas", () => {
  const logfile = join(workDir, "formula.tsv");

  runLog([logfile, "=SUM(A1)", "+1", "-2", "@cmd", "plain"]);

  assert.deepEqual(rows(logfile)[1]?.slice(1), [
    "'=SUM(A1)",
    "'+1",
    "'-2",
    "'@cmd",
    "plain",
  ]);
});

test("appends to an existing log without rewriting it", () => {
  const logfile = join(workDir, "existing.tsv");

  writeFileSync(logfile, "ts\tphase\tdecision\twhy\tevidence\tresult\nold\n");

  runLog([logfile, "start", "resumed", "pickup", "session 42", "open"]);

  const lines = rows(logfile);

  assert.equal(lines.length, 3);
  assert.deepEqual(lines[1], ["old"]);
});

test("rejects the wrong number of arguments", () => {
  const result = runLog([join(workDir, "bad.tsv"), "only-phase"]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage/);
});
