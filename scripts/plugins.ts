import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

export const tiers = ["agent", "mods"] as const;

const isPlugin = (dir: string) =>
  existsSync(join(dir, "plugin.json")) ||
  existsSync(join(dir, ".claude-plugin", "plugin.json"));

const subdirs = (dir: string) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(dir, entry.name));

// Plugins live at plugins/<tier>/<name>. A directory with its own manifest
// counts as a plugin too, so a tree exported from before the tier folders
// (the evals baseline arm) still resolves.
export const pluginDirs = (pluginsDir: string): string[] =>
  existsSync(pluginsDir)
    ? subdirs(pluginsDir)
        .flatMap((dir) =>
          isPlugin(dir) ? [dir] : subdirs(dir).filter(isPlugin),
        )
        .sort((a, b) => basename(a).localeCompare(basename(b)))
    : [];

export const agentPluginDirs = (pluginsDir: string): string[] =>
  pluginDirs(pluginsDir).filter((dir) => existsSync(join(dir, "plugin.json")));

export const pluginDir = (pluginsDir: string, name: string) =>
  pluginDirs(pluginsDir).find((dir) => basename(dir) === name);
