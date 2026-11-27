#!/usr/bin/env node
// Repeat a command in fresh processes; preserve arguments and fail on the first failure.
// Usage: repeat.ts <count> <executable> [arguments...]
import { spawnSync } from "node:child_process";

const [countArgument, executable, ...args] = process.argv.slice(2);

const count = Number(countArgument);

if (!Number.isSafeInteger(count) || count < 1 || executable === undefined) {
  console.error(
    "Usage: repeat.ts <positive count> <executable> [arguments...]",
  );
  process.exit(2);
}

for (let run = 1; run <= count; run += 1) {
  console.log(`Repeat ${run}/${count}`);
  const result = spawnSync(executable, args, { stdio: "inherit" });

  if (result.error !== undefined) console.error(result.error.message);

  if (result.status !== 0) process.exit(result.status ?? 1);
}
