import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { agentPluginDirs } from "../scripts/plugins.ts";

// Eval cases and fixtures derive from private Ravn code, so they live in a
// private repo that `pnpm eval:fetch` clones here.
export const privateDir = join(import.meta.dirname, "private");

export const fixturesDir = join(privateDir, "fixtures");

const pluginsPath = "plugins";

export const fixtureNames = existsSync(fixturesDir)
  ? readdirSync(fixturesDir)
      .filter((name) => name.endsWith(".git"))
      .map((name) => basename(name, ".git"))
  : [];

export const missingFixtures =
  fixtureNames.length === 0 &&
  "private evals are not fetched; run pnpm eval:fetch";

function git(args: string[], cwd: string) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });

  if (result.status !== 0) {
    throw new Error(`git ${args[0]} failed: ${result.stderr.trim()}`);
  }

  return result.stdout;
}

export function createWorkspaceRepo(workspaceDir: string, fixture: string) {
  git(
    ["clone", "-q", join(fixturesDir, `${fixture}.git`), workspaceDir],
    fixturesDir,
  );

  git(["remote", "remove", "origin"], workspaceDir);
}

// Cursor reads project skills from `.agents/skills` and `.claude/skills`, so a
// Cursor workspace keeps the arm's skills only in this plugin directory.
export const cursorPluginDir = (workspaceDir: string) =>
  join(workspaceDir, ".cursor", "plugins", "ravn-core");

export const workspaceCleanExcludes = [
  "/.claude/skills/",
  "/.agents/skills/",
  "/.claude/agents/",
  "/.cursor/plugins/",
];

export function resetWorkspaceRepo(workspaceDir: string, fixture: string) {
  git(
    ["fetch", "-q", join(fixturesDir, `${fixture}.git`), "main"],
    workspaceDir,
  );

  git(["checkout", "-q", "-f", "-B", "main", "FETCH_HEAD"], workspaceDir);

  const otherRefs = git(["for-each-ref", "--format=%(refname)"], workspaceDir)
    .split("\n")
    .filter((ref) => ref !== "" && ref !== "refs/heads/main");

  for (const ref of otherRefs) {
    git(["update-ref", "-d", ref], workspaceDir);
  }

  git(["reflog", "expire", "--expire=now", "--all"], workspaceDir);

  git(["gc", "-q", "--prune=now"], workspaceDir);

  const args = ["clean", "-q", "-f", "-d"];

  for (const path of workspaceCleanExcludes) {
    args.push("-e", path);
  }

  git(args, workspaceDir);
}

export function applyEdits(
  workspaceDir: string,
  edits: { path: string; find: string; replace: string }[],
) {
  for (const edit of edits) {
    const file = join(workspaceDir, edit.path);

    const content = readFileSync(file, "utf8");

    if (!content.includes(edit.find)) {
      throw new Error(
        `${edit.path} does not contain ${JSON.stringify(edit.find)}`,
      );
    }

    writeFileSync(file, content.replace(edit.find, edit.replace));
  }
}

export function pluginSkillDirs(pluginsDir: string): string[] {
  return agentPluginDirs(pluginsDir)
    .map((dir) => join(dir, "skills"))
    .filter((dir) => existsSync(dir));
}

const cursorPluginManifest = join(
  import.meta.dirname,
  "..",
  "plugins",
  "agent",
  "ravn-core",
  ".cursor-plugin",
  "plugin.json",
);

// Skills go where Claude Code and Codex read project skills. A plugin's
// agents, beside its skills, become Claude Code project agents; Codex reads no
// agents from a plugin, so its skills spawn fresh subagents instead.
// Cursor loads a local plugin through `--plugin-dir` and `.cursor-plugin/plugin.json`,
// the same shape as `plugins/agent/ravn-core`.
export function installSkills(
  workspaceDir: string,
  skillDirs: string[],
  harness: string,
) {
  if (harness === "cursor") {
    installCursorPlugin(workspaceDir, skillDirs);

    return;
  }

  for (const harnessDir of [".claude", ".agents"]) {
    mkdirSync(join(workspaceDir, harnessDir, "skills"), { recursive: true });

    for (const skillDir of skillDirs) {
      cpSync(skillDir, join(workspaceDir, harnessDir, "skills"), {
        recursive: true,
      });
    }
  }

  for (const skillDir of skillDirs) {
    const agentsDir = join(dirname(skillDir), "agents");

    if (existsSync(agentsDir))
      cpSync(agentsDir, join(workspaceDir, ".claude", "agents"), {
        recursive: true,
      });
  }
}

function installCursorPlugin(workspaceDir: string, skillDirs: string[]) {
  const pluginDir = cursorPluginDir(workspaceDir);

  mkdirSync(join(pluginDir, ".cursor-plugin"), { recursive: true });

  cpSync(
    cursorPluginManifest,
    join(pluginDir, ".cursor-plugin", "plugin.json"),
  );

  mkdirSync(join(pluginDir, "skills"), { recursive: true });

  for (const skillDir of skillDirs) {
    cpSync(skillDir, join(pluginDir, "skills"), { recursive: true });

    const agentsDir = join(dirname(skillDir), "agents");

    if (existsSync(agentsDir)) {
      cpSync(agentsDir, join(pluginDir, "agents"), { recursive: true });
    }
  }
}

export function exportPluginsAt(
  repoDir: string,
  ref: string,
  exportDir: string,
): string {
  mkdirSync(exportDir, { recursive: true });

  const archive = spawnSync(
    "git",
    ["archive", "--format=tar", ref, pluginsPath],
    {
      cwd: repoDir,
      maxBuffer: 1 << 30,
    },
  );

  if (archive.status !== 0) {
    console.warn(
      `No ${pluginsPath}/ at ${ref}; the baseline arm runs without skills.`,
    );

    return join(exportDir, pluginsPath);
  }

  const extract = spawnSync("tar", ["-x", "-C", exportDir], {
    input: archive.stdout,
  });

  if (extract.status !== 0) {
    throw new Error(`tar failed: ${extract.stderr.toString().trim()}`);
  }

  return join(exportDir, pluginsPath);
}
