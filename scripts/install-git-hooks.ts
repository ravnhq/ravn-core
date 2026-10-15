import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const hook =
  '#!/bin/sh\n# ravn-core managed pre-push\nexec node "$(dirname "$0")/ravn-check-push.ts" "$@"\n';

export function installGitHooks(repoDir: string) {
  const gitPath = (name: "--git-common-dir" | "hooks") => {
    const args = [
      "rev-parse",
      "--path-format=absolute",
      ...(name === "hooks" ? ["--git-path", name] : [name]),
    ];

    const result = spawnSync("git", args, { cwd: repoDir, encoding: "utf8" });

    if (result.status !== 0)
      throw new Error(result.stderr || "Cannot find repository Git hooks.");

    return result.stdout.trim();
  };

  const commonDir = gitPath("--git-common-dir");
  const hooksDir = gitPath("hooks");
  const withinGit = relative(commonDir, hooksDir);

  if (
    isAbsolute(withinGit) ||
    withinGit === ".." ||
    withinGit.startsWith("../") ||
    withinGit.startsWith("..\\")
  )
    throw new Error(
      "Repository pre-push guard cannot replace an external hooks directory: " +
        hooksDir +
        ". Set this repository's core.hooksPath to .git/hooks to install it.",
    );

  const target = join(hooksDir, "pre-push");

  if (existsSync(target) && readFileSync(target, "utf8") !== hook)
    throw new Error(
      "Existing pre-push hook preserved. Integrate scripts/check-push.ts into " +
        target +
        " before installing the repository guard.",
    );

  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(
    join(repoDir, "scripts", "check-push.ts"),
    join(hooksDir, "ravn-check-push.ts"),
  );
  writeFileSync(target, hook, { mode: 0o755 });
  chmodSync(target, 0o755);
}

// npm runs prepare for git installs too, such as `pi install git:...`. Those
// install with --omit=dev; pnpm --prod skips prepare on its own.
const productionInstall = (process.env.npm_config_omit ?? "")
  .split(/[\s,]+/)
  .includes("dev");

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href &&
  !process.env.CI &&
  !productionInstall
) {
  // The guard is advisory and CI is the gate, so a conflict must not fail the install.
  try {
    installGitHooks(join(import.meta.dirname, ".."));
  } catch (error) {
    console.warn(
      "Pre-push guard not installed. " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}
