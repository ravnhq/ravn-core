import { expect, test } from "claude-code/testing";
import type { Engine } from "claude-code/testing";
import type { On, RenderPropsOf } from "claude-code";

const PLUGIN = "explain-change";

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

// Every kind of fence the pane draws differently.
const FENCED_CODE = [
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
].join("\n");

const SURFACES = ["terminal", "desktop", "vscode", "mobile"] as const;

type Surface = (typeof SURFACES)[number];

// What the terminal hands a docked pane; a test overrides what it varies.
const PANE_PROPS: RenderPropsOf["Pane"] = {
  title: "Explain change",
  isFocused: true,
  bodyColumns: 60,
  placement: "dock",
  scroll: { offset: 0, bodyRows: 36 },
  view: {},
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

async function start($: Engine, on: On) {
  const opened = world(on);
  await $.session.start({
    cwd: "/work",
    surface: "terminal",
    isInteractive: true,
  });

  return opened;
}

// Draws the pane the way `surface` does: a tree it cannot draw rejects.
function mountPane(
  $: Engine,
  surface: Surface = "terminal",
  props: Partial<typeof PANE_PROPS> = {},
) {
  return $.ui.mount({
    plugin: PLUGIN,
    surface,
    component: "Pane",
    requestId: PLUGIN,
    viewport: { columns: 160, rows: 40 },
    props: { ...PANE_PROPS, ...props },
  });
}

type Pane = Awaited<ReturnType<typeof mountPane>>;

async function textOf(pane: Pane): Promise<string> {
  const elements = await pane.findAll({});

  return elements.map((element) => element.text).join("\n");
}

test("a show call opens the pane on the background section", async ($, on) => {
  const { opened } = await start($, on);

  const shown = await $.tool.call({ tool: TOOL, ...EXPLANATION });

  expect(shown.deny).toBeUndefined();
  expect(opened).toEqual([PLUGIN]);

  const pane = await mountPane($);

  expect(await pane.find({ text: EXPLANATION.title })).toBeDefined();
  expect(await pane.find({ text: EXPLANATION.background })).toBeDefined();
  expect(await pane.find({ text: EXPLANATION.code })).toBeUndefined();
});

test("the section buttons switch what the pane shows", async ($, on) => {
  await start($, on);
  await $.tool.call({ tool: TOOL, ...EXPLANATION });

  const pane = await mountPane($);
  await pane.press({ key: "section-2" });

  expect(await pane.find({ text: EXPLANATION.code })).toBeDefined();
  expect(await pane.find({ text: EXPLANATION.background })).toBeUndefined();
  expect((await pane.find({ key: "section-2" }))?.props.variant).toBe(
    "primary",
  );
});

test("picking a quiz answer reveals its feedback and the score", async ($, on) => {
  await start($, on);
  await $.tool.call({ tool: TOOL, ...EXPLANATION });

  const pane = await mountPane($);
  await pane.press({ key: "section-3" });

  expect(
    await pane.find({ text: "Right: the hash is unchanged." }),
  ).toBeUndefined();

  await pane.press({ key: "answer-0-1" });

  expect(
    await pane.find({ text: "Right: the hash is unchanged." }),
  ).toBeDefined();
  // Only the picked option's feedback shows, so the pane stays uncluttered.
  expect(await pane.find({ text: "The hash matches." })).toBeUndefined();
  expect(await pane.find({ text: "1 of 1 correct." })).toBeDefined();
  expect(
    await pane.find({ type: "Button", key: "answer-0-0" }),
  ).toBeUndefined();
});

test("a new explanation clears the previous quiz answers", async ($, on) => {
  await start($, on);
  await $.tool.call({ tool: TOOL, ...EXPLANATION });

  const pane = await mountPane($);
  await pane.press({ key: "section-3" });
  await pane.press({ key: "answer-0-0" });

  await $.tool.call({ tool: TOOL, ...EXPLANATION, title: "Second change" });

  expect(await pane.find({ text: "Second change" })).toBeDefined();
  expect(await pane.find({ text: EXPLANATION.background })).toBeDefined();

  await pane.press({ key: "section-3" });

  expect(await pane.find({ text: /0 of 1 answered/ })).toBeDefined();
  expect(await pane.find({ text: "The hash matches." })).toBeUndefined();
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
  expect(opened).toEqual([PLUGIN, PLUGIN]);
});

test("an inline pane suggests the fullscreen renderer; a docked one does not", async ($, on) => {
  await start($, on);
  await $.tool.call({ tool: TOOL, ...EXPLANATION });

  const docked = await mountPane($);

  expect(await docked.find({ text: /\/tui fullscreen/ })).toBeUndefined();

  await docked.unmount();

  const inline = await mountPane($, "terminal", { placement: "inline" });

  expect(await inline.find({ text: /\/tui fullscreen/ })).toBeDefined();
});

test("fences draw as highlighted code, coloured diffs, and accented diagrams", async ($, on) => {
  await start($, on);
  await $.tool.call({ tool: TOOL, ...EXPLANATION, code: FENCED_CODE });

  const pane = await mountPane($);
  await pane.press({ key: "section-2" });

  const code = await pane.findAll({ type: "Code" });

  expect(code.map((element) => element.props.language)).toEqual([
    "ts",
    "mermaid",
  ]);
  expect(code[0]?.text).toContain("const hit = cache.get(key);");
  expect(code[1]?.text).toContain("sequenceDiagram");
  // Diff lines are coloured by sign and clip at the pane edge like diagrams.
  expect(
    (await pane.find({ type: "Text", text: " save(a)" }))?.props,
  ).toMatchObject({ wrap: "truncate-end" });
  expect(
    (await pane.find({ type: "Text", text: "+  return cached" }))?.props,
  ).toMatchObject({ color: "success", wrap: "truncate-end" });
  expect(
    (await pane.find({ type: "Text", text: "-  write(a)" }))?.props,
  ).toMatchObject({ color: "error", wrap: "truncate-end" });

  const diagram = await pane.find({ type: "Text", text: "Cart --> Checkout" });

  expect(diagram?.props).toMatchObject({
    color: "suggestion",
    wrap: "truncate-end",
  });
  expect(await textOf(pane)).not.toContain("```");
});

test("a mermaid flowchart refits when the pane is resized", async ($, on) => {
  await start($, on);
  await $.tool.call({ tool: TOOL, ...EXPLANATION, code: FENCED_CODE });

  const pane = await mountPane($, "terminal", { bodyColumns: 80 });
  await pane.press({ key: "section-2" });

  const flow = { type: "Text", text: /Editor saves/ };
  const wide = (await pane.find(flow))?.text ?? "";

  await pane.redraw({ ...PANE_PROPS, bodyColumns: 30 });

  const narrow = (await pane.find(flow))?.text ?? "";

  expect(wide).toContain("Hash unchanged?");
  expect(wide).not.toContain("flowchart TD");
  expect(narrow).toContain("Editor saves");
  expect(narrow).not.toEqual(wide);

  for (const line of narrow.split("\n"))
    expect(line.length).toBeLessThanOrEqual(30);
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

  const pane = await mountPane($);

  expect(await pane.find({ text: "Cache[31m saves" })).toBeDefined();
  expect(
    await pane.find({ text: "Line one\nLine\ttwo]0;pwned" }),
  ).toBeDefined();
});

test("every section draws on every surface", async ($, on) => {
  await start($, on);
  await $.tool.call({ tool: TOOL, ...EXPLANATION, code: FENCED_CODE });

  for (const surface of SURFACES) {
    const pane = await mountPane($, surface);

    for (const section of [0, 1, 2, 3]) {
      await pane.press({ key: `section-${section}` });

      expect(await pane.find({ text: EXPLANATION.title })).toBeDefined();
    }

    // The session's state is shared, so the first surface answers for all.
    if (surface === "terminal") await pane.press({ key: "answer-0-1" });

    expect(await pane.find({ text: "1 of 1 correct." })).toBeDefined();

    await pane.press({ key: "section-0" });
    await pane.unmount();
  }
});
