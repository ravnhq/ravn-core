import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { z } from "zod";
import { pluginDirs } from "./plugins.ts";

const repoDir = join(import.meta.dirname, "..");

const marketplacePath = join(repoDir, ".claude-plugin", "marketplace.json");

const syncVersions = (check: boolean) => {
  const versionField = z.object({ version: z.string() });
  const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));
  const problems: string[] = [];
  const writes: { path: string; body: { version: string } }[] = [];
  const marketplace = readJson(marketplacePath);
  let marketplaceChanged = false;

  for (const dir of pluginDirs(join(repoDir, "plugins"))) {
    const name = basename(dir);
    const rootManifest = join(dir, "plugin.json");
    const nestedManifest = join(dir, ".claude-plugin", "plugin.json");
    const manifest = existsSync(rootManifest) ? rootManifest : nestedManifest;
    const expected = versionField.parse(readJson(manifest)).version;

    const entry = marketplace.plugins.find(
      (plugin: { name: string }) => plugin.name === name,
    );

    if (entry === undefined) throw new Error(`No ${name} marketplace entry.`);

    if (entry.version !== expected) {
      problems.push(`${name} marketplace: ${entry.version} -> ${expected}`);
      entry.version = expected;
      marketplaceChanged = true;
    }

    for (const path of ["package.json", ".cursor-plugin/plugin.json"]) {
      const file = join(dir, path);

      if (!existsSync(file)) continue;

      const body = readJson(file);
      const parsed = versionField.safeParse(body);

      if (!parsed.success || parsed.data.version === expected) continue;

      const shown = relative(repoDir, file).split(sep).join("/");

      problems.push(`${shown}: ${parsed.data.version} -> ${expected}`);
      body.version = expected;
      writes.push({ path: file, body });
    }
  }

  if (problems.length === 0) console.log("Versions match.");
  else console[check ? "error" : "log"](problems.join("\n"));

  if (check || problems.length === 0) {
    if (problems.length > 0) process.exitCode = 1;

    return;
  }

  const json = (value: { version: string }) =>
    JSON.stringify(value, null, 2) + "\n";

  if (marketplaceChanged) writeFileSync(marketplacePath, json(marketplace));

  for (const write of writes) writeFileSync(write.path, json(write.body));
};

if (import.meta.main) {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");

  try {
    if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
      throw new Error("Usage: node scripts/sync-versions.ts [--check]");
    }

    syncVersions(args[0] === "--check");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
