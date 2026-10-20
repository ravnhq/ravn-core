import { expect, test } from "claude-code/testing";

import { drawFlowchart, parseFlowchart } from "../lib/flowchart.ts";

const SAVE = `flowchart TD
  A[Editor saves] --> B{Hash unchanged?}
  B -- yes --> C([Return cached])
  B -->|no| D[Write to disk]
  D --> E[Update cache] --> F[Done]
  C --> F
  F -.-> A
  classDef hot fill:#f00
  style A fill:#0f0`;

test("parses nodes, frames, labelled edges, and chains; skips styling", () => {
  const chart = parseFlowchart(SAVE);

  expect(chart?.nodes.map((node) => `${node.id}:${node.frame}`)).toEqual([
    "A:box",
    "B:decision",
    "C:round",
    "D:box",
    "E:box",
    "F:box",
  ]);
  expect(chart?.edges).toContainEqual({ from: "B", to: "C", label: "yes" });
  expect(chart?.edges).toContainEqual({ from: "B", to: "D", label: "no" });
  expect(chart?.edges).toContainEqual({ from: "E", to: "F", label: "" });
  expect(chart?.edges).toHaveLength(7);
});

test("anything but a flowchart is left for the caller to show as source", () => {
  expect(parseFlowchart("sequenceDiagram\n  A->>B: hi")).toBeNull();
  expect(parseFlowchart("flowchart TD")).toBeNull();
});

test("the drawing fits the width it is given and changes with it", () => {
  const chart = parseFlowchart(SAVE);

  if (chart === null) throw new Error("expected a chart");

  const wide = drawFlowchart(chart, 70);
  const narrow = drawFlowchart(chart, 30);

  for (const [lines, width] of [
    [wide, 70],
    [narrow, 30],
  ] as const) {
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(width);
  }

  expect(wide.join("\n")).toContain("Hash unchanged?");
  expect(wide.join("\n")).toContain("▼ yes");
  expect(narrow).not.toEqual(wide);
  // The edge back up to the start cannot be drawn downward, so it is listed.
  expect(wide.join("\n")).toContain("↺ Done → Editor saves");
});
