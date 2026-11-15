import fs from "node:fs";
import { killGroup } from "./run.ts";

// statechart.ts holds this process's stdin open while it runs. When stdin
// closes, statechart.ts is gone, even when a SIGKILL ended it before its own
// cleanup ran, so stop the check and remove what it left behind.
const [pid, ...dirs] = process.argv.slice(2);

process.stdin.resume();

process.stdin.on("end", async () => {
  await killGroup(Number(pid));

  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  process.exit(0);
});
