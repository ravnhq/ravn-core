import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { z } from "zod";

import { createPiPromptifySurface } from "../../../../plugins/agent/ravn-core/pi/promptify-surface.ts";
import { presentPromptify } from "../../../../plugins/agent/ravn-core/promptify/engine.ts";

const draft = "deterministic rewrite";

const customType = "promptify-event-verification";

const promptId = "promptify-event-verification";

const eventTypeSchema = z.object({ type: z.string() });

const promptResponseSchema = z.object({
  type: z.literal("response"),
  id: z.literal(promptId),
  success: z.literal(true),
  data: z.object({ disposition: z.literal("handled") }),
});

const customMessageSchema = z.object({
  type: z.literal("message_start"),
  message: z.object({
    role: z.literal("custom"),
    customType: z.literal(customType),
    content: z.literal(draft),
  }),
});

export default function promptifyEventVerification(pi: ExtensionAPI): void {
  pi.registerCommand("promptify-event-verification", {
    description: "Verify deferred Promptify event delivery",
    handler: async (_args, ctx) => {
      await presentPromptify({
        result: {
          request: "original",
          draft,
          answer: `<promptify-draft>${draft}</promptify-draft>`,
        },
        surface: createPiPromptifySurface({
          mode: ctx.mode,
          hasUI: false,
          ui: ctx.ui,
          pi,
          customType,
        }),
      });
    },
  });
}

interface Proof {
  readonly promptHandled: boolean;
  readonly customMessage: boolean;
  readonly agentRunStarted: boolean;
}

async function driveRpc(): Promise<void> {
  const cli = fileURLToPath(
    new URL(
      "./bundle/cli.js",
      import.meta.resolve("@earendil-works/pi-coding-agent"),
    ),
  );

  const extension = fileURLToPath(import.meta.url);

  const agentDir = mkdtempSync(join(tmpdir(), "ravn-promptify-event-"));

  const child = spawn(
    process.execPath,
    [
      cli,
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
  let promptHandled = false;
  let customMessage = false;
  let agentRunStarted = false;

  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk;
  });

  const lines = createInterface({ input: child.stdout });

  const completed = new Promise<Proof>((resolveProof, rejectProof) => {
    const timeout = setTimeout(
      () => rejectProof(new Error(`Pi RPC timed out. ${stderr}`)),
      10_000,
    );

    const finish = () => {
      if (!promptHandled || !customMessage) return;

      clearTimeout(timeout);
      resolveProof({ promptHandled, customMessage, agentRunStarted });
    };

    lines.on("line", (line) => {
      let event: unknown;

      try {
        event = JSON.parse(line);
      } catch {
        return;
      }

      const eventType = eventTypeSchema.safeParse(event);

      if (eventType.success && eventType.data.type === "agent_start")
        agentRunStarted = true;

      if (promptResponseSchema.safeParse(event).success) promptHandled = true;

      if (customMessageSchema.safeParse(event).success) customMessage = true;

      finish();
    });

    child.once("error", rejectProof);
    child.once("exit", (code, signal) => {
      if (promptHandled && customMessage) return;

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
      message: "/promptify-event-verification",
    })}\n`,
  );

  try {
    const proof = await completed;

    assert.equal(proof.agentRunStarted, false);
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

if (process.argv[1] === fileURLToPath(import.meta.url)) await driveRpc();
