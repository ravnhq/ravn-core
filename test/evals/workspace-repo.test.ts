import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pluginSkillDirs } from "../../evals/workspace-repo.ts";

test("pluginSkillDirs returns only agent plugin skills", (t) => {
  const pluginsDir = mkdtempSync(join(tmpdir(), "plugins-"));

  t.after(() => rmSync(pluginsDir, { recursive: true, force: true }));

  mkdirSync(join(pluginsDir, "agent-plugin", "skills"), { recursive: true });

  writeFileSync(join(pluginsDir, "agent-plugin", "plugin.json"), "{}");

  mkdirSync(join(pluginsDir, "apps-plugin", ".claude-plugin"), {
    recursive: true,
  });

  mkdirSync(join(pluginsDir, "apps-plugin", "skills"));

  writeFileSync(
    join(pluginsDir, "apps-plugin", ".claude-plugin", "plugin.json"),
    "{}",
  );

  writeFileSync(join(pluginsDir, ".DS_Store"), "");

  assert.deepEqual(pluginSkillDirs(pluginsDir), [
    join(pluginsDir, "agent-plugin", "skills"),
  ]);
});

test("pluginSkillDirs finds agent plugins inside tier folders", (t) => {
  const pluginsDir = mkdtempSync(join(tmpdir(), "plugins-"));

  t.after(() => rmSync(pluginsDir, { recursive: true, force: true }));

  mkdirSync(join(pluginsDir, "agent", "agent-plugin", "skills"), {
    recursive: true,
  });

  writeFileSync(join(pluginsDir, "agent", "agent-plugin", "plugin.json"), "{}");

  writeFileSync(join(pluginsDir, "agent", "AGENTS.md"), "");

  mkdirSync(join(pluginsDir, "apps", "apps-plugin", ".claude-plugin"), {
    recursive: true,
  });

  writeFileSync(
    join(pluginsDir, "apps", "apps-plugin", ".claude-plugin", "plugin.json"),
    "{}",
  );

  assert.deepEqual(pluginSkillDirs(pluginsDir), [
    join(pluginsDir, "agent", "agent-plugin", "skills"),
  ]);
});
