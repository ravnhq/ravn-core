import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  cursorChildEnv,
  cursorLaunchArgs,
  parseEvents,
  replyText,
  resultError,
  skillCallsFrom,
} from "../../evals/providers/cursor.ts";
import { provider } from "../../evals/skill-eval.ts";
import { cursorPluginDir } from "../../evals/workspace-repo.ts";

const readSkill = (path: string, callId: string, failed = false) =>
  [
    JSON.stringify({
      type: "tool_call",
      subtype: "started",
      call_id: callId,
      tool_call: { readToolCall: { args: { path } } },
    }),
    JSON.stringify({
      type: "tool_call",
      subtype: "completed",
      call_id: callId,
      tool_call: {
        readToolCall: {
          args: { path },
          result: failed ? { error: { message: "missing" } } : { success: {} },
        },
      },
    }),
  ].join("\n");

test("cursor launch args load the local plugin and pin the model", (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "cursor-args-"));

  t.after(() => rmSync(workspace, { recursive: true, force: true }));

  const pluginDir = cursorPluginDir(workspace);

  mkdirSync(join(pluginDir, ".cursor-plugin"), { recursive: true });

  writeFileSync(
    join(pluginDir, ".cursor-plugin", "plugin.json"),
    '{ "name": "ravn-core" }\n',
  );

  const args = cursorLaunchArgs("composer-2.5", workspace, "/greet please");

  assert.deepEqual(args.slice(0, 4), [
    "--disable-auto-update",
    "--print",
    "--force",
    "--trust",
  ]);
  assert.ok(args.includes("--sandbox"));
  assert.equal(args[args.indexOf("--sandbox") + 1], "disabled");
  assert.equal(args[args.indexOf("--model") + 1], "composer-2.5");
  assert.equal(args[args.indexOf("--plugin-dir") + 1], pluginDir);
  assert.equal(args.at(-1), "/greet please");
});

test("cursor launch args throw when the arm has no plugin directory", () => {
  assert.throws(
    () =>
      cursorLaunchArgs(
        "composer-2.5",
        join(tmpdir(), "missing-cursor-plugin"),
        "hello",
      ),
    /Cursor plugin directory is missing/,
  );
});

test("cursor child env keeps the API key and drops other tokens", (t) => {
  const previous = {
    CURSOR_API_KEY: process.env.CURSOR_API_KEY,
    GH_TOKEN: process.env.GH_TOKEN,
  };

  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  process.env.CURSOR_API_KEY = "cursor-key";
  process.env.GH_TOKEN = "github-token";

  const env = cursorChildEnv("/isolated/home");

  assert.equal(env.HOME, "/isolated/home");
  assert.equal(env.CURSOR_API_KEY, "cursor-key");
  assert.equal("GH_TOKEN" in env, false);
});

test("skill calls come from SKILL.md tool paths and ignore failed reads", () => {
  const stdout = [
    JSON.stringify({
      type: "system",
      subtype: "init",
      model: "Composer 2.5",
    }),
    readSkill(".cursor/plugins/ravn-core/skills/greet/SKILL.md", "read-greet"),
    readSkill(
      ".cursor/plugins/ravn-core/skills/greet-explicit/SKILL.md",
      "read-explicit",
      true,
    ),
    JSON.stringify({
      type: "tool_call",
      subtype: "completed",
      call_id: "shell-only",
      tool_call: {
        shellToolCall: {
          args: {
            command: "cat .cursor/plugins/ravn-core/skills/how/SKILL.md",
          },
          result: { success: { exitCode: 0 } },
        },
      },
    }),
    JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Hello, I can help." }],
      },
    }),
    JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      result: "Hello, I can help.",
    }),
  ].join("\n");

  const events = parseEvents(stdout);

  assert.deepEqual(
    skillCallsFrom(events).map((call) => ({
      name: call.name,
      is_error: call.is_error,
    })),
    [
      { name: "greet", is_error: false },
      { name: "greet-explicit", is_error: true },
      { name: "how", is_error: false },
    ],
  );

  assert.equal(replyText(events), "Hello, I can help.");
  assert.equal(resultError(events), undefined);
});

test("a cursor result error is reported", () => {
  const events = parseEvents(
    `${JSON.stringify({
      type: "result",
      subtype: "error",
      is_error: true,
      result: "boom",
    })}\n`,
  );

  assert.equal(resultError(events), "cursor-agent result error: boom");
});

test("a cursor provider throws when CURSOR_API_KEY is unset", () => {
  const previous = {
    RAVN_EVALS_WORKSPACES: process.env.RAVN_EVALS_WORKSPACES,
    RAVN_EVALS_HOME: process.env.RAVN_EVALS_HOME,
    CURSOR_API_KEY: process.env.CURSOR_API_KEY,
  };

  process.env.RAVN_EVALS_WORKSPACES = "/workspaces";
  process.env.RAVN_EVALS_HOME = "/home";
  delete process.env.CURSOR_API_KEY;

  try {
    assert.throws(
      () =>
        provider("repo-a", "current", {
          harness: "cursor",
          model: "composer-2.5",
        }),
      /CURSOR_API_KEY is unset/,
    );

    const pi = provider("repo-a", "current", {
      harness: "pi",
      model: "openai/gpt-6-luna",
    });

    assert.match(String(pi.id), /providers\/pi\.ts$/);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("the cursor provider points at cursor-agent and the workspace", () => {
  const previous = {
    RAVN_EVALS_WORKSPACES: process.env.RAVN_EVALS_WORKSPACES,
    RAVN_EVALS_HOME: process.env.RAVN_EVALS_HOME,
    CURSOR_API_KEY: process.env.CURSOR_API_KEY,
  };

  process.env.RAVN_EVALS_WORKSPACES = "/workspaces";
  process.env.RAVN_EVALS_HOME = "/home";
  process.env.CURSOR_API_KEY = "cursor-key";

  try {
    const cursor = provider("repo-a", "current", {
      harness: "cursor",
      model: "composer-2.5",
    });

    assert.match(String(cursor.id), /providers\/cursor\.ts$/);
    assert.equal(cursor.config.model, "composer-2.5");
    assert.equal(
      cursor.config.working_dir,
      join("/workspaces", "repo-a", "current"),
    );
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
