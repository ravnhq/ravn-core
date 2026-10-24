import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  cursorPluginDir,
  installSkills,
  pluginSkillDirs,
  workspaceCleanExcludes,
} from "../../evals/workspace-repo.ts";

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

test("cursor installs skills as a local plugin and preserves that directory", (t) => {
  const root = mkdtempSync(join(tmpdir(), "cursor-plugin-"));

  t.after(() => rmSync(root, { recursive: true, force: true }));

  const source = join(root, "source");

  mkdirSync(join(source, "skills", "greet"), { recursive: true });

  writeFileSync(join(source, "skills", "greet", "SKILL.md"), "# greet\n");

  mkdirSync(join(source, "agents"), { recursive: true });

  writeFileSync(join(source, "agents", "verifier.md"), "# verifier\n");

  const smoke = join(root, "smoke");

  mkdirSync(join(smoke, "skills", "greet-explicit"), { recursive: true });

  writeFileSync(
    join(smoke, "skills", "greet-explicit", "SKILL.md"),
    "# explicit\n",
  );

  const workspace = join(root, "workspace");

  installSkills(
    workspace,
    [join(source, "skills"), join(smoke, "skills")],
    "cursor",
  );

  const pluginDir = cursorPluginDir(workspace);

  const manifest = join(
    import.meta.dirname,
    "..",
    "..",
    "plugins",
    "agent",
    "ravn-core",
    ".cursor-plugin",
    "plugin.json",
  );

  assert.equal(
    readFileSync(join(pluginDir, ".cursor-plugin", "plugin.json"), "utf8"),
    readFileSync(manifest, "utf8"),
  );

  assert.equal(
    readFileSync(join(pluginDir, "skills", "greet", "SKILL.md"), "utf8"),
    "# greet\n",
  );

  assert.equal(
    readFileSync(
      join(pluginDir, "skills", "greet-explicit", "SKILL.md"),
      "utf8",
    ),
    "# explicit\n",
  );

  assert.equal(
    readFileSync(join(pluginDir, "agents", "verifier.md"), "utf8"),
    "# verifier\n",
  );

  assert.equal(existsSync(join(workspace, ".agents", "skills")), false);

  assert.ok(workspaceCleanExcludes.includes("/.cursor/plugins/"));
});

test("a cursor workspace with no skills still installs the plugin manifest", (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "cursor-empty-"));

  t.after(() => rmSync(workspace, { recursive: true, force: true }));

  installSkills(workspace, [], "cursor");

  const manifest = join(
    import.meta.dirname,
    "..",
    "..",
    "plugins",
    "agent",
    "ravn-core",
    ".cursor-plugin",
    "plugin.json",
  );

  assert.equal(
    readFileSync(
      join(cursorPluginDir(workspace), ".cursor-plugin", "plugin.json"),
      "utf8",
    ),
    readFileSync(manifest, "utf8"),
  );

  assert.deepEqual(readdirSync(join(cursorPluginDir(workspace), "skills")), []);
});
