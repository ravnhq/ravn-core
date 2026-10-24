import { spawnSync } from "node:child_process";
import { join } from "node:path";
import type { Assertion, TestCase, UnifiedConfig } from "promptfoo";
import { fixturesDir } from "./workspace-repo.ts";

export const arms = ["current", "baseline", "without-skill"] as const;

export const runners = [
  { harness: "claude-code", model: "claude-sonnet-5-5" },
  { harness: "claude-code", model: "claude-opus-5-5" },
  { harness: "codex", model: "gpt-6-luna" },
  { harness: "codex", model: "gpt-6-sol" },
  { harness: "pi", model: "openai/gpt-6-luna" },
  // Composer 2.5 is the model a new Cursor CLI session starts on.
  { harness: "cursor", model: "composer-2.5" },
  { harness: "claude-code", model: "openrouter/anthropic/claude-sonnet-5.5" },
  { harness: "claude-code", model: "openrouter/anthropic/claude-opus-5.5" },
  { harness: "codex", model: "openrouter/openai/gpt-6-luna" },
  { harness: "codex", model: "openrouter/openai/gpt-6-sol" },
] as const;

export const openRouterModels = [
  "openrouter/anthropic/claude-sonnet-5.5",
  "openrouter/anthropic/claude-opus-5.5",
  "openrouter/openai/gpt-6-luna",
  "openrouter/openai/gpt-6-sol",
] as const;

type Runner = (typeof runners)[number];

export const grader = {
  id: "anthropic:claude-agent-sdk",
  config: { model: "claude-sonnet-5-5", apiKeyRequired: false },
};

const piProvider = `file://${join(import.meta.dirname, "providers", "pi.ts")}`;

const cursorProvider = `file://${join(import.meta.dirname, "providers", "cursor.ts")}`;

export const runnerName = (runner: Runner) =>
  `${runner.harness}/${runner.model.split("/").at(-1)}${
    runner.model.startsWith("openrouter/") ? "-or" : ""
  }`;

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined) {
    throw new Error(`${name} is unset; run evals through \`pnpm eval\`.`);
  }

  return value;
}

function modelWithoutRoute(runner: Runner): string {
  return runner.model.replace(/^openrouter\//, "");
}

// Claude Code loads the plugins installed in its config dir, such as a
// released ravn-core, next to the workspace skills under test. An isolated
// config dir keeps them out, and CLAUDE_CODE_OAUTH_TOKEN, a token from
// `claude setup-token`, replaces the login that stays behind in the real one.
// promptfoo passes the parent env through, so OpenRouter runners blank it.
function claudeCodeEnv(openRouter: boolean) {
  const configDir = join(requiredEnv("RAVN_EVALS_HOME"), ".claude");

  // run.ts refuses to start a first-party Claude Code runner without it.
  return {
    CLAUDE_CONFIG_DIR: configDir,
    CLAUDE_CODE_OAUTH_TOKEN: openRouter
      ? ""
      : (process.env.CLAUDE_CODE_OAUTH_TOKEN ?? ""),
  };
}

export function provider(fixture: string, arm: string, runner: Runner) {
  const label = `${fixture}/${arm}/${runnerName(runner)}`;

  const workingDir = join(requiredEnv("RAVN_EVALS_WORKSPACES"), fixture, arm);

  switch (runner.harness) {
    case "claude-code": {
      const openRouter = runner.model.startsWith("openrouter/");

      return {
        id: "anthropic:claude-agent-sdk",
        label,
        config: {
          model: openRouter ? undefined : runner.model,
          apiKeyRequired: false,
          working_dir: workingDir,
          setting_sources: ["project"],
          skills: "all",
          append_allowed_tools: ["Bash", "Agent"],
          env: openRouter
            ? {
                ...claudeCodeEnv(true),
                ANTHROPIC_BASE_URL: "https://openrouter.ai/api",
                ANTHROPIC_AUTH_TOKEN: process.env.OPENROUTER_API_KEY ?? "",
                ANTHROPIC_API_KEY: "",
                ANTHROPIC_DEFAULT_SONNET_MODEL: modelWithoutRoute(
                  runner,
                ).replace("anthropic/", ""),
                ANTHROPIC_DEFAULT_OPUS_MODEL: modelWithoutRoute(runner).replace(
                  "anthropic/",
                  "",
                ),
                ANTHROPIC_MODEL: modelWithoutRoute(runner),
              }
            : claudeCodeEnv(false),
        },
      };
    }

    case "codex": {
      const openRouter = runner.model.startsWith("openrouter/");

      const cliEnv = { HOME: requiredEnv("RAVN_EVALS_HOME") };

      if (openRouter) {
        const withCodexHome = {
          ...cliEnv,
          // promptfoo gives the Codex CLI a minimal env, so the auth command
          // in .codex-openrouter/config.toml needs the key passed explicitly.
          OPENROUTER_API_KEY: requiredEnv("OPENROUTER_API_KEY"),
          CODEX_HOME: join(requiredEnv("RAVN_EVALS_HOME"), ".codex-openrouter"),
        };

        return {
          id: "openai:codex-sdk",
          label,
          config: {
            model: modelWithoutRoute(runner),
            working_dir: workingDir,
            skip_git_repo_check: true,
            sandbox_mode: "danger-full-access",
            enable_streaming: true,
            deep_tracing: true,
            cli_env: withCodexHome,
          },
        };
      }

      return {
        id: "openai:codex-sdk",
        label,
        config: {
          model: runner.model,
          working_dir: workingDir,
          skip_git_repo_check: true,
          sandbox_mode: "danger-full-access",
          enable_streaming: true,
          deep_tracing: true,
          cli_env: cliEnv,
        },
      };
    }

    case "pi":
      return {
        id: piProvider,
        label,
        config: { model: runner.model, working_dir: workingDir },
      };

    case "cursor": {
      if (!process.env.CURSOR_API_KEY) {
        throw new Error(
          "CURSOR_API_KEY is unset. Create a user API key in the Cursor dashboard and export it, or pick other runners with --runners.",
        );
      }

      return {
        id: cursorProvider,
        label,
        config: { model: runner.model, working_dir: workingDir },
      };
    }
  }
}

export function commit(fixture: string, subject: string): string {
  const result = spawnSync(
    "git",
    ["log", "--format=%h", "--fixed-strings", `--grep=${subject}`, "main"],
    { cwd: join(fixturesDir, `${fixture}.git`), encoding: "utf8" },
  );

  const [hash, ...others] = result.stdout.trim().split("\n");

  if (result.status !== 0 || !hash || others.length > 0) {
    throw new Error(`Expected one commit in ${fixture} matching "${subject}"`);
  }

  return `commit ${hash} ("${subject}")`;
}

export type Edit = { path: string; find: string; replace: string };

type Base = {
  description: string;
  // The skill this case exercises, when it is not the config's own skill.
  skill?: string;
  fixture: string;
  request: string;
  edits?: Edit[];
  metadata?: Record<string, string>;
};

// `invoked` cases type the skill's command, as a user does for a skill with
// disable-model-invocation. The harness expands it into the prompt without a
// Skill tool call, so `skill-used` cannot see it; the smoke suite proves
// commands load skills. An explicit trigger checks that the command returns a
// usable reply; its quality case checks whether that reply follows the skill.
type Quality = { invoked?: boolean };

export type Case =
  | (Base & Quality & { kind: "quality"; metric: string; rubric: string })
  | (Base & Quality & { kind: "quality"; assert: Assertion[] })
  | (Base & { kind: "trigger"; invoked?: boolean })
  | (Base & { kind: "route"; to: string })
  | (Base & { kind: "stay-out"; skills: string[] });

function skillRead(skill: string, count: { min: number } | { max: number }) {
  return {
    type: "trajectory:step-count" as const,
    value: { type: "command", pattern: `*${skill}/SKILL.md*`, ...count },
  };
}

const invocations = {
  "claude-code": (skill: string) => `/${skill}`,
  codex: (skill: string) => `$${skill}`,
  pi: (skill: string) => `/skill:${skill}`,
  cursor: (skill: string) => `/${skill}`,
} as const;

function toTest(
  configSkill: string,
  testCase: Case,
  harness: Runner["harness"],
): TestCase {
  const skill = testCase.skill ?? configSkill;

  const codex = harness === "codex";

  const invoked =
    (testCase.kind === "quality" || testCase.kind === "trigger") &&
    testCase.invoked === true;

  const base = {
    description: testCase.description,
    vars: {
      request: invoked
        ? `${invocations[harness](skill)} ${testCase.request}`
        : testCase.request,
    },
    metadata: {
      ...testCase.metadata,
      kind: testCase.kind,
      fixture: testCase.fixture,
      edits: testCase.edits ?? [],
    },
  };

  const singleArm = {
    providers: [`${testCase.fixture}/current/*`],
    options: { disableDefaultAsserts: true },
  };

  const used = (value: string): Assertion =>
    codex ? skillRead(value, { min: 1 }) : { type: "skill-used", value };

  const unused = (values: string[]): Assertion[] =>
    codex
      ? values.map((value) => skillRead(value, { max: 0 }))
      : [{ type: "not-skill-used", value: values }];

  switch (testCase.kind) {
    case "quality":
      return {
        ...base,
        providers: [`${testCase.fixture}/*`],
        assert: [
          ...(invoked ? [] : [used(skill)]),
          ...("rubric" in testCase
            ? [
                {
                  type: "llm-rubric" as const,
                  metric: testCase.metric,
                  value: testCase.rubric,
                },
              ]
            : testCase.assert),
        ],
      };
    case "trigger":
      return {
        ...base,
        ...singleArm,
        assert: invoked
          ? [
              {
                type: "llm-rubric",
                metric: "explicit-command-accepted",
                provider: grader,
                value: `The user explicitly invoked ${invocations[harness](skill)} to request: ${testCase.request}
PASS only if the response accepts the skill command and begins the requested task, or asks a task-specific question needed to proceed.
FAIL if the response reports that the skill or command could not be found, loaded, recognized, or invoked, regardless of wording; if it asks the user to install or locate the skill; or if it only acknowledges the command without beginning the task. An empty response fails.`,
              },
            ]
          : [used(skill)],
      };
    case "route":
      return {
        ...base,
        ...singleArm,
        assert: [used(testCase.to), ...unused([skill])],
      };
    case "stay-out":
      return { ...base, ...singleArm, assert: unused(testCase.skills) };
  }
}

export function skillEval(skill: string, cases: Case[]): UnifiedConfig {
  const fixtures = [...new Set(cases.map((testCase) => testCase.fixture))];

  const runner = runners.find(
    (candidate) => runnerName(candidate) === requiredEnv("RAVN_EVALS_RUNNER"),
  );

  if (runner === undefined) {
    throw new Error(`No runner named ${requiredEnv("RAVN_EVALS_RUNNER")}`);
  }

  return {
    description: `${skill}: ${arms.join(" vs ")}`,
    prompts: ["{{request}}"],
    providers: fixtures.flatMap((fixture) =>
      arms.map((arm) => provider(fixture, arm, runner)),
    ),
    defaultTest: { options: { provider: grader } },
    extensions: [
      `file://${join(import.meta.dirname, "hooks.ts")}:extensionHook`,
    ],
    evaluateOptions: { maxConcurrency: 1 },
    tracing: {
      enabled: true,
      otlp: {
        http: {
          enabled: true,
          // run.ts gives each parallel job its own port; providers export
          // traces to whatever port the receiver is configured on.
          port: Number(process.env.RAVN_EVALS_OTLP_PORT ?? 4318),
          host: "127.0.0.1",
          acceptFormats: ["json", "protobuf"],
        },
      },
    },
    tests: cases.map((testCase) => toTest(skill, testCase, runner.harness)),
  };
}
