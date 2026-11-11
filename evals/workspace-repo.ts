import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
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
  "eval configs NOT checked: private evals are not fetched; run pnpm eval:fetch, then pnpm check";

function git(args: string[], cwd: string) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });

  if (result.error) throw result.error;

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

export function removeWorkspaceWorktrees(workspaceDir: string) {
  const worktrees = git(["worktree", "list", "--porcelain", "-z"], workspaceDir)
    .split("\0")
    .filter((record) => record.startsWith("worktree "))
    .map((record) => record.slice("worktree ".length));

  for (const worktree of worktrees) {
    if (worktree !== workspaceDir) {
      git(["worktree", "remove", "--force", "--force", worktree], workspaceDir);
    }
  }
}

export function resetWorkspaceRepo(workspaceDir: string, fixture: string) {
  removeWorkspaceWorktrees(workspaceDir);

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

  const installedAgentsDir = join(
    workspaceDir,
    ".git",
    "ravn-installed-agents",
  );

  if (existsSync(installedAgentsDir)) {
    rmSync(join(workspaceDir, ".claude", "agents"), {
      recursive: true,
      force: true,
    });
    cpSync(installedAgentsDir, join(workspaceDir, ".claude", "agents"), {
      recursive: true,
    });
  }

  git(
    [
      "clean",
      "-q",
      "-f",
      "-d",
      "-e",
      "/.claude/skills/",
      "-e",
      "/.agents/skills/",
      "-e",
      "/.claude/agents/",
    ],
    workspaceDir,
  );
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

// Skills go where Claude Code and Codex read project skills. A plugin's
// agents, beside its skills, become Claude Code project agents; Codex reads no
// agents from a plugin, so its skills spawn fresh subagents instead.
export function installSkills(workspaceDir: string, skillDirs: string[]) {
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

    if (existsSync(agentsDir)) {
      const gitExclude = join(workspaceDir, ".git", "info", "exclude");
      const excluded = readFileSync(gitExclude, "utf8");

      const agentExcludes = readdirSync(agentsDir)
        .map((name) => `/.claude/agents/${name}`)
        .filter((pattern) => !excluded.split("\n").includes(pattern));

      if (agentExcludes.length > 0) {
        writeFileSync(
          gitExclude,
          `${excluded.trimEnd()}\n${agentExcludes.join("\n")}\n`,
        );
      }

      cpSync(agentsDir, join(workspaceDir, ".claude", "agents"), {
        recursive: true,
      });
      cpSync(agentsDir, join(workspaceDir, ".git", "ravn-installed-agents"), {
        recursive: true,
      });

      const agentHashes = Object.fromEntries(
        readdirSync(agentsDir).map((name) => {
          const content = readFileSync(join(agentsDir, name));

          return [
            `.claude/agents/${name}`,
            createHash("sha256").update(content).digest("hex"),
          ];
        }),
      );

      writeFileSync(
        join(workspaceDir, ".git", "ravn-installed-agents.json"),
        JSON.stringify(agentHashes),
      );
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
