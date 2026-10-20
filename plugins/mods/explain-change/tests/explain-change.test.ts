import { expect, test } from "claude-code/testing";
import type { Engine } from "claude-code/testing";
import type { On } from "claude-code";

const TOOL = "mcp__explain-change__show";

const EXPLANATION = {
  title: "Cache saves by content hash",
  summary: "Saving unchanged content now returns the cached result.",
  background: "The editor writes every save to disk.",
  intuition: "```text\nsave(a) -> write\nsave(a) -> cached\n```",
  code: "`src/save.ts:12` hashes the content before writing.",
  quiz: [
    {
      question: "What does a second save of identical content do?",
      options: [
        {
          text: "Writes again",
          isCorrect: false,
          feedback: "The hash matches.",
        },
        {
          text: "Returns the cached result",
          isCorrect: true,
          feedback: "Right: the hash is unchanged.",
        },
      ],
    },
  ],
};

const pane = {
  surface: "terminal" as const,
  component: "Pane" as const,
  requestId: "explain-change",
  viewport: { columns: 160, rows: 40 },
  props: {
    title: "Explain change",
    isFocused: true,
    bodyColumns: 60,
    placement: "dock" as const,
    scroll: { offset: 0, bodyRows: 36 },
    view: {},
  },
};

function world(on: On) {
  const opened: string[] = [];

  on("session.start", async (_$, e) => ({ cwd: e.cwd }));
  on("tool.register", async (_$, e) => ({ value: { tool: e.name } }));
  on("command.register", async (_$, e) => ({ value: { command: e.name } }));
  on("ui.open", async (_$, e) => {
    opened.push(e.id);

    return { value: { isPlaced: true } };
  });

  return { opened };
}

const sessionStart = {
  cwd: "/work",
  surface: "terminal" as const,
  isInteractive: true,
};

async function start($: Engine, on: On) {
  const opened = world(on);
  await $.session.start(sessionStart);

  return opened;
}

// The pane's tree as JSON, so a test can check what it draws.
async function draw(
  $: Engine,
  placement: "dock" | "inline" = "dock",
  bodyColumns = pane.props.bodyColumns,
) {
  return JSON.stringify(
    await $.ui.render({
      ...pane,
      props: { ...pane.props, placement, bodyColumns },
    }),
  );
}

test("a show call opens the pane on the background section", async ($, on) => {
  const { opened } = await start($, on);

  const shown = await $.tool.call({ tool: TOOL, ...EXPLANATION });

  expect(shown.deny).toBeUndefined();
  expect(opened).toEqual(["explain-change"]);

  const drawn = await draw($);
  expect(drawn).toContain(EXPLANATION.title);
  expect(drawn).toContain(EXPLANATION.background);
  expect(drawn).not.toContain(EXPLANATION.code);
});

test("the section buttons switch what the pane shows", async ($, on) => {
  await start($, on);
  await $.tool.call({ tool: TOOL, ...EXPLANATION });
  await $.ui.render(pane);

  await $.ui.press({ plugin: "explain-change", key: "section-2" });

  const drawn = await draw($);
  expect(drawn).toContain(EXPLANATION.code);
  expect(drawn).not.toContain(EXPLANATION.background);
});

test("picking a quiz answer reveals every option's feedback and the score", async ($, on) => {
  await start($, on);
  await $.tool.call({ tool: TOOL, ...EXPLANATION });
  await $.ui.render(pane);
  await $.ui.press({ plugin: "explain-change", key: "section-3" });

  const before = await draw($);
  expect(before).toContain(EXPLANATION.quiz[0]!.question);
  expect(before).not.toContain("Right: the hash is unchanged.");
  expect(before).not.toContain("The hash matches.");

  await $.ui.press({ plugin: "explain-change", key: "answer-0-1" });

  const after = await draw($);
  expect(after).toContain("Right: the hash is unchanged.");
  expect(after).toContain("The hash matches.");
  expect(after).toContain("Correct");
  expect(after).toContain("1 of 1 correct.");
});

test("a new explanation clears the previous quiz answers", async ($, on) => {
  await start($, on);
  await $.tool.call({ tool: TOOL, ...EXPLANATION });
  await $.ui.render(pane);
  await $.ui.press({ plugin: "explain-change", key: "section-3" });
  await $.ui.render(pane);
  await $.ui.press({ plugin: "explain-change", key: "answer-0-0" });

  await $.tool.call({ tool: TOOL, ...EXPLANATION, title: "Second change" });

  const drawn = await draw($);
  expect(drawn).toContain("Second change");
  expect(drawn).toContain(EXPLANATION.background);

  await $.ui.press({ plugin: "explain-change", key: "section-3" });

  const quiz = await draw($);
  expect(quiz).toContain("0 of 1 answered.");
  expect(quiz).not.toContain("The hash matches.");
});

test("a wrong pick reveals the correct and unpicked feedback", async ($, on) => {
  await start($, on);
  await $.tool.call({
    tool: TOOL,
    ...EXPLANATION,
    quiz: [
      {
        ...EXPLANATION.quiz[0],
        options: [
          ...EXPLANATION.quiz[0]!.options,
          { text: "Deletes it", isCorrect: false, feedback: "No data is lost." },
        ],
      },
    ],
  });
  await $.ui.render(pane);
  await $.ui.press({ plugin: "explain-change", key: "section-3" });
  await $.ui.render(pane);
  await $.ui.press({ plugin: "explain-change", key: "answer-0-0" });

  const drawn = await draw($);

  expect(drawn).toContain("Not quite");
  expect(drawn).toContain("The hash matches.");
  expect(drawn).toContain("Right: the hash is unchanged.");
  expect(drawn).toContain('"dimColor":true},"children":["No data is lost."]');
  expect(drawn).toContain("0 of 1 correct.");
});

test("a malformed call is denied and leaves the pane closed", async ($, on) => {
  const { opened } = await start($, on);

  const twoCorrect = {
    ...EXPLANATION,
    quiz: [
      {
        question: "Which?",
        options: [
          { text: "A", isCorrect: true, feedback: "a" },
          { text: "B", isCorrect: true, feedback: "b" },
        ],
      },
    ],
  };

  const missing = await $.tool.call({ tool: TOOL, ...EXPLANATION, code: "" });
  const ambiguous = await $.tool.call({ tool: TOOL, ...twoCorrect });

  expect(missing.deny).toContain("code");
  expect(ambiguous.deny).toContain("quiz[0]");
  expect(opened).toEqual([]);
});

test("the reopen command opens the pane only once there is an explanation", async ($, on) => {
  const { opened } = await start($, on);

  const run = {
    command: "explain-change-pane",
    args: "",
    origin: { kind: "composer" as const },
    presentation: { layout: "main" as const, isFullscreen: true, columns: 160 },
  };

  await $.command.run(run);
  expect(opened).toEqual([]);

  await $.tool.call({ tool: TOOL, ...EXPLANATION });
  await $.command.run(run);
  expect(opened).toEqual(["explain-change", "explain-change"]);
});

test("an inline pane suggests the fullscreen renderer; a docked one does not", async ($, on) => {
  await start($, on);
  await $.tool.call({ tool: TOOL, ...EXPLANATION });

  const docked = await draw($);

  const inline = await draw($, "inline");

  expect(docked).not.toContain("/tui fullscreen");
  expect(inline).toContain("/tui fullscreen");
});

test("fences draw as highlighted code, coloured diffs, and accented diagrams", async ($, on) => {
  await start($, on);
  await $.tool.call({
    tool: TOOL,
    ...EXPLANATION,
    code: [
      "Intro prose.",
      "```ts",
      "const hit = cache.get(key);",
      "```",
      "```diff",
      " save(a)",
      "+  return cached",
      "-  write(a)",
      "```",
      "```text",
      "Cart --> Checkout",
      "```",
      "```ts",
      "unclosed fence stays prose",
    ].join("\n"),
  });
  await $.ui.render(pane);
  await $.ui.press({ plugin: "explain-change", key: "section-2" });

  const drawn = await draw($);

  expect(drawn).toContain(
    '"type":"Code","props":{"source":"const hit = cache.get(key);","language":"ts"}',
  );
  expect(drawn).toContain('"wrap":"truncate-end"},"children":[" save(a)"]');
  expect(drawn).toContain(
    '"color":"success","wrap":"truncate-end"},"children":["+  return cached"]',
  );
  expect(drawn).toContain(
    '"color":"error","wrap":"truncate-end"},"children":["-  write(a)"]',
  );
  expect(drawn).toContain(
    '"color":"suggestion","wrap":"truncate-end"},"children":["Cart --> Checkout"]',
  );
  expect(drawn).toContain("unclosed fence stays prose");
  expect(drawn).not.toContain("```diff");
});

test("a mermaid flowchart is laid out to the pane's width, and refits when it changes", async ($, on) => {
  await start($, on);
  await $.tool.call({
    tool: TOOL,
    ...EXPLANATION,
    code: [
      "```mermaid",
      "flowchart TD",
      "  A[Editor saves] --> B{Hash unchanged?}",
      "  B -- yes --> C[Return cached]",
      "  B -- no --> D[Write to disk]",
      "```",
      "```mermaid",
      "sequenceDiagram",
      "  A->>B: hi",
      "```",
    ].join("\n"),
  });
  await $.ui.render(pane);
  await $.ui.press({ plugin: "explain-change", key: "section-2" });

  const wide = await draw($, "dock", 80);
  const narrow = await draw($, "dock", 30);

  expect(wide).toContain("Editor saves");
  expect(wide).toContain("┌");
  expect(wide).not.toContain("flowchart TD");
  expect(narrow).toContain("Editor saves");
  expect(narrow).not.toEqual(wide);
  // Mermaid it cannot lay out stays as source.
  expect(wide).toContain('"language":"mermaid"');
  expect(wide).toContain("sequenceDiagram");
});

test("control characters in the lesson are stripped before the pane draws it", async ($, on) => {
  await start($, on);

  const shown = await $.tool.call({
    tool: TOOL,
    ...EXPLANATION,
    title: "Cache\u001b[31m saves\u0007",
    background: "Line one\nLine\ttwo\u001b]0;pwned\u0007",
  });

  expect(shown.deny).toBeUndefined();

  const drawn = await draw($);
  expect(drawn).toContain("Cache[31m saves");
  expect(drawn).toContain("Line one\\nLine\\ttwo]0;pwned");
  expect(drawn).not.toContain("\\u001b");
  expect(drawn).not.toContain("\\u0007");
});
