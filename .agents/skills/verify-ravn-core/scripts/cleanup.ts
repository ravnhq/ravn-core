import { rmSync } from "node:fs";
import { resolve, sep } from "node:path";

const verifyRoot = resolve(process.env.RAVN_VERIFY_ROOT ?? "/tmp/ravn-verify");

const runId = process.argv[2] ?? process.env.RUN_ID;

if (runId === undefined) {
  console.error("usage: cleanup.ts [run-id]  (defaults to $RUN_ID)");
  process.exit(64);
}

const scratchDir = resolve(verifyRoot, runId);

if (!scratchDir.startsWith(`${verifyRoot}${sep}`)) {
  console.error(`refusing: ${scratchDir} is outside ${verifyRoot}`);
  process.exit(1);
}

rmSync(scratchDir, { recursive: true, force: true });

console.log(`removed ${scratchDir}; evidence stays in .verify/${runId}`);
