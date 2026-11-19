import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type {
  Assertion,
  AssertionValueFunction,
  PromptFunction,
  TestCase,
  UnifiedConfig,
} from "promptfoo";
import { openRouterClaudeEnvironment } from "./providers/openrouter-claude.ts";
import { fixturesDir } from "./workspace-repo.ts";

export const arms = ["current", "baseline", "without-skill"] as const;

export const runners = [
  { harness: "claude-code", model: "claude-sonnet-5-5" },
  { harness: "claude-code", model: "claude-opus-5-5" },
  { harness: "codex", model: "gpt-6-luna" },
  { harness: "codex", model: "gpt-6-sol" },
  {
    harness: "pi",
    model: `${process.env.RAVN_VERIFY_PI_PROVIDER || "openai"}/${process.env.RAVN_VERIFY_PI_MODEL || "gpt-6-luna"}`,
  },
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

const openRouterGrader = process.env.RAVN_EVALS_GRADER_ROUTE === "openrouter";

export const grader = {
  id: "anthropic:claude-agent-sdk",
  config: {
    model: openRouterGrader ? undefined : "claude-sonnet-5-5",
    apiKeyRequired: false,
    tools: [],
    skills: [],
    persist_session: false,
    env: graderEnvironment(),
  },
};

function graderEnvironment() {
  const home = process.env.RAVN_EVALS_HOME;

  if (!home) return {};

  const isolated = {
    HOME: home,
    CLAUDE_CONFIG_DIR: join(home, ".claude-grader"),
  };

  return openRouterGrader
    ? {
        ...isolated,
        ...openRouterClaudeEnvironment("anthropic/claude-sonnet-5.5"),
      }
    : isolated;
}

const piProvider = `file://${join(import.meta.dirname, "providers", "pi.ts")}`;

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
    HOME: requiredEnv("RAVN_EVALS_HOME"),
    CLAUDE_CONFIG_DIR: configDir,
    CLAUDE_CODE_OAUTH_TOKEN: openRouter
      ? ""
      : (process.env.CLAUDE_CODE_OAUTH_TOKEN ?? ""),
  };
}

function claudeProjectSkills(fixture: string, arm: string) {
  const pristine = process.env.RAVN_EVALS_PRISTINE;

  if (pristine === undefined || arm === "without-skill") return [];

  const dir = join(pristine, fixture, arm, ".claude", "skills");

  if (!existsSync(dir)) return [];

  return readdirSync(dir).filter((name) =>
    existsSync(join(dir, name, "SKILL.md")),
  );
}

// Every step runs in promptfoo's fresh copy of the arm's workspace, so no
// case sees another's changes. "copy", not true: true clones a workspace with
// no untracked files, as the without-skill arm's usually is, onto a detached
// HEAD, while arms with installed skills are copied on main.
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
          copy_working_dir: "copy",
          persist_session: false,
          setting_sources: ["project"],
          // An isolated config dir does not hide organization-managed plugin
          // skills. Allow only unqualified names installed in this arm.
          skills: claudeProjectSkills(fixture, arm),
          append_allowed_tools: ["Bash", "Agent"],
          env: openRouter
            ? {
                ...claudeCodeEnv(true),
                ...openRouterClaudeEnvironment(modelWithoutRoute(runner)),
              }
            : claudeCodeEnv(false),
        },
      };
    }

    case "codex": {
      const openRouter = runner.model.startsWith("openrouter/");

      const home = requiredEnv("RAVN_EVALS_HOME");
      const cliEnv = { HOME: home, CODEX_HOME: join(home, ".codex") };

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
            copy_working_dir: "copy",
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
          copy_working_dir: "copy",
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
        config: {
          model: runner.model,
          working_dir: workingDir,
          copy_working_dir: "copy",
          home: requiredEnv("RAVN_EVALS_HOME"),
        },
      };
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
type Disclosure = { references?: string[] };

type SkillRequestVars = {
  request: string;
  bareRequest?: string;
  baselineRequest?: string;
};

type Quality = Disclosure & {
  invoked?: boolean;
  // The prior command may have encoded the branch that is a mode today.
  baselineInvocation?: { skill: string; request: string };
};

export type Case =
  | (Base & Quality & { kind: "quality"; metric: string; rubric: string })
  | (Base & Quality & { kind: "quality"; assert: Assertion[] })
  | (Base & Disclosure & { kind: "trigger"; invoked?: boolean })
  | (Base & { kind: "route"; to: string })
  | (Base & { kind: "stay-out"; skills: string[] });

function skillRead(skill: string, count: { min: number } | { max: number }) {
  return {
    type: "trajectory:step-count" as const,
    value: { type: "command", pattern: `*${skill}/SKILL.md*`, ...count },
  };
}

function disclosedReference(file: string): Assertion {
  const value: AssertionValueFunction = async (
    _output,
    { providerResponse },
  ) => {
    const { referenceWasRead } = await import("./reference-reads.ts");

    const pass =
      providerResponse !== undefined &&
      referenceWasRead(providerResponse, file);

    return {
      pass,
      score: pass ? 1 : 0,
      reason: `${file}: ${pass ? "read" : "no completed read in trace"}`,
    };
  };

  return { type: "javascript", metric: "reference-read", value };
}

const invocations = {
  "claude-code": (skill: string) => `/${skill}`,
  codex: (skill: string) => `$${skill}`,
  pi: (skill: string) => `/skill:${skill}`,
} as const;

export const skillRequest: PromptFunction = async ({ provider, vars }) => {
  const arm = provider?.label?.split("/")[1];

  if (arm === "baseline") return String(vars.baselineRequest ?? vars.request);

  if (arm === "without-skill") return String(vars.bareRequest ?? vars.request);

  return String(vars.request);
};

function toTest(
  configSkill: string,
  testCase: Case,
  harness: Runner["harness"],
  comparing: boolean,
): TestCase {
  const skill = testCase.skill ?? configSkill;

  const codex = harness === "codex";

  const invoked =
    (testCase.kind === "quality" || testCase.kind === "trigger") &&
    testCase.invoked === true;

  const baseline =
    testCase.kind === "quality" && invoked
      ? testCase.baselineInvocation
      : undefined;

  const disclosed = "references" in testCase ? (testCase.references ?? []) : [];

  const vars: SkillRequestVars = {
    request: invoked
      ? `${invocations[harness](skill)} ${testCase.request}`
      : testCase.request,
  };

  if (invoked) vars.bareRequest = baseline?.request ?? testCase.request;

  if (baseline)
    vars.baselineRequest = `${invocations[harness](baseline.skill)} ${baseline.request}`;

  const base = {
    description: testCase.description,
    vars,
    metadata: {
      ...testCase.metadata,
      kind: testCase.kind,
      fixture: testCase.fixture,
      invoked,
      references: disclosed,
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

  const references = disclosed.map(disclosedReference);

  switch (testCase.kind) {
    case "quality":
      return {
        ...base,
        providers: [`${testCase.fixture}/*`],
        assert: [
          // Native selection and reads gate the current run. A comparison
          // scores only outcomes, which every arm can produce.
          ...(!comparing && !invoked ? [used(skill)] : []),
          ...(comparing ? [] : references),
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
        assert: [
          ...references,
          ...(invoked
            ? [
                {
                  type: "llm-rubric" as const,
                  metric: "explicit-command-accepted",
                  provider: grader,
                  value: `The user explicitly invoked ${invocations[harness](skill)} to request: ${testCase.request}
PASS only if the response accepts the skill command and begins the requested task, or asks a task-specific question needed to proceed.
FAIL if the response reports that the skill or command could not be found, loaded, recognized, or invoked, regardless of wording; if it asks the user to install or locate the skill; or if it only acknowledges the command without beginning the task. An empty response fails.`,
                },
              ]
            : [used(skill)]),
        ],
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

export function skillEval(
  skill: string,
  cases: Case[],
): UnifiedConfig & { tests: TestCase[] } {
  const fixtures = [...new Set(cases.map((testCase) => testCase.fixture))];
  const comparing = process.env.RAVN_EVALS_COMPARE === "1";

  const runner = runners.find(
    (candidate) => runnerName(candidate) === requiredEnv("RAVN_EVALS_RUNNER"),
  );

  if (runner === undefined) {
    throw new Error(`No runner named ${requiredEnv("RAVN_EVALS_RUNNER")}`);
  }

  return {
    description: `${skill}: ${arms.join(" vs ")}`,
    prompts: [
      { label: "skill-request", raw: "{{request}}", function: skillRequest },
    ],
    providers: fixtures.flatMap((fixture) =>
      arms.map((arm) => provider(fixture, arm, runner)),
    ),
    // The route lands on every result row, so report.ts can refuse to compare
    // arms or runs graded through different routes.
    defaultTest: {
      options: { provider: grader },
      metadata: {
        graderRoute: openRouterGrader ? "openrouter" : "first-party",
      },
    },
    extensions: [
      `file://${join(import.meta.dirname, "hooks.ts")}:extensionHook`,
    ],
    // Before each step, the hooks rebuild the workspaces every step is copied
    // from, so two steps at once would race on them.
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
    tests: cases.map((testCase) =>
      toTest(skill, testCase, runner.harness, comparing),
    ),
  };
}
