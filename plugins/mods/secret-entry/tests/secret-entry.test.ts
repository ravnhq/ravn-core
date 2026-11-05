// The kit settles single-shot flows deterministically; a held entry with a
// live poll loop does not settle reliably under `claude plugin test`, so the
// interactive flow (masked field, Enter, Write, Cancel) is verified in a real
// session, and these tests cover what the kit does prove: the gating on
// Write and Edit, and the refusal paths. The marker transforms, masking map,
// dotenv patching, Edit application, and redaction are covered by
// tests/entry.test.ts.

import { expect, test } from "claude-code/testing";

test("a marker-less Write runs as it would without the mod", async ($, on) => {
  on("session.start", async (_$, e) => ({ cwd: e.cwd }));
  on("tool.register", async (_$, e) => ({ value: { tool: e.name } }));
  on("command.register", async (_$, e) => ({ value: { command: e.name } }));
  on("tool.call", { tool: ["Write", "Edit"] }, async () => ({
    result: "the engine wrote it",
  }));

  await $.session.start({
    cwd: "/work",
    surface: "terminal",
    isInteractive: true,
  });

  const result = await $.tool.call({
    tool: "Write",
    file_path: "plain.txt",
    content: "no secrets here",
  });

  expect(String(result.result)).toBe("the engine wrote it");
});

test("a non-interactive session refuses instead of holding", async ($, on) => {
  on("session.start", async (_$, e) => ({ cwd: e.cwd }));
  on("tool.register", async (_$, e) => ({ value: { tool: e.name } }));
  on("command.register", async (_$, e) => ({ value: { command: e.name } }));

  await $.session.start({
    cwd: "/work",
    surface: "terminal",
    isInteractive: false,
  });

  const result = await $.tool.call({
    tool: "Write",
    file_path: ".env",
    content: "{{secret:X}}",
  });

  // No pane opened and nothing was written: the refusal names the reason.
  expect(String(result.deny)).toContain("no one to ask");
  expect(String(result.deny)).toContain("placeholders");
});
