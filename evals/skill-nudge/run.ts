import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
  throw new Error(
    "Set CLAUDE_CODE_OAUTH_TOKEN for the isolated Skill Nudge runner.",
  );
}

const home = mkdtempSync(join(tmpdir(), "ravn-nudge-eval-"));

try {
  const result = spawnSync(
    "promptfoo",
    [
      "eval",
      "-c",
      join(import.meta.dirname, "promptfooconfig.ts"),
      "--repeat",
      "3",
      "--no-cache",
      ...process.argv.slice(2),
    ],
    {
      env: {
        ...process.env,
        RAVN_NUDGE_HOME: home,
        PROMPTFOO_CONFIG_DIR: join(home, "promptfoo"),
      },
      shell: process.platform === "win32",
      stdio: "inherit",
    },
  );

  if (result.error) throw result.error;

  process.exitCode = result.status ?? 1;
} finally {
  rmSync(home, { recursive: true, force: true });
}
