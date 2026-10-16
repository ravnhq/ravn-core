import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const git = (...args: string[]) =>
  spawnSync("git", args, { encoding: "utf8" }).stdout.trim();

const top = git("rev-parse", "--show-toplevel");

const retry = pathToFileURL(join(top, "src", "retry.ts")).href;

const { backoffMs } = await import(retry);

const delays = Array.from({ length: 12 }, (_, attempt) => backoffMs(attempt));

const pass =
  delays[0] === 250 &&
  delays.every((delay, i) => i === 0 || delay >= delays[i - 1]) &&
  Math.max(...delays) === 30_000;

delays.forEach((delay, attempt) =>
  console.log(`attempt ${attempt}: ${delay} ms`),
);

console.log(pass ? "PASS" : "FAIL");

const run = {
  time: new Date().toISOString(),
  head: git("rev-parse", "HEAD"),
  base: git("rev-parse", "origin/main"),
  pass,
};

const log = join(
  git("rev-parse", "--path-format=absolute", "--git-common-dir"),
  "verify-retry-runs.jsonl",
);

appendFileSync(log, JSON.stringify(run) + "\n");

console.log("evidence: " + log);

process.exitCode = pass ? 0 : 1;
