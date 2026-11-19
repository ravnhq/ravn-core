import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildReport, renderMarkdown } from "../../evals/report.ts";

type Row = {
  arm: string;
  kind: string;
  description: string;
  success: boolean;
  error?: boolean;
  rubric?: number;
  workspace?: number;
  route?: string;
};

function row(item: Row) {
  const components = [
    ...(item.rubric === undefined
      ? []
      : [
          {
            pass: item.rubric >= 0.5,
            score: item.rubric,
            assertion: { type: "llm-rubric" },
          },
        ]),
    ...(item.workspace === undefined
      ? []
      : [
          {
            pass: item.workspace >= 0.5,
            score: item.workspace,
            assertion: { type: "javascript" },
          },
        ]),
    // Selection, reference reads, and max-score never count toward outcome.
    { pass: false, score: 0, assertion: { type: "max-score" } },
    {
      pass: false,
      score: 0,
      assertion: { type: "javascript", metric: "reference-read" },
    },
  ];

  return {
    provider: { label: `fx/${item.arm}/claude-code/model-x` },
    success: item.success,
    failureReason: item.error ? 2 : item.success ? 0 : 1,
    cost: 0.5,
    testCase: {
      description: item.description,
      metadata: { kind: item.kind, graderRoute: item.route ?? "first-party" },
    },
    gradingResult: item.error ? null : { componentResults: components },
  };
}

function write(dir: string, name: string, rows: Row[]) {
  writeFileSync(
    join(dir, name),
    JSON.stringify({
      config: {
        description: "demo-skill: current vs baseline vs without-skill",
      },
      results: { results: rows.map(row) },
    }),
  );
}

function withDir(t: { after: (fn: () => void) => void }) {
  const dir = mkdtempSync(join(tmpdir(), "ravn-report-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  return dir;
}

test("weights rubric 4 to workspace 1 and computes deltas per arm", (t) => {
  const dir = withDir(t);
  write(dir, "a-1.json", [
    {
      arm: "current",
      kind: "quality",
      description: "q",
      success: true,
      rubric: 1,
      workspace: 0,
    },
    {
      arm: "baseline",
      kind: "quality",
      description: "q",
      success: true,
      rubric: 0.5,
      workspace: 0.5,
    },
    {
      arm: "without-skill",
      kind: "quality",
      description: "q",
      success: false,
      rubric: 0,
      workspace: 0,
    },
  ]);

  const [quality] = buildReport(dir).cases;

  assert.equal(quality?.arms.current?.mean, 0.8);
  assert.equal(quality?.arms.baseline?.mean, 0.5);
  assert.equal(quality?.arms["without-skill"]?.mean, 0);
});

test("trigger rate spans repeat files and errors count as unscored", (t) => {
  const dir = withDir(t);

  const trigger = (success: boolean, error = false) => ({
    arm: "current",
    kind: "trigger",
    description: "fires",
    success,
    error,
  });

  write(dir, "a-1.json", [trigger(true)]);
  write(dir, "a-2.json", [trigger(false)]);
  write(dir, "a-3.json", [trigger(false, true)]);

  const [item] = buildReport(dir).cases;

  assert.equal(item?.rate, 0.5);
  assert.equal(item?.meetsThreshold, true);
  assert.equal(item?.arms.current?.n, 2);
  assert.equal(item?.arms.current?.unscored, 1);
});

test("a case that only errored is unscored, not failed", (t) => {
  const dir = withDir(t);
  write(dir, "a-1.json", [
    {
      arm: "current",
      kind: "stay-out",
      description: "quiet",
      success: false,
      error: true,
    },
  ]);

  const [item] = buildReport(dir).cases;

  assert.equal(item?.rate, null);
  assert.equal(item?.meetsThreshold, null);
});

test("flags a skill and runner graded through different routes", (t) => {
  const dir = withDir(t);
  write(dir, "a-1.json", [
    {
      arm: "current",
      kind: "trigger",
      description: "fires",
      success: true,
      route: "first-party",
    },
  ]);
  write(dir, "a-2.json", [
    {
      arm: "current",
      kind: "trigger",
      description: "fires",
      success: true,
      route: "openrouter",
    },
  ]);

  const report = buildReport(dir);

  assert.deepEqual(report.mixedRoutes, ["demo-skill · claude-code/model-x"]);
  assert.match(renderMarkdown(report), /not comparable/);
});
