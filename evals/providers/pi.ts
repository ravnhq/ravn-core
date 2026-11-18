import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type {
  ApiProvider,
  CallApiContextParams,
  ProviderOptions,
  ProviderResponse,
} from "promptfoo";
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
    toolName: z.string(),
    args: z.record(z.string(), z.json()),
  }),
  z.object({
    type: z.literal("tool_execution_end"),
    toolCallId: z.string(),
    isError: z.boolean(),
    result: z.object({ content: z.unknown() }).optional(),
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

function toolCallsFrom(events: PiEvent[]) {
  const results = new Map(
    events.flatMap((event) =>
      event.type === "tool_execution_end" ? [[event.toolCallId, event]] : [],
    ),
  );

  return events.flatMap((event) => {
    if (event.type !== "tool_execution_start") return [];

    const end = results.get(event.toolCallId);

    if (!end || end.isError || !["read", "bash"].includes(event.toolName))
      return [];

    return [
      {
        name: event.toolName,
        input: event.args,
        output: end.result?.content,
        is_error: false,
      },
    ];
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

const piEnvNames = ["PATH", "TMPDIR", "LANG"];

function piEnv(home: string): NodeJS.ProcessEnv {
  const inherited = Object.fromEntries(
    piEnvNames.flatMap((name) => {
      const value = process.env[name];

      return value === undefined ? [] : [[name, value]];
    }),
  );

  return { ...inherited, HOME: home, PI_CODING_AGENT_DIR: join(home, "pi") };
}

function runPi(args: string[], cwd: string, home: string): Promise<PiRun> {
  return new Promise((done, fail) => {
    const child = spawn("pi", args, {
      cwd,
      env: piEnv(home),
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
  // promptfoo reads copy_working_dir and working_dir from here to create each
  // eval step's workspace, as it does for its own agent providers.
  readonly config: ProviderOptions["config"];
  private readonly providerId: string;
  private readonly provider: string;
  private readonly model: string;
  private readonly workingDir: string;

  constructor(options: ProviderOptions) {
    this.config = options.config;
    this.providerId = options.id ?? "pi";
    const model = String(options.config?.model);
    const separator = model.indexOf("/");

    if (separator < 1 || separator === model.length - 1) {
      throw new Error("Pi model must be <provider>/<model>");
    }

    this.provider = model.slice(0, separator);
    this.model = model.slice(separator + 1);
    this.workingDir = resolve(
      String(options.config?.basePath ?? process.cwd()),
      String(options.config?.working_dir),
    );
  }

  id(): string {
    return this.providerId;
  }

  // With copy_working_dir, promptfoo passes the step's workspace as the
  // prompt config's working_dir, which overrides ours as it does in its own
  // agent providers. Like them, refuse a call that would run in working_dir
  // itself, which only a call outside an eval step makes.
  async callApi(
    prompt: string,
    context?: CallApiContextParams,
  ): Promise<ProviderResponse> {
    const config = { ...this.config, ...context?.prompt?.config };

    const workingDir = resolve(
      String(config.basePath ?? process.cwd()),
      String(config.working_dir),
    );

    if (config.copy_working_dir && workingDir === this.workingDir) {
      return {
        error:
          "copy_working_dir runs each eval step in a fresh copy of working_dir; this call was not made by an eval step.",
      };
    }

    const skillsDir = join(workingDir, ".agents", "skills");

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
        "--provider",
        this.provider,
        "--model",
        this.model,
        ...skillArgs,
        prompt,
      ],
      workingDir,
      z.string().parse(config.home),
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
      metadata: {
        skillCalls: skillCallsFrom(events),
        toolCalls: toolCallsFrom(events),
        workingDir,
      },
    };
  }
}
