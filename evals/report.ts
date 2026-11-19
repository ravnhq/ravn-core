import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

// Promptfoo has no k-of-n repeat option, and max-score passes only one arm
// per row, so the comparison verdict is computed here from the results files
// run.ts writes: each arm's outcome score, the skill's gain over the other
// arms, and the rate at which selection cases behave correctly.

const failureError = 2;

const outcomeWeights = new Map([
  ["llm-rubric", 4],
  ["javascript", 1],
]);

const component = z.object({
  pass: z.boolean(),
  score: z.number(),
  assertion: z
    .object({ type: z.string(), metric: z.string().optional() })
    .optional(),
});

const row = z.object({
  provider: z.object({ label: z.string() }),
  success: z.boolean(),
  failureReason: z.number(),
  error: z.string().nullish(),
  cost: z.number().optional(),
  testCase: z.object({
    description: z.string(),
    metadata: z
      .object({ kind: z.string(), graderRoute: z.string().optional() })
      .passthrough(),
  }),
  gradingResult: z
    .object({ componentResults: z.array(component).optional() })
    .nullish(),
});

const resultsFile = z.object({
  config: z.object({ description: z.string() }),
  results: z.object({ results: z.array(z.unknown()) }),
});

type Row = z.infer<typeof row>;

type Run = { skill: string; runner: string; route: string; arm: string };

// The outcome score that compare.ts weights: rubric and workspace checks,
// without selection, reference reads, or max-score itself.
function outcomeScore(result: Row): number | undefined {
  let total = 0;
  let weight = 0;

  for (const entry of result.gradingResult?.componentResults ?? []) {
    const type = entry.assertion?.type ?? "";
    const w = outcomeWeights.get(type);

    if (w === undefined || entry.assertion?.metric === "reference-read")
      continue;

    total += entry.score * w;
    weight += w;
  }

  return weight === 0 ? undefined : total / weight;
}

type Cell = { scores: number[]; unscored: number };

const emptyCell = (): Cell => ({ scores: [], unscored: 0 });

export type CaseReport = {
  skill: string;
  runner: string;
  route: string;
  kind: string;
  description: string;
  arms: Record<string, { mean: number | null; n: number; unscored: number }>;
  rate: number | null;
  meetsThreshold: boolean | null;
};

export type Report = {
  cases: CaseReport[];
  cost: Record<string, number>;
  mixedRoutes: string[];
};

export const triggerThreshold = 0.5;

const mean = (values: number[]) =>
  values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;

export function buildReport(dir: string): Report {
  const cells = new Map<string, Cell>();

  const meta = new Map<
    string,
    Omit<CaseReport, "arms" | "rate" | "meetsThreshold">
  >();

  const cost: Record<string, number> = {};
  const routes = new Map<string, Set<string>>();

  for (const name of readdirSync(dir).filter((file) =>
    file.endsWith(".json"),
  )) {
    const parsed = resultsFile.safeParse(
      JSON.parse(readFileSync(join(dir, name), "utf8")),
    );

    if (!parsed.success) continue;

    const skill = parsed.data.config.description.split(":")[0] ?? name;

    for (const raw of parsed.data.results.results) {
      const result = row.parse(raw);
      const [, arm = "", ...runnerParts] = result.provider.label.split("/");

      const run: Run = {
        skill,
        runner: runnerParts.join("/"),
        route: result.testCase.metadata.graderRoute ?? "unrecorded",
        arm,
      };

      const { kind } = result.testCase.metadata;

      const caseKey = [
        skill,
        run.runner,
        run.route,
        result.testCase.description,
      ].join("\u0000");

      const cellKey = `${caseKey}\u0000${arm}`;
      const cell = cells.get(cellKey) ?? emptyCell();

      cells.set(cellKey, cell);
      meta.set(caseKey, {
        skill,
        runner: run.runner,
        route: run.route,
        kind,
        description: result.testCase.description,
      });

      const runnerKey = `${skill} · ${run.runner}`;
      cost[runnerKey] = (cost[runnerKey] ?? 0) + (result.cost ?? 0);
      routes.set(
        runnerKey,
        (routes.get(runnerKey) ?? new Set()).add(run.route),
      );

      if (result.failureReason === failureError) {
        cell.unscored += 1;
        continue;
      }

      const score = kind === "quality" ? outcomeScore(result) : undefined;

      cell.scores.push(score ?? (result.success ? 1 : 0));
    }
  }

  const cases = [...meta.entries()].map(([caseKey, info]) => {
    const arms: CaseReport["arms"] = {};

    for (const [cellKey, cell] of cells) {
      if (!cellKey.startsWith(`${caseKey}\u0000`)) continue;

      arms[cellKey.slice(caseKey.length + 1)] = {
        mean: mean(cell.scores),
        n: cell.scores.length,
        unscored: cell.unscored,
      };
    }

    // Selection cases run on the current arm only; their pass rate over
    // repeats is the trigger (or correct-abstention) rate.
    const rate = info.kind === "quality" ? null : (arms.current?.mean ?? null);

    return {
      ...info,
      arms,
      rate,
      meetsThreshold: rate === null ? null : rate >= triggerThreshold,
    };
  });

  const mixedRoutes = [...routes.entries()].flatMap(([key, set]) =>
    set.size > 1 ? [key] : [],
  );

  return { cases, cost, mixedRoutes };
}

const fmt = (value: number | null | undefined) =>
  value === null || value === undefined ? "–" : value.toFixed(2);

const delta = (a: number | null | undefined, b: number | null | undefined) =>
  a === null || a === undefined || b === null || b === undefined
    ? "–"
    : `${a - b >= 0 ? "+" : ""}${(a - b).toFixed(2)}`;

export function renderMarkdown(report: Report): string {
  const lines: string[] = ["# Skill eval report", ""];

  if (report.mixedRoutes.length > 0) {
    lines.push(
      `**Grader routes differ within: ${report.mixedRoutes.join(", ")}. Deltas there are not comparable.**`,
      "",
    );
  }

  const groups = Map.groupBy(
    report.cases,
    (item) => `${item.skill} · ${item.runner} · grader: ${item.route}`,
  );

  for (const [group, cases] of [...groups].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    lines.push(`## ${group}`, "");
    const quality = cases.filter((item) => item.kind === "quality");

    if (quality.length > 0) {
      lines.push(
        "| quality case | current | baseline | without | Δskill | Δchange | n | unscored |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
      );

      for (const item of quality) {
        const { current, baseline } = item.arms;
        const without = item.arms["without-skill"];

        const unscored = Object.values(item.arms).reduce(
          (sum, arm) => sum + arm.unscored,
          0,
        );

        lines.push(
          `| ${item.description} | ${fmt(current?.mean)} | ${fmt(baseline?.mean)} | ${fmt(without?.mean)} | ${delta(current?.mean, without?.mean)} | ${delta(current?.mean, baseline?.mean)} | ${current?.n ?? 0} | ${unscored} |`,
        );
      }

      lines.push("");
    }

    const selection = cases.filter((item) => item.kind !== "quality");

    if (selection.length > 0) {
      lines.push(
        `| ${"selection case"} | kind | correct rate | ≥ ${triggerThreshold} | n | unscored |`,
        "| --- | --- | --- | --- | --- | --- |",
      );

      for (const item of selection) {
        const current = item.arms.current;

        const verdict =
          item.meetsThreshold === null
            ? "unscored"
            : item.meetsThreshold
              ? "yes"
              : "**no**";

        lines.push(
          `| ${item.description} | ${item.kind} | ${fmt(item.rate)} | ${verdict} | ${current?.n ?? 0} | ${current?.unscored ?? 0} |`,
        );
      }

      lines.push("");
    }

    const runnerKey = group.split(" · grader:")[0] ?? group;
    lines.push(`Cost: $${(report.cost[runnerKey] ?? 0).toFixed(2)}`, "");
  }

  return lines.join("\n");
}

export function writeReport(dir: string): string {
  const report = buildReport(dir);
  const markdown = join(dir, "report.md");

  writeFileSync(
    join(dir, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  writeFileSync(markdown, renderMarkdown(report));

  return markdown;
}

if (import.meta.main) {
  console.log(
    `report: ${writeReport(process.argv[2] ?? join(import.meta.dirname, "results"))}`,
  );
}
