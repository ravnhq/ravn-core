import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { z } from "zod";

const draft = "deterministic rewrite";

const promptId = "promptify-verification";

const editorRequestSchema = z.object({
  type: z.literal("extension_ui_request"),
  id: z.string(),
  method: z.literal("editor"),
  title: z.string(),
  prefill: z.string().optional(),
});

const promptResponseSchema = z.object({
  type: z.literal("response"),
  id: z.literal(promptId),
  command: z.literal("prompt"),
  success: z.literal(true),
  data: z.object({ disposition: z.literal("handled") }),
});

const eventTypeSchema = z.object({ type: z.string() });

function isMode(mode: string): boolean {
  const index = process.argv.indexOf("--mode");

  return index >= 0 && process.argv[index + 1] === mode;
}

function writeFixedHelperResponse(): void {
  process.stdout.write(
    `${JSON.stringify({
      type: "message_end",
      message: {
        role: "assistant",
        content: [
          {
            type: "text",
            text: `<promptify-draft>${draft}</promptify-draft>`,
          },
        ],
        stopReason: "stop",
      },
    })}\n`,
  );
}

async function runPiCli(): Promise<void> {
  const cli = new URL(
    "./bundle/cli.js",
    import.meta.resolve("@earendil-works/pi-coding-agent"),
  );

  await import(cli.href);
}

interface EditorProof {
  readonly method: "editor";
  readonly title: string;
  readonly prefill: string | undefined;
}

interface RpcProof {
  readonly promptHandled: true;
  readonly agentRunStarted: boolean;
  readonly editor: EditorProof;
}

async function driveRpc(): Promise<void> {
  const script = process.argv[1];
  assert(script, "Node did not expose the verification script path");

  const extension = resolve("plugins/agent/ravn-core/pi/promptify.ts");

  const agentDir = mkdtempSync(join(tmpdir(), "ravn-promptify-rpc-"));

  const child = spawn(
    process.execPath,
    [
      script,
      "--mode",
      "rpc",
      "--no-session",
      "--no-extensions",
      "--no-skills",
      "--no-context-files",
      "--no-mcp",
      "--extension",
      extension,
    ],
    {
      env: { ...process.env, PI_CODING_AGENT_DIR: agentDir },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  let stderr = "";
  let editor: EditorProof | undefined;
  let agentRunStarted = false;
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk;
  });

  const lines = createInterface({ input: child.stdout });

  const completed = new Promise<RpcProof>((resolveProof, rejectProof) => {
    let promptHandled = false;

    const timeout = setTimeout(
      () =>
        rejectProof(new Error(`Pi RPC did not deliver the draft. ${stderr}`)),
      10_000,
    );

    lines.on("line", (line) => {
      let value: unknown;

      try {
        value = JSON.parse(line);
      } catch {
        return;
      }

      const eventType = eventTypeSchema.safeParse(value);

      if (eventType.success && eventType.data.type === "agent_start")
        agentRunStarted = true;

      const editorRequest = editorRequestSchema.safeParse(value);

      if (editorRequest.success) {
        clearTimeout(timeout);

        if (!promptHandled) {
          rejectProof(
            new Error("Pi opened the editor before acknowledging /promptify"),
          );

          return;
        }

        editor = {
          method: editorRequest.data.method,
          title: editorRequest.data.title,
          prefill: editorRequest.data.prefill,
        };
        child.stdin.write(
          `${JSON.stringify({
            type: "extension_ui_response",
            id: editorRequest.data.id,
            value: editorRequest.data.prefill ?? "",
          })}\n`,
        );
        resolveProof({ promptHandled, agentRunStarted, editor });
      }

      const promptResponse = promptResponseSchema.safeParse(value);

      if (promptResponse.success) promptHandled = true;
    });

    child.once("error", rejectProof);
    child.once("exit", (code, signal) => {
      if (code === 0 || child.stdin.destroyed) return;
      clearTimeout(timeout);
      rejectProof(
        new Error(`Pi RPC exited before proof (${signal ?? code}). ${stderr}`),
      );
    });
  });

  child.stdin.write(
    `${JSON.stringify({
      id: promptId,
      type: "prompt",
      message: "/promptify original",
    })}\n`,
  );

  try {
    const proof = await completed;
    assert.equal(proof.agentRunStarted, false);
    assert.deepEqual(proof.editor, {
      method: "editor",
      title: "Promptify draft",
      prefill: draft,
    });
    process.stdout.write(`${JSON.stringify(proof)}\n`);
  } finally {
    lines.close();
    child.stdin.end();

    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await once(child, "exit");
    }

    rmSync(agentDir, { force: true, recursive: true });
  }
}

if (isMode("json") && process.argv.includes("-p")) {
  writeFixedHelperResponse();
} else if (isMode("rpc")) {
  await runPiCli();
} else {
  await driveRpc();
}
