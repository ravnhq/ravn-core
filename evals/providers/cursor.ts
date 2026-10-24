import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { ApiProvider, ProviderOptions, ProviderResponse } from "promptfoo";
import { z } from "zod";
import { cursorPluginDir } from "../workspace-repo.ts";

const textPartSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
});

const assistantSchema = z.object({
  type: z.literal("assistant"),
  message: z.object({
    role: z.string(),
    content: z.array(textPartSchema),
  }),
});

const toolResultSchema = z.object({
  result: z
    .object({
      success: z.json().optional(),
      error: z.json().optional(),
    })
    .optional(),
});

const toolCallSchema = z.object({
  type: z.literal("tool_call"),
  subtype: z.string(),
  call_id: z.string(),
  tool_call: z.record(z.string(), z.json()),
});

const resultSchema = z.object({
  type: z.literal("result"),
  subtype: z.string(),
  is_error: z.boolean().optional(),
  result: z.string().optional(),
});

const cursorEventSchema = z.union([
  assistantSchema,
  toolCallSchema,
  resultSchema,
  z.object({ type: z.string() }).transform(() => ({ type: "other" as const })),
]);

type CursorEvent = z.infer<typeof cursorEventSchema>;

type ToolCallEvent = z.infer<typeof toolCallSchema>;

type SkillCall = {
  name: string;
  path: string;
  source: "tool";
  is_error: boolean;
};

type CursorRun = { exitCode: number; stdout: string; stderr: string };

const skillFilePattern = /[^"'\s]*SKILL\.md/g;

const cursorEnvNames = [
  "PATH",
  "TMPDIR",
  "LANG",
  "LC_ALL",
  "CURSOR_API_KEY",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "NODE_EXTRA_CA_CERTS",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
];

export function parseEvents(stdout: string): CursorEvent[] {
  return stdout.split("\n").flatMap((line) => {
    if (line.trim() === "") return [];

    return [cursorEventSchema.parse(JSON.parse(line))];
  });
}

function toolCallFailed(event: ToolCallEvent): boolean {
  if (event.subtype !== "completed") return false;

  for (const value of Object.values(event.tool_call)) {
    const parsed = toolResultSchema.safeParse(value);

    if (!parsed.success || parsed.data.result === undefined) continue;

    return parsed.data.result.success === undefined;
  }

  return false;
}

// stream-json reports each tool call twice. A path inside either event counts,
// and a completed call without `result.success` is a failed read.
export function skillCallsFrom(events: CursorEvent[]): SkillCall[] {
  const failedIds = new Set(
    events.flatMap((event) =>
      event.type === "tool_call" && toolCallFailed(event)
        ? [event.call_id]
        : [],
    ),
  );

  const seen = new Set<string>();

  return events.flatMap((event) => {
    if (event.type !== "tool_call" || seen.has(event.call_id)) return [];

    if (event.subtype !== "started" && event.subtype !== "completed") {
      return [];
    }

    seen.add(event.call_id);

    const paths = JSON.stringify(event.tool_call).match(skillFilePattern) ?? [];

    return paths.map((path) => ({
      name: basename(dirname(path)),
      path,
      source: "tool" as const,
      is_error: failedIds.has(event.call_id),
    }));
  });
}

function textOf(message: z.infer<typeof assistantSchema>["message"]): string {
  return message.content
    .flatMap((part) => (part.type === "text" && part.text ? [part.text] : []))
    .join("\n");
}

export function replyText(events: CursorEvent[]): string | undefined {
  const replies = events.flatMap((event) =>
    event.type === "assistant" && event.message.role === "assistant"
      ? [textOf(event.message)]
      : [],
  );

  const last = replies.at(-1);

  if (last !== undefined && last !== "") return last;

  const result = events.findLast((event) => event.type === "result");

  return result?.type === "result" ? result.result : undefined;
}

export function resultError(events: CursorEvent[]): string | undefined {
  const result = events.findLast((event) => event.type === "result");

  if (result === undefined || result.type !== "result") {
    return "cursor-agent exited before a result";
  }

  if (result.is_error === true || result.subtype !== "success") {
    return `cursor-agent result ${result.subtype}: ${result.result ?? ""}`;
  }

  return undefined;
}

export function cursorChildEnv(home: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { HOME: home };

  for (const name of cursorEnvNames) {
    const value = process.env[name];

    if (value !== undefined) env[name] = value;
  }

  return env;
}

// `--sandbox disabled` matches Codex `danger-full-access`: the sandbox keeps
// `.git` read-only, and skills under test commit there. `--plugin-dir` is how
// Cursor loads a local plugin such as `plugins/agent/ravn-core`.
export function cursorLaunchArgs(
  model: string,
  workingDir: string,
  prompt: string,
): string[] {
  const args = [
    "--disable-auto-update",
    "--print",
    "--force",
    "--trust",
    "--sandbox",
    "disabled",
    "--output-format",
    "stream-json",
    "--model",
    model,
    "--workspace",
    workingDir,
  ];

  const pluginDir = cursorPluginDir(workingDir);

  if (existsSync(join(pluginDir, ".cursor-plugin", "plugin.json"))) {
    args.push("--plugin-dir", pluginDir);
  }

  args.push(prompt);

  return args;
}

function runCursor(
  args: string[],
  cwd: string,
  home: string,
): Promise<CursorRun> {
  return new Promise((done, fail) => {
    const child = spawn("cursor-agent", args, {
      cwd,
      env: cursorChildEnv(home),
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

export default class CursorProvider implements ApiProvider {
  label?: string;
  private readonly providerId: string;
  private readonly model: string;
  private readonly workingDir: string;

  constructor(options: ProviderOptions) {
    this.providerId = options.id ?? "cursor";
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
    const home = process.env.RAVN_EVALS_HOME;

    if (home === undefined || home === "") {
      return {
        error: "RAVN_EVALS_HOME is unset; run evals through `pnpm eval`.",
      };
    }

    if (!process.env.CURSOR_API_KEY) {
      return {
        error:
          "CURSOR_API_KEY is unset. Create a user API key in the Cursor dashboard and export it.",
      };
    }

    const run = await runCursor(
      cursorLaunchArgs(this.model, this.workingDir, prompt),
      this.workingDir,
      home,
    );

    if (run.exitCode !== 0) {
      return {
        error: `cursor-agent exited with ${run.exitCode}: ${run.stderr.trim()}`,
      };
    }

    const events = parseEvents(run.stdout);

    const failure = resultError(events);

    if (failure !== undefined) return { error: failure };

    const output = replyText(events);

    if (output === undefined)
      return { error: "cursor-agent produced no reply" };

    return { output, metadata: { skillCalls: skillCallsFrom(events) } };
  }
}
