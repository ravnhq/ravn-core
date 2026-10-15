import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { pluginDirs } from "./plugins.ts";

const repoDir = join(import.meta.dirname, "..");

const pluginsDir = join(repoDir, "plugins");

const plugins = pluginDirs(pluginsDir);

const mods = plugins.filter((dir) =>
  existsSync(join(dir, "hooks", "hooks.json")),
);

const steps = [
  { label: "marketplace", args: ["plugin", "validate", repoDir] },
  ...plugins.map((dir) => ({
    label: `validate ${basename(dir)}`,
    args: ["plugin", "validate", dir],
  })),
  ...mods.map((dir) => ({
    label: `test ${basename(dir)}`,
    args: ["plugin", "test", dir],
  })),
];

const failures = steps.filter(({ label, args }) => {
  console.log(`== ${label}`);

  return spawnSync("claude", args, { stdio: "inherit" }).status !== 0;
});

for (const { label } of failures) {
  console.error(`FAIL ${label}`);
}

process.exitCode = failures.length === 0 ? 0 : 1;
