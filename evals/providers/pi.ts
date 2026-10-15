import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { ApiProvider, ProviderOptions, ProviderResponse } from "promptfoo";
import { z } from "zod";

const piMessageSchema = z.object({
  role: z.string(),
  content: z
    .array(z.object({ type: z.string(), text: z.string().optional() }))
    .or(z.string().transform((text) => [{ type: "text", text }])),
  stopReason: z.string().optional(),
  errorMessage: z.string().optional(),
});

const piEventSchema = z.union([
  z.object({
    type: z.literal("tool_execution_start"),
    toolCallId: z.string(),
    args: z.record(z.string(), z.json()),
  }),
  z.object({
    type: z.literal("tool_execution_end"),
    toolCallId: z.string(),
    isError: z.boolean(),
  }),
  z.object({ type: z.literal("message_end"), message: piMessageSchema }),
  z.object({ type: z.literal("agent_settled") }),
  z.object({ type: z.string() }).transform(() => ({ type: "other" as const })),
]);

type PiEvent = z.infer<typeof piEventSchema>;

type PiMessage = z.infer<typeof piMessageSchema>;

type SkillCall = {
  name: string;
  path: string;
  source: "tool";
  is_error: boolean;
};

type PiRun = { exitCode: number; stdout: string; stderr: string };

const skillFilePattern = /[^"'\s]*SKILL\.md/g;

const failedStopReasons = new Set(["error", "aborted"]);

function parseEvents(stdout: string): PiEvent[] {
  return stdout
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => piEventSchema.parse(JSON.parse(line)));
}

function failedToolCallIds(events: PiEvent[]): Set<string> {
  return new Set(
    events.flatMap((event) =>
      event.type === "tool_execution_end" && event.isError
        ? [event.toolCallId]
        : [],
    ),
  );
}

function skillCallsFrom(events: PiEvent[]): SkillCall[] {
  const failedIds = failedToolCallIds(events);

  return events.flatMap((event) => {
    if (event.type !== "tool_execution_start") {
      return [];
    }

    const paths = JSON.stringify(event.args).match(skillFilePattern) ?? [];

    return paths.map((path) => ({
      name: basename(dirname(path)),
      path,
      source: "tool" as const,
      is_error: failedIds.has(event.toolCallId),
    }));
  });
}

function finalReply(events: PiEvent[]): PiMessage | undefined {
  return events
    .flatMap((event) =>
      event.type === "message_end" && event.message.role === "assistant"
        ? [event.message]
        : [],
    )
    .at(-1);
}

function textOf(message: PiMessage): string {
  return message.content
    .flatMap((part) => (part.type === "text" && part.text ? [part.text] : []))
    .join("\n");
}

const piEnvNames = ["PATH", "HOME", "TMPDIR", "LANG", "PI_CODING_AGENT_DIR"];

function piEnv(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    piEnvNames.flatMap((name) => {
      const value = process.env[name];

      return value === undefined ? [] : [[name, value]];
    }),
  );
}

function runPi(args: string[], cwd: string): Promise<PiRun> {
  return new Promise((done, fail) => {
    const child = spawn("pi", args, {
      cwd,
      env: piEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", fail);
    child.on("close", (exitCode) =>
      done({ exitCode: exitCode ?? 1, stdout, stderr }),
    );
  });
}

export default class PiProvider implements ApiProvider {
  label?: string;
  private readonly providerId: string;
  private readonly model: string;
  private readonly workingDir: string;

  constructor(options: ProviderOptions) {
    this.providerId = options.id ?? "pi";
    this.model = String(options.config?.model);
    this.workingDir = resolve(
      String(options.config?.basePath ?? process.cwd()),
      String(options.config?.working_dir),
    );
  }

  id(): string {
    return this.providerId;
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    const skillsDir = join(this.workingDir, ".agents", "skills");

    const skillArgs = readdirSync(skillsDir).flatMap((skill) => [
      "--skill",
      join(skillsDir, skill),
    ]);

    const run = await runPi(
      [
        "--mode",
        "json",
        "--no-session",
        "--no-extensions",
        "--no-skills",
        "--no-context-files",
        "--no-prompt-templates",
        "--model",
        this.model,
        ...skillArgs,
        prompt,
      ],
      this.workingDir,
    );

    if (run.exitCode !== 0) {
      return { error: `pi exited with ${run.exitCode}: ${run.stderr.trim()}` };
    }

    const events = parseEvents(run.stdout);

    const reply = finalReply(events);

    if (!events.some((event) => event.type === "agent_settled")) {
      return { error: "pi exited before agent_settled" };
    }

    if (reply === undefined) {
      return { error: "pi produced no assistant reply" };
    }

    if (failedStopReasons.has(reply.stopReason ?? "")) {
      return {
        error: `pi reply ${reply.stopReason}: ${reply.errorMessage ?? ""}`,
      };
    }

    return {
      output: textOf(reply),
      metadata: { skillCalls: skillCallsFrom(events) },
    };
  }
}
