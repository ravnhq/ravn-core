import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const installedAgentsSchema = z.record(z.string(), z.string());

export function changedArtifactPaths(workspace: string): string[] {
  const records = execFileSync(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { cwd: workspace, encoding: "utf8" },
  ).split("\0");

  const paths: string[] = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];

    if (!record) continue;
    paths.push(record.slice(3));
    const status = record.slice(0, 2);

    if (status.includes("R") || status.includes("C")) index += 1;
  }

  const installedAgentsPath = join(
    workspace,
    ".git",
    "ravn-installed-agents.json",
  );

  if (existsSync(installedAgentsPath)) {
    const installedAgents = installedAgentsSchema.parse(
      JSON.parse(readFileSync(installedAgentsPath, "utf8")),
    );

    for (const [path, hash] of Object.entries(installedAgents)) {
      const file = join(workspace, path);

      const actualHash = existsSync(file)
        ? createHash("sha256").update(readFileSync(file)).digest("hex")
        : undefined;

      if (actualHash !== hash && !paths.includes(path)) paths.push(path);
    }
  }

  return paths;
}
