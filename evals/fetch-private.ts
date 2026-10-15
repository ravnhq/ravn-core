import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { privateDir } from "./workspace-repo.ts";

// The eval cases and fixtures derive from private Ravn code. Without access
// to their repo, evals cannot run; tests that need them skip.
const url =
  process.env.RAVN_EVALS_PRIVATE_URL ??
  "https://github.com/ravnhq/ravn-core-evals.git";

const git = (args: string[]) => {
  const result = spawnSync("git", args, { stdio: "inherit" });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

if (existsSync(join(privateDir, ".git"))) {
  git(["-C", privateDir, "pull", "-q", "--ff-only"]);
} else {
  git(["clone", "-q", url, privateDir]);
}

console.log(`private evals ready in ${privateDir}`);
