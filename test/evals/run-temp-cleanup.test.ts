import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

const repoDir = join(import.meta.dirname, "..", "..");

const runDirPrefix = "ravn-skills-evals-";

// Copies the evals, scripts and plugins into a scratch repo whose private
// evals are a stub config with no fixtures. run.ts makes its temp dir, then
// throws "private evals are not fetched" in every job, before any promptfoo
// process starts, so no tokens are spent.
function scratchRepoWithoutFixtures(dir: string): string {
  const privateDir = join(repoDir, "evals", "private");

  const resultsDir = join(repoDir, "evals", "results");

  cpSync(join(repoDir, "evals"), join(dir, "evals"), {
    recursive: true,
    filter: (src) => src !== privateDir && src !== resultsDir,
  });

  cpSync(join(repoDir, "scripts"), join(dir, "scripts"), { recursive: true });

  cpSync(join(repoDir, "plugins"), join(dir, "plugins"), { recursive: true });

  const config = join(
    dir,
    "evals",
    "private",
    "ravn-core",
    "why",
    "promptfooconfig.ts",
  );

  mkdirSync(dirname(config), { recursive: true });

  writeFileSync(config, "export default {};\n");

  return join(dir, "evals", "run.ts");
}

function runEvals(
  runScript: string,
  tmp: string,
  home: string,
  args: string[],
) {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, TMPDIR: tmp };

  delete env.CODEX_HOME;

  return spawnSync(
    process.execPath,
    [runScript, "--runners", "codex/gpt-6-luna", ...args],
    { encoding: "utf8", env, timeout: 60_000 },
  );
}

function leftoverRunDirs(tmp: string): string[] {
  return readdirSync(tmp).filter((name) => name.startsWith(runDirPrefix));
}

function setup(t: { after: (fn: () => void) => void }) {
  const base = mkdtempSync(join(tmpdir(), "eval-run-cleanup-test-"));

  t.after(() => rmSync(base, { recursive: true, force: true }));

  const tmp = join(base, "tmp");

  const home = join(base, "home");

  mkdirSync(tmp);

  mkdirSync(join(home, ".codex"), { recursive: true });

  writeFileSync(join(home, ".codex", "auth.json"), '{"dummy": true}\n');

  const repo = join(base, "repo");

  mkdirSync(repo);

  return { tmp, home, runScript: scratchRepoWithoutFixtures(repo), repo };
}

test("run.ts removes its temp home when it throws after making it", (t) => {
  const { tmp, home, runScript, repo } = setup(t);

  const result = runEvals(runScript, tmp, home, []);

  assert.notEqual(result.status, 0);

  // The results dir is made after the temp dir and before the jobs throw, so
  // this proves the run reached the throw.
  assert.ok(existsSync(join(repo, "evals", "results")));

  assert.deepEqual(leftoverRunDirs(tmp), []);
});

test("run.ts removes its temp home when parallel jobs throw", (t) => {
  const { tmp, home, runScript, repo } = setup(t);

  const result = runEvals(runScript, tmp, home, [
    "--repeat",
    "2",
    "--jobs",
    "2",
  ]);

  assert.notEqual(result.status, 0);

  assert.ok(existsSync(join(repo, "evals", "results")));

  assert.deepEqual(leftoverRunDirs(tmp), []);
});
