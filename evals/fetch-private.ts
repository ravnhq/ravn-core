import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { privateDir } from "./workspace-repo.ts";

// The eval cases and fixtures derive from private Ravn code. Without access
// to their repo, evals cannot run; tests that need them skip.
const url =
  process.env.RAVN_EVALS_PRIVATE_URL ??
  "https://github.com/ravnhq/ravn-core-evals.git";

const ref = readFileSync(
  join(import.meta.dirname, "private-ref.txt"),
  "utf8",
).trim();

const git = (args: string[]) => {
  const result = spawnSync("git", args, { stdio: "inherit" });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

if (!existsSync(join(privateDir, ".git"))) {
  git(["clone", "--no-checkout", "-q", url, privateDir]);
}

git(["-C", privateDir, "fetch", "-q", "origin", ref]);

git(["-C", privateDir, "switch", "-q", "--detach", "FETCH_HEAD"]);

console.log(`private evals ${ref} ready in ${privateDir}`);
