import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { test } from "node:test";
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
