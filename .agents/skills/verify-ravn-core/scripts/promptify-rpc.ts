import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
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

  const child = spawn(
    process.execPath,
    [
      script,
      "--mode",
      "rpc",
      "--no-session",
      "--no-skills",
      "--no-context-files",
      "--no-mcp",
      "--extension",
      extension,
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );

  let stderr = "";
  let editor: EditorProof | undefined;
  let agentRunStarted = false;
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk;
  });

  const lines = createInterface({ input: child.stdout });

  const completed = new Promise<RpcProof>((resolveProof, rejectProof) => {
    const timeout = setTimeout(
      () => rejectProof(new Error(`Pi RPC timed out. ${stderr}`)),
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
      }

      const promptResponse = promptResponseSchema.safeParse(value);

      if (!promptResponse.success) return;

      clearTimeout(timeout);

      if (!editor) {
        rejectProof(
          new Error("Pi handled /promptify without opening an editor"),
        );

        return;
      }

      resolveProof({ promptHandled: true, agentRunStarted, editor });
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
    child.kill();
  }
}

if (isMode("json") && process.argv.includes("-p")) {
  writeFixedHelperResponse();
} else if (isMode("rpc")) {
  await runPiCli();
} else {
  await driveRpc();
}
