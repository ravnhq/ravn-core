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

test("rewrites the active request off-chat and appends only the draft", async ($, on) => {
  let argv: readonly string[] = [];
  let filled: { text: string; mode: string } | undefined;
  let finish = () => {};

  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });

  on("process.run", async (_$, input) => {
    argv = input.argv;

    return {
      value: {
        exitCode: 0,
        stdout:
          "Private analysis\n<promptify-draft>My rewritten request</promptify-draft>",
        stderr: "",
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    };
  });
  on("prompt.read", async () => ({
    value: { text: "My existing text", cursor: 16 },
  }));
  on("prompt.fill", async (_$, input) => {
    filled = { text: input.text, mode: input.mode };

    return {
      isFilled: true,
      text: input.text,
      cursor: input.text.length,
    };
  });
  on("ui.toast", async () => ({ value: undefined }));
  on("command.register", async (_$, input) => ({
    value: { command: input.name },
  }));
  on("session.messages", async () => ({
    value: [{ role: "user", text: "Tighten the release check", toolUses: [] }],
  }));
  on("ui.invalidate", async () => {
    if (filled) finish();

    return { value: undefined };
  });
  on("session.start", async (_$, e) => ({ cwd: e.cwd }));
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

  await finished;
  expect(argv).toContain("--no-session-persistence");
  expect(argv).toContain("Read,Glob,Grep");
  expect(routed.text).toBeUndefined();
  expect(filled).toEqual({ text: "\n\nMy rewritten request", mode: "append" });
  expect(JSON.stringify(await $.ui.render(band))).not.toContain(
    "Rewriting your prompt",
  );
});
