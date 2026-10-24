import { spawn } from "node:child_process";
import {
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { type AddressInfo, createServer } from "node:net";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { agentPluginDirs } from "../scripts/plugins.ts";
import { arms as allArms, runnerName, runners } from "./skill-eval.ts";
import {
  createWorkspaceRepo,
  exportPluginsAt,
  fixtureNames,
  missingFixtures,
  privateDir,
  installSkills,
  pluginSkillDirs,
} from "./workspace-repo.ts";

const evalsDir = import.meta.dirname;

const repoDir = join(evalsDir, "..");

const pluginsDir = join(repoDir, "plugins");

const smokeDir = join(evalsDir, "smoke");

const promptfooErrorStatus = 1;

function takeOption(args: string[], name: string, fallback: string): string {
  const inline = args.findIndex((arg) => arg.startsWith(`${name}=`));

  if (inline !== -1) {
    const [arg = ""] = args.splice(inline, 1);

    return arg.slice(name.length + 1);
  }

  const index = args.indexOf(name);

  if (index === -1) {
    return fallback;
  }

  const [, value] = args.splice(index, 2);

  return value ?? fallback;
}

function hasOption(args: string[], name: string): boolean {
  return args.some((arg) => arg === name || arg.startsWith(`${name}=`));
}

function takeFlag(args: string[], name: string): boolean {
  const index = args.indexOf(name);

  if (index !== -1) {
    args.splice(index, 1);
  }

  return index !== -1;
}

function takeSelection(args: string[], name: string, known: string[]) {
  const selected = takeOption(args, name, known.join(",")).split(",");

  const unknown = selected.filter((value) => !known.includes(value));

  if (unknown.length > 0) {
    throw new Error(
      `Unknown ${name} value(s): ${unknown.join(", ")}. Known: ${known.join(", ")}`,
    );
  }

  return selected;
}

const promptfooArgs = process.argv.slice(2);

const smoke = takeFlag(promptfooArgs, "--smoke");

for (const option of ["--skills", "--arms"]) {
  if (smoke && hasOption(promptfooArgs, option)) {
    throw new Error(
      `${option} does not apply to --smoke. Use pnpm eval ${option} <value> for skill evals.`,
    );
  }
}

const arms = smoke
  ? ["current"]
  : takeOption(promptfooArgs, "--arms", allArms.join(",")).split(",");

const baselineRef = takeOption(promptfooArgs, "--baseline-ref", "main");

const selectedRunners = takeSelection(
  promptfooArgs,
  "--runners",
  runners.map(runnerName),
);

const needsClaudeLogin = selectedRunners.some(
  (runner) => runner.startsWith("claude-code/") && !runner.endsWith("-or"),
);

if (needsClaudeLogin && !process.env.CLAUDE_CODE_OAUTH_TOKEN) {
  throw new Error(
    "CLAUDE_CODE_OAUTH_TOKEN is unset. Claude Code runs with an isolated config dir, so create a token with `claude setup-token` and export it, or pick other runners with --runners.",
  );
}

const skillConfigs = agentPluginDirs(pluginsDir).flatMap((dir) => {
  const plugin = basename(dir);

  const configsDir = join(privateDir, plugin);

  if (!existsSync(configsDir)) {
    return [];
  }

  return readdirSync(configsDir).flatMap((skill) => {
    const config = join(configsDir, skill, "promptfooconfig.ts");

    return existsSync(config)
      ? [{ name: `${plugin}-${skill}`, skill, config }]
      : [];
  });
});

const selectedSkills = takeSelection(
  promptfooArgs,
  "--skills",
  skillConfigs.map(({ skill }) => skill),
);

const repeat = Number.parseInt(takeOption(promptfooArgs, "--repeat", "1"), 10);

const jobLimit = Number.parseInt(takeOption(promptfooArgs, "--jobs", "1"), 10);

// A separate --results dir lets two runs proceed at once, since each run
// clears its own results dir first.
const resultsDir = resolve(
  takeOption(promptfooArgs, "--results", join(evalsDir, "results")),
);

// Ask the OS for a free port, so concurrent jobs and runs never share an
// OTLP receiver.
function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();

    server.once("error", reject);

    server.listen(0, "127.0.0.1", () => {
      // SAFETY: a TCP server listening on a host reports an AddressInfo, never
      // a pipe name or null.
      const { port } = server.address() as AddressInfo;

      server.close(() => resolvePort(port));
    });
  });
}

const runDir = realpathSync(mkdtempSync(join(tmpdir(), "ravn-skills-evals-")));

const isolatedHomeDir = join(runDir, "home");

const codexAuthFile = join(
  process.env.CODEX_HOME ?? join(homedir(), ".codex"),
  "auth.json",
);

const isolatedCodexAuthFile = join(isolatedHomeDir, ".codex", "auth.json");

// Codex runners pointed at OpenRouter use their own CODEX_HOME with the
// OpenRouter provider block; see https://openrouter.ai/docs/cookbook/coding-agents/codex-cli
const openRouterCodexDir = join(isolatedHomeDir, ".codex-openrouter");

mkdirSync(openRouterCodexDir, { recursive: true });

writeFileSync(
  join(openRouterCodexDir, "config.toml"),
  [
    'model_provider = "openrouter"',
    "",
    "[model_providers.openrouter]",
    'name = "openrouter"',
    'base_url = "https://openrouter.ai/api/v1"',
    "",
    "[model_providers.openrouter.auth]",
    'command = "sh"',
    'args = ["-c", "echo $OPENROUTER_API_KEY"]',
    "",
  ].join("\n"),
);

const baselinePlugins = exportPluginsAt(
  repoDir,
  baselineRef,
  join(runDir, "baseline"),
);

const armSkills = new Map([
  ["current", [...pluginSkillDirs(pluginsDir), join(smokeDir, "skills")]],
  ["baseline", pluginSkillDirs(baselinePlugins)],
  ["without-skill", []],
]);

// Each job clones its own workspaces. Its hook resets them before every
// test, so jobs never share or race on a copy.
function createWorkspaces(dir: string, harness: string) {
  if (missingFixtures) {
    throw new Error(missingFixtures);
  }

  for (const fixture of fixtureNames) {
    for (const [arm, skillDirs] of armSkills) {
      const workspaceDir = join(dir, fixture, arm);

      createWorkspaceRepo(workspaceDir, fixture);

      installSkills(workspaceDir, skillDirs, harness);
    }
  }
}

mkdirSync(join(isolatedHomeDir, ".codex"), { recursive: true });

const codexAuthAtStart = readFileSync(codexAuthFile);

cpSync(codexAuthFile, isolatedCodexAuthFile);

rmSync(resultsDir, { recursive: true, force: true });

mkdirSync(resultsDir, { recursive: true });

const configs = smoke
  ? [{ name: "smoke", config: join(smokeDir, "promptfooconfig.ts") }]
  : skillConfigs.filter(({ skill }) => selectedSkills.includes(skill));

const jobs = configs.flatMap(({ name, config }) =>
  selectedRunners.flatMap((runner) =>
    Array.from({ length: repeat }, (_, attempt) => ({
      config,
      runner,
      label:
        repeat > 1
          ? `${name}-${runner.replace("/", "-")}-${attempt + 1}`
          : `${name}-${runner.replace("/", "-")}`,
    })),
  ),
);

const parallel = jobLimit > 1;

async function runJob(
  { config, runner, label }: (typeof jobs)[number],
  index: number,
): Promise<number> {
  const jobDir = join(runDir, "jobs", String(index));

  const jobWorkspacesDir = join(jobDir, "workspaces");

  createWorkspaces(jobWorkspacesDir, runner.split("/")[0] ?? "");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    RAVN_EVALS_WORKSPACES: jobWorkspacesDir,
    RAVN_EVALS_HOME: isolatedHomeDir,
    RAVN_EVALS_RUNNER: runner,
    RAVN_EVALS_OTLP_PORT: String(await freePort()),
  };

  // Parallel jobs keep separate promptfoo databases so their trace stores
  // never contend; results still land in evals/results.
  if (parallel) {
    env.PROMPTFOO_CONFIG_DIR = join(jobDir, "promptfoo");
  }

  const child = spawn(
    "promptfoo",
    [
      "eval",
      "-c",
      config,
      ...(arms.length > 1 ? ["-c", join(evalsDir, "compare.ts")] : []),
      "--no-cache",
      "--filter-providers",
      `^[^/]+/(${arms.join("|")})/${runner}$`,
      "-o",
      join(resultsDir, `${label}.json`),
      ...promptfooArgs,
    ],
    {
      stdio: parallel ? ["ignore", "pipe", "pipe"] : "inherit",
      shell: process.platform === "win32",
      env,
    },
  );

  if (parallel) {
    const log = createWriteStream(join(resultsDir, `${label}.log`));

    child.stdout?.pipe(log);

    child.stderr?.pipe(log);

    console.log(`started ${label}`);
  }

  return new Promise((resolve) => {
    child.on("close", (status) => {
      if (parallel) {
        console.log(`finished ${label}: exit ${status}`);
      }

      resolve(status ?? promptfooErrorStatus);
    });
  });
}

const statuses: number[] = [];

let nextJob = 0;

async function worker() {
  while (nextJob < jobs.length) {
    const index = nextJob;

    nextJob += 1;

    const job = jobs[index];

    if (job !== undefined) {
      statuses[index] = await runJob(job, index);
    }
  }
}

await Promise.all(
  Array.from({ length: Math.max(1, jobLimit) }, () => worker()),
);

const refreshedCodexAuth = existsSync(isolatedCodexAuthFile)
  ? readFileSync(isolatedCodexAuthFile)
  : codexAuthAtStart;

if (!refreshedCodexAuth.equals(codexAuthAtStart)) {
  if (readFileSync(codexAuthFile).equals(codexAuthAtStart)) {
    writeFileSync(codexAuthFile, refreshedCodexAuth, { mode: 0o600 });
    console.warn(
      "Codex refreshed its login during the eval run; copied it back.",
    );
  } else {
    console.warn(
      "Codex refreshed its login during the eval run, but your own login changed meanwhile, so it was kept. If Codex asks you to sign in, run `codex login` (or `codex login --device-auth`).",
    );
  }
}

rmSync(runDir, { recursive: true, force: true });

process.exitCode = statuses.find((status) => status !== 0) ?? 0;
