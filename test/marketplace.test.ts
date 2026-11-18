import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { test } from "node:test";
import { z } from "zod";
import { runtimeSkillsDirectory } from "../plugins/agent/ravn-core/opencode/skill-directory.ts";
import { pluginDirs, tiers } from "../scripts/plugins.ts";

const repoDir = join(import.meta.dirname, "..");

const pluginsDir = join(repoDir, "plugins");

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

const marketplace = readJson(
  join(repoDir, ".claude-plugin", "marketplace.json"),
);

const plugins = pluginDirs(pluginsDir);

const pluginNames = plugins.map((dir) => basename(dir));

const ravnCoreDir = join(pluginsDir, "agent", "ravn-core");

test("the Claude Code marketplace lists every plugin", () => {
  const listed = marketplace.plugins
    .map((entry: { name: string }) => entry.name)
    .sort();

  assert.deepEqual(listed, pluginNames);
});

test("the Claude Code marketplace points every entry at its plugin directory", () => {
  for (const dir of plugins) {
    const entry = marketplace.plugins.find(
      (candidate: { name: string }) => candidate.name === basename(dir),
    );

    assert.equal(entry.source, `./${relative(repoDir, dir)}`);
  }
});

const tierOf = (dir: string) => {
  if (existsSync(join(dir, "plugin.json"))) {
    return "agent";
  }

  return existsSync(join(dir, "hooks", "hooks.json")) ? "mods" : "no tier";
};

test("every plugin sits in the tier folder its manifest implies", () => {
  for (const dir of plugins) {
    assert.equal(relative(pluginsDir, dir), join(tierOf(dir), basename(dir)));
  }

  assert.deepEqual(
    readdirSync(pluginsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(),
    [...tiers],
  );
});

const agentPlugins = plugins.filter((dir) =>
  existsSync(join(dir, "plugin.json")),
);

for (const dir of agentPlugins) {
  const name = basename(dir);

  test(`the ${name} marketplace entry matches its plugin.json`, () => {
    const manifest = readJson(join(dir, "plugin.json"));

    const entry = marketplace.plugins.find(
      (candidate: { name: string }) => candidate.name === name,
    );

    for (const field of [
      "name",
      "version",
      "description",
      "author",
      "homepage",
      "repository",
      "license",
      "keywords",
    ]) {
      assert.deepEqual(entry[field], manifest[field], field);
    }
  });
}

test("the ravn-core Pi package version matches plugin.json and the Claude marketplace", () => {
  const manifest = readJson(join(ravnCoreDir, "plugin.json"));
  const piPackage = readJson(join(ravnCoreDir, "package.json"));

  const entry = marketplace.plugins.find(
    (candidate: { name: string }) => candidate.name === "ravn-core",
  );

  assert.equal(piPackage.name, "ravn-core");
  assert.equal(piPackage.private, true);
  assert.equal(piPackage.type, "module");
  assert.deepEqual(piPackage.keywords, ["pi-package"]);
  assert.deepEqual(piPackage.pi, { skills: ["./skills"] });
  assert.equal(piPackage.version, manifest.version);
  assert.equal(piPackage.version, entry.version);
});

test("a Pi install of the repo root loads only the ravn-core skills", () => {
  const rootPackage = readJson(join(repoDir, "package.json"));

  assert.deepEqual(rootPackage.pi, {
    skills: [`./${relative(repoDir, join(ravnCoreDir, "skills"))}`],
  });
});

test("an OpenCode package install includes the server, skills, and their assets", () => {
  const manifest = z
    .object({ exports: z.object({ ".": z.string().startsWith("./") }) })
    .parse(readJson(join(ravnCoreDir, "package.json")));

  const output = execFileSync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    {
      cwd: ravnCoreDir,
      encoding: "utf8",
      shell: process.platform === "win32",
    },
  );

  const [pack] = z
    .tuple([z.object({ files: z.array(z.object({ path: z.string() })) })])
    .parse(JSON.parse(output));

  const paths = new Set(pack.files.map((file) => file.path));

  assert.ok(paths.has(manifest.exports["."].slice(2)), "server entry point");

  const skillsDir = join(ravnCoreDir, "skills");

  for (const skill of readdirSync(skillsDir, { withFileTypes: true })) {
    if (skill.isDirectory()) {
      assert.ok(paths.has(`skills/${skill.name}/SKILL.md`), skill.name);
    }
  }

  for (const file of [
    "assets/config/oxlint-bad-test-terminator.json",
    "references/prune.md",
    "scripts/install.ts",
  ]) {
    assert.ok(paths.has(`skills/bad-test-terminator/${file}`), file);
  }
});

test("Node can run a skill helper from an installed OpenCode package", async () => {
  const dir = mkdtempSync(join(tmpdir(), "opencode-ravn-core-"));

  try {
    const installed = join(dir, "node_modules", "ravn-core", "skills");
    const skill = "bad-test-terminator";

    cpSync(join(ravnCoreDir, "skills", skill), join(installed, skill), {
      recursive: true,
    });

    const [first, second] = await Promise.all([
      runtimeSkillsDirectory(installed),
      runtimeSkillsDirectory(installed),
    ]);

    assert.equal(first, second);
    assert.ok(existsSync(join(first, skill, "references", "prune.md")));

    execFileSync(
      process.execPath,
      [join(first, skill, "scripts", "install.ts")],
      {
        cwd: dir,
      },
    );

    const guard = "index.ts";

    assert.deepEqual(
      readFileSync(join(dir, "tools", "oxlint", skill, guard)),
      readFileSync(join(installed, skill, "assets", skill, guard)),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("sync-versions --check accepts the current tree", () => {
  const result = spawnSync(
    process.execPath,
    [join(repoDir, "scripts/sync-versions.ts"), "--check"],
    { cwd: repoDir, encoding: "utf8" },
  );

  assert.equal(result.status, 0);
});

test("sync-versions changes only the version lines it syncs", () => {
  const dir = mkdtempSync(join(tmpdir(), "sync-versions-"));

  try {
    for (const path of [
      "scripts",
      "plugins",
      ".claude-plugin",
      "biome.json",
      ".gitignore",
    ]) {
      cpSync(join(repoDir, path), join(dir, path), { recursive: true });
    }

    symlinkSync(join(repoDir, "node_modules"), join(dir, "node_modules"));

    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: dir, encoding: "utf8" });

    git("init", "-q");
    git("add", "-A");
    git(
      "-c",
      "user.name=test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "-qm",
      "base",
    );

    const manifestPath = join(
      dir,
      relative(repoDir, ravnCoreDir),
      "plugin.json",
    );

    const manifest = readFileSync(manifestPath, "utf8");

    const { version } = JSON.parse(manifest);

    writeFileSync(
      manifestPath,
      manifest.replace(`"version": "${version}"`, '"version": "99.0.0"'),
    );

    const result = spawnSync(
      process.execPath,
      [join(dir, "scripts/sync-versions.ts")],
      { cwd: dir, encoding: "utf8" },
    );

    assert.equal(result.status, 0, result.stderr);

    const changed = git("diff", "--numstat").trim().split("\n").sort();

    assert.deepEqual(changed, [
      "1\t1\t.claude-plugin/marketplace.json",
      "1\t1\tplugins/agent/ravn-core/.cursor-plugin/plugin.json",
      "1\t1\tplugins/agent/ravn-core/package.json",
      "1\t1\tplugins/agent/ravn-core/plugin.json",
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the ravn-core Cursor manifest matches plugin.json", () => {
  const manifest = readJson(join(ravnCoreDir, "plugin.json"));

  const cursor = readJson(join(ravnCoreDir, ".cursor-plugin", "plugin.json"));

  for (const field of [
    "name",
    "version",
    "description",
    "author",
    "homepage",
    "repository",
    "license",
    "keywords",
  ]) {
    assert.deepEqual(cursor[field], manifest[field], field);
  }
});

test("the Cursor marketplace lists only ravn-core", () => {
  const catalogPath = join(repoDir, ".cursor-plugin", "marketplace.json");

  assert.equal(existsSync(catalogPath), true);

  const catalog = readJson(catalogPath);

  assert.deepEqual(
    catalog.plugins.map((entry: { name: string }) => entry.name),
    ["ravn-core"],
  );
  assert.equal(catalog.plugins[0].source, "plugins/agent/ravn-core");
});

test("the Codex marketplace lists only ravn-core", () => {
  const catalogPath = join(repoDir, ".agents", "plugins", "marketplace.json");

  assert.equal(existsSync(catalogPath), true);

  const catalog = readJson(catalogPath);

  assert.deepEqual(
    catalog.plugins.map((entry: { name: string }) => entry.name),
    ["ravn-core"],
  );
  assert.equal(catalog.plugins[0].source.path, "./plugins/agent/ravn-core");
});

test("user-invoked ravn-core skills disable Codex implicit invocation", () => {
  const skillsDir = join(ravnCoreDir, "skills");

  const names = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const name of names) {
    const skill = readFileSync(join(skillsDir, name, "SKILL.md"), "utf8");
    const userInvoked = /^disable-model-invocation:\s*true\s*$/m.test(skill);
    const policyPath = join(skillsDir, name, "agents", "openai.yaml");

    if (userInvoked) {
      assert.equal(existsSync(policyPath), true, `${name} agents/openai.yaml`);
      assert.match(
        readFileSync(policyPath, "utf8"),
        /allow_implicit_invocation:\s*false/,
      );
    } else if (existsSync(policyPath)) {
      assert.doesNotMatch(
        readFileSync(policyPath, "utf8"),
        /allow_implicit_invocation:\s*false/,
      );
    }
  }
});

for (const dir of plugins) {
  const name = basename(dir);

  test(`the ${name} marketplace entry carries its plugin version`, () => {
    const manifestPath = [
      join(dir, ".claude-plugin", "plugin.json"),
      join(dir, "plugin.json"),
    ].find((path) => existsSync(path));

    assert.ok(manifestPath, "plugin manifest");

    const entry = marketplace.plugins.find(
      (candidate: { name: string }) => candidate.name === name,
    );

    assert.equal(entry?.version, readJson(manifestPath).version);
  });
}
