import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { pluginDirs } from "../../../../scripts/plugins.ts";

const repoDir = join(import.meta.dirname, "..", "..", "..", "..");

let failed = false;

const run = (command: string, args: string[], cwd = repoDir) =>
  spawnSync(command, args, { cwd, encoding: "utf8" });

const onPath = (tool: string) =>
  run("sh", ["-c", 'command -v "$1"', "sh", tool]).status === 0;

const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);

  if (!ok) {
    failed = true;
  }
};

const firstLine = (text: string) => text.trim().split("\n")[0] ?? "";

console.log(`repo: ${repoDir}`);

console.log(
  `revision: ${firstLine(run("git", ["rev-parse", "--short", "HEAD"]).stdout)}`,
);

for (const tool of ["claude", "codex", "pi"]) {
  console.log(`${tool}: ${firstLine(run(tool, ["--version"]).stdout ?? "")}`);
}

for (const line of run("git", ["status", "--short"]).stdout.split("\n")) {
  if (line) {
    console.log(`dirty: ${line}`);
  }
}

check("claude on PATH", onPath("claude"));

check(
  `node >= 24: ${process.versions.node}`,
  Number.parseInt(process.versions.node, 10) >= 24,
);

check("pnpm on PATH", onPath("pnpm"));

check(
  "promptfoo installed (pnpm install)",
  run("pnpm", ["exec", "promptfoo", "--version"]).status === 0,
);

check(
  "marketplace manifest valid",
  run("claude", ["plugin", "validate", repoDir]).status === 0,
);

const pluginsDir = join(repoDir, "plugins");

const plugins = pluginDirs(pluginsDir);

for (const dir of plugins) {
  check(
    `plugin valid: ${basename(dir)}`,
    run("claude", ["plugin", "validate", dir]).status === 0,
  );
}

const codexAuth = join(
  process.env.CODEX_HOME ?? join(homedir(), ".codex"),
  "auth.json",
);

const harnessChecks = [
  { tool: "codex", label: "codex login", ok: () => existsSync(codexAuth) },
  {
    tool: "pi",
    label: "pi login",
    ok: () =>
      run("pi", ["auth", "check", "--provider", "openai-codex"]).status === 0,
  },
  {
    tool: "gh",
    label: "gh auth",
    ok: () => run("gh", ["auth", "status"]).status === 0,
  },
];

for (const { tool, label, ok } of harnessChecks) {
  if (onPath(tool)) {
    check(label, ok());
  } else {
    console.log(
      `skip optional ${tool} (features that need it report as unverified)`,
    );
  }
}

process.exitCode = failed ? 1 : 0;
