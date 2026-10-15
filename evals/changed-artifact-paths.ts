import { execFileSync } from "node:child_process";

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

  return paths;
}
