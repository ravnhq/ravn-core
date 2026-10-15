import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const repoDir = join(import.meta.dirname, "..", "..", "..", "..");

const runId =
  process.env.RUN_ID ?? new Date().toISOString().replaceAll(/[:.]/g, "-");

const [feature, command, ...args] = process.argv.slice(2);

if (feature === undefined || command === undefined) {
  console.error("usage: collect.ts <feature-id> <command> [args...]");
  process.exit(64);
}

const evidenceDir = join(repoDir, ".verify", runId, feature);

mkdirSync(evidenceDir, { recursive: true });

const startedAt = Date.now();

const result = spawnSync(command, args, {
  cwd: repoDir,
  encoding: "utf8",
  maxBuffer: Number.POSITIVE_INFINITY,
});

const head = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: repoDir,
  encoding: "utf8",
});

writeFileSync(join(evidenceDir, "stdout.txt"), result.stdout ?? "");

writeFileSync(join(evidenceDir, "stderr.txt"), result.stderr ?? "");

writeFileSync(
  join(evidenceDir, "run.json"),
  `${JSON.stringify(
    {
      command: [command, ...args],
      exitCode: result.status,
      error: result.error?.message ?? null,
      head: head.stdout.trim(),
      finishedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
);

const resultsDir = join(repoDir, "evals", "results");

if (existsSync(resultsDir) && statSync(resultsDir).mtimeMs >= startedAt) {
  cpSync(resultsDir, join(evidenceDir, "results"), { recursive: true });
}

console.log(`${evidenceDir} exit=${result.status}`);

process.exitCode = result.status ?? 1;
