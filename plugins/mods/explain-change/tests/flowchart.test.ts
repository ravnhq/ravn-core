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
  expect(chart?.edges).toContainEqual({
    from: "B",
    to: "C",
    label: "yes",
    direction: "directed",
  });
  expect(chart?.edges).toContainEqual({
    from: "B",
    to: "D",
    label: "no",
    direction: "directed",
  });
  expect(chart?.edges).toContainEqual({
    from: "E",
    to: "F",
    label: "",
    direction: "directed",
  });
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
      { from: "A", to: "B", label: "save; now", direction: "directed" },
      { from: "B", to: "C", label: "", direction: "directed" },
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

test("shared destinations with distinct labels list the whole route group", () => {
  for (const link of ["-->", "---"]) {
    for (const [first, second] of [
      ["yes", "no"],
      ["yes", ""],
    ]) {
      for (const sources of [
        ["A", "B"],
        ["A", "A"],
      ]) {
        const chart = parseFlowchart(
          `flowchart TD\n${sources[0]} ${link}|${first}| C\n${sources[1]} ${link}${second ? `|${second}|` : ""} C`,
        );

        if (chart === null) throw new Error("expected a chart");

        for (const width of [24, 40, 70]) {
          const drawing = drawFlowchart(chart, width);
          const marker = link === "---" ? "—" : "⇢";
          const connector = link === "---" ? "—" : "→";

          expect(drawing.join("\n")).not.toContain("▼");
          expect(drawing.filter((line) => line.startsWith(`  ${marker}`))).toEqual(
            chart.edges.map(
              (edge) =>
                `  ${marker} ${edge.from} ${connector} C${edge.label ? `  (${edge.label})` : ""}`,
            ),
          );
        }
      }
    }
  }
});

test("shared destinations with matching labels still draw", () => {
  const chart = parseFlowchart("flowchart TD\nA -->|yes| C\nB -->|yes| C");

  if (chart === null) throw new Error("expected a chart");

  expect(drawFlowchart(chart, 40).join("\n")).toContain("▼ yes");
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

test("CJK labels fit narrow boxes in terminal columns", () => {
  const chart = parseFlowchart('flowchart TD\nA["保存保存保存保存保存"]');

  if (chart === null) throw new Error("expected a chart");

  expect(drawFlowchart(chart, 30)).toEqual([
    `   ┌${"─".repeat(22)}┐`,
    "   │ 保存保存保存保存保存 │",
    `   └${"─".repeat(22)}┘`,
  ]);
});

test("combining marks, fullwidth and supplementary characters keep box alignment", () => {
  const chart = parseFlowchart('flowchart TD\nA["e\u0301Ａ𠀀"]');

  if (chart === null) throw new Error("expected a chart");

  expect(drawFlowchart(chart, 15)).toEqual([
    "   ┌───────┐",
    "   │ e\u0301Ａ𠀀 │",
    "   └───────┘",
  ]);
});

test("emoji graphemes occupy two columns without shifting box borders", () => {
  for (const glyph of ["🚀", "☀", "🇧🇷", "👩‍💻", "👍🏽", "1️⃣", "↔️"]) {
    const chart = parseFlowchart(`flowchart TD\nA["${glyph} Deploy"]`);

    if (chart === null) throw new Error("expected a chart");

    expect(drawFlowchart(chart, 30)).toEqual([
      `        ┌${"─".repeat(11)}┐`,
      `        │ ${glyph} Deploy │`,
      `        └${"─".repeat(11)}┘`,
    ]);
  }
});

test("emoji clipping keeps flags and joined sequences intact", () => {
  for (const glyph of ["🚀", "🇧🇷", "👩‍💻", "👍🏽", "1️⃣"]) {
    const chart = parseFlowchart(`flowchart TD\nA["${glyph.repeat(12)}"]`);

    if (chart === null) throw new Error("expected a chart");

    expect(drawFlowchart(chart, 16)).toEqual([
      `┌${"─".repeat(13)}┐`,
      `│ ${glyph.repeat(5)}… │`,
      `└${"─".repeat(13)}┘`,
    ]);

    const linked = parseFlowchart(
      `flowchart TD\nA -->|"${glyph.repeat(12)}"| B\nB --> A`,
    );

    if (linked === null) throw new Error("expected a chart");

    expect(drawFlowchart(linked, 70).join("\n")).toContain(
      `▼ ${glyph.repeat(9)}…`,
    );
    expect(drawFlowchart(linked, 16)).toContain(`  ⇢ A → B  (${glyph}…`);
  }
});

test("wide node and edge labels wrap, clip and refit without exceeding columns", () => {
  const chart = parseFlowchart(`flowchart TD
    A["保存保存 保存保存 保存保存 保存保存"] -->|"関係関係関係関係関係関係"| B["終点 e\u0301Ａ𠀀"]
    B -->|"関係関係関係関係関係関係"| A`);

  if (chart === null) throw new Error("expected a chart");

  for (const width of [16, 30, 70]) {
    const drawing = drawFlowchart(chart, width);

    for (const line of drawing) {
      const columns = [...line.replace(/\p{Mark}/gu, "")].reduce(
        (sum, glyph) => sum + (/[保存終点関係Ａ𠀀]/u.test(glyph) ? 2 : 1),
        0,
      );

      expect(columns).toBeLessThanOrEqual(width);
    }

    expect(drawing.join("\n")).toContain("e\u0301Ａ𠀀");
    expect(drawing.join("\n")).toContain("↺");
    expect(drawing.join("\n")).toContain("…");

    if (width === 70)
      expect(drawing.join("\n")).toContain("▼ 関係関係関係関係関…");
  }
});

test("chains retain undirected links and every supported arrow's direction", () => {
  const chart = parseFlowchart(
    "flowchart TD\nA ---|peer| B --> C ==> D -.-> E -- yes --> F",
  );

  expect(
    chart?.edges.map(({ direction, label }) => [direction, label]),
  ).toEqual([
    ["undirected", "peer"],
    ["directed", ""],
    ["directed", ""],
    ["directed", ""],
    ["directed", "yes"],
  ]);
});

test("undirected links draw continuous plain connectors after resizing", () => {
  for (const direction of ["TD", "TB", "BT", "LR", "RL"]) {
    const chart = parseFlowchart(
      `flowchart ${direction}\nA[Editor] --- B[Cache]`,
    );

    if (chart === null) throw new Error("expected a chart");

    for (const width of [24, 70]) {
      const drawing = drawFlowchart(chart, width);

      expect(drawing.filter((line) => line.trim() === "│")).toHaveLength(3);
      expect(drawing.join("\n")).not.toContain("▼");
      expect(drawing.join("\n")).not.toContain("→");
      expect(drawing.join("\n")).not.toContain("  —");
    }
  }
});

test("undirected fallback links keep their marker and labels", () => {
  const chart = parseFlowchart(
    "flowchart TD\nA --- B --> C\nA ---|pair| C\nC --- A\nA --- A",
  );

  if (chart === null) throw new Error("expected a chart");

  const drawing = drawFlowchart(chart, 40);

  expect(drawing).toContain("  — A — C  (pair)");
  expect(drawing).toContain("  — C — A");
  expect(drawing).toContain("  — A — A");
  expect(drawing.join("\n")).toContain("▼");
});

test("merging directed and undirected routes lists their distinct meanings", () => {
  const chart = parseFlowchart("flowchart TD\nA ---|peer| B\nA --> C");

  if (chart === null) throw new Error("expected a chart");

  const drawing = drawFlowchart(chart, 40);

  expect(drawing).toContain("  — A — B  (peer)");
  expect(drawing).toContain("  ⇢ A → C");
  expect(drawing.join("\n")).not.toContain("▼");
});

test("undirected labels draw beside connectors or fall back when crowded", () => {
  const chart = parseFlowchart("flowchart TD\nA ---|relation| B");

  if (chart === null) throw new Error("expected a chart");

  expect(drawFlowchart(chart, 40).join("\n")).toContain("│ relation");
  expect(drawFlowchart(chart, 16)).toContain("  — A — B  (rel…");
});
