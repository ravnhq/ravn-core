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

test("quoted delimiters, semicolons, and comparisons survive parsing", () => {
  for (const [open, close] of [
    ["[", "]"],
    ["(", ")"],
    ["{", "}"],
    ["((", "))"],
    ["([", "])"],
    ["[(", ")]"],
    ["[[", "]]"],
    ["{{", "}}"],
  ]) {
    const label = `cache[key] ${close}; x < 10 && y > 5`;
    const chart = parseFlowchart(
      `flowchart TD\nA${open}"${label}"${close} -->|"save; now"| B[Save]; B --> C[Done]`,
    );

    expect(chart?.nodes.map((node) => node.label)).toEqual([
      label,
      "Save",
      "Done",
    ]);
    expect(chart?.edges).toEqual([
      { from: "A", to: "B", label: "save; now" },
      { from: "B", to: "C", label: "" },
    ]);
  }
});

test("only HTML tags are removed from labels", () => {
  const chart = parseFlowchart(
    'graph TD\nA["<b>cache</b><br/>x < 10 && y > 5"] --> B["<span class=hot>Save</span>"]',
  );

  expect(chart?.nodes.map((node) => node.label)).toEqual([
    "cache x < 10 && y > 5",
    "Save",
  ]);
});

test("incomplete or unsupported statements fall back to source entirely", () => {
  for (const source of [
    "flowchart TD A --> B",
    "flowchart TD\nA --> B\nC[unfinished",
    "flowchart TD\nA --> B -->",
    "flowchart TD\nA --> B junk",
    "flowchart TD\nA --> B\n?",
    'flowchart TD\nA["unterminated] --> B',
    'flowchart TD\nA["cache[key]"] -->',
    "flowchart TD\nA & B --> C",
  ]) {
    expect(parseFlowchart(source)).toBeNull();
  }
});

test("ambiguous connected buses list every affected edge without drawing them", () => {
  for (const edges of [
    ["A --> C", "A --> D", "B --> D"],
    ["A --> C", "B --> C", "B --> D"],
  ]) {
    const chart = parseFlowchart(`flowchart TD\n${edges.join("\n")}`);

    if (chart === null) throw new Error("expected a chart");

    for (const width of [24, 40, 70]) {
      const drawing = drawFlowchart(chart, width);

      expect(drawing.join("\n")).not.toContain("▼");
      expect(drawing.filter((line) => line.startsWith("  ⇢"))).toEqual(
        chart.edges.map((edge) => `  ⇢ ${edge.from} → ${edge.to}`),
      );
    }
  }
});

test("unambiguous fan-out, fan-in, disjoint and complete buses still draw", () => {
  for (const edges of [
    ["A --> B", "A --> C"],
    ["A --> C", "B --> C"],
    ["A --> C", "B --> D"],
    ["A --> C", "A --> D", "B --> C", "B --> D"],
    ["A --> C", "A --> D", "B --> D", "E --> F"],
  ]) {
    const chart = parseFlowchart(`flowchart TD\n${edges.join("\n")}`);

    if (chart === null) throw new Error("expected a chart");

    const drawing = drawFlowchart(chart, 70).join("\n");

    expect(drawing).toContain("▼");
    if (edges.includes("E --> F")) expect(drawing).not.toContain("⇢ E → F");
    else expect(drawing).not.toContain("⇢");
  }
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
