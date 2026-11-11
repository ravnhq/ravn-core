import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { join } from "node:path";

// Observe the unmodified recipe through the simulator's node entry, including
// runs in separate clones whose git directories disappear during cleanup.
const root = process.env.BABYSIT_SIM_ROOT;

if (!root) throw new Error("BABYSIT_SIM_ROOT is required");

const result = spawnSync(process.execPath, process.argv.slice(2), {
  stdio: "inherit",
});

if (result.error) throw result.error;

const git = spawnSync(
  "git",
  ["rev-parse", "--path-format=absolute", "--git-common-dir"],
  { encoding: "utf8" },
);

if (git.status !== 0) throw new Error(git.stderr);

const log = join(git.stdout.trim(), "verify-retry-runs.jsonl");

const target = join(root, "verify-retry-runs.jsonl");

if (
  existsSync(log) &&
  (!existsSync(target) || realpathSync(log) !== realpathSync(target))
)
  appendFileSync(target, readFileSync(log));

process.exitCode = result.status ?? 1;
