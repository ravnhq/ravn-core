import { expect, test } from "claude-code/testing";

const command = {
  command: "promptify",
  args: "",
  origin: { kind: "composer" as const },
  presentation: { layout: "main" as const, isFullscreen: false, columns: 80 },
};

const band = {
  surface: "terminal" as const,
  component: "AbovePrompt" as const,
  requestId: "above-prompt",
  viewport: { columns: 100, rows: 30 },
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: true,
    maxRows: 10,
    bodyColumns: 95,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
};

test("passes the active request to a read-only child and reports spawn failure", async ($, on) => {
  let prompt = "";
  let tools: readonly string[] = [];

  on("agent.register", async (_$, spec) => {
    tools = spec.tools ?? [];
    expect(spec.background).toBe(true);

    return { value: { agent: "promptify:rewrite" } };
  });
  on("agent.spawn", async (_$, input) => {
    prompt = input.prompt;

    return { deny: "background work is disabled" };
  });
  on("command.register", async (_$, input) => ({
    value: { command: input.name },
  }));
  on("session.messages", async () => ({
    value: [{ role: "user", text: "Tighten the release check", toolUses: [] }],
  }));
  on("ui.invalidate", async () => ({ value: undefined }));
  on("session.start", async (_$, e) => ({ cwd: e.cwd }));
  on("turn.complete", async (_$, e) => ({ text: e.answer }));
  on("ui.render", async () => ({
    type: "Text",
    props: {},
    children: ["Stock"],
  }));

  await $.session.start({
    cwd: "/work",
    surface: "terminal",
    isInteractive: true,
  });
  const routed = await $.command.run(command);

  expect(tools.join(",")).toBe("Read,Glob,Grep");
  expect(prompt).toContain("Tighten the release check");
  expect(routed.text).toContain("background work is disabled");
  expect(JSON.stringify(await $.ui.render(band))).not.toContain("Insert draft");
});
