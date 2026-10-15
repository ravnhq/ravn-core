import {
  spawnSync,
  type SpawnSyncOptionsWithStringEncoding,
} from "node:child_process";
import { readFileSync } from "node:fs";

const updates = readFileSync(0, "utf8").trim();

function required(command: string, args: string[]): string {
  const options: SpawnSyncOptionsWithStringEncoding = {
    encoding: "utf8",
    timeout: 300_000,
    shell: process.platform === "win32" && command === "pnpm",
  };

  if (command === "pnpm") options.stdio = "inherit";

  const result = spawnSync(command, args, options);

  if (result.error) throw result.error;

  if (result.status !== 0)
    throw new Error(command + " " + args.join(" ") + " failed; push blocked.");

  return (result.stdout ?? "").trim();
}

try {
  const incoming = (updates === "" ? [] : updates.split("\n")).flatMap(
    (line) => {
      const fields = line.split(" ");

      if (fields.length !== 4) throw new Error("Invalid Git pre-push update.");

      const sha = fields[1] ?? "";

      if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(sha))
        throw new Error("Invalid outgoing commit.");

      return /^0+$/.test(sha) ? [] : [sha];
    },
  );

  if (incoming.length > 0) {
    const head = required("git", ["rev-parse", "HEAD"]);

    for (const sha of incoming) {
      if (required("git", ["rev-parse", sha + "^{commit}"]) !== head)
        throw new Error(
          "Push blocked: check out the outgoing commit so validation checks the tree being pushed.",
        );
    }

    if (required("git", ["status", "--porcelain"]) !== "")
      throw new Error(
        "Push blocked: commit or stash changes before validating the outgoing tree.",
      );

    required("pnpm", ["check"]);

    if (
      required("git", ["rev-parse", "HEAD"]) !== head ||
      required("git", ["status", "--porcelain"]) !== ""
    )
      throw new Error("Repository changed during validation; push blocked.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
