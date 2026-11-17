import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const repoRoot = realpathSync(join(import.meta.dirname, "..", "..", ".."));

const skillDir = join(
  repoRoot,
  "plugins/agent/ravn-core/skills/bad-test-terminator",
);

const skillScripts = join(skillDir, "scripts");

const skillAssets = join(skillDir, "assets/config");

const tempRoot = realpathSync(
  mkdtempSync(join(tmpdir(), "bad-test-terminator-")),
);

after(() => rmSync(tempRoot, { recursive: true, force: true }));

const nodeModules = join(repoRoot, "node_modules");

function runScript(name: string, cwd: string, args: string[] = []) {
  return spawnSync(process.execPath, [join(skillScripts, name), ...args], {
    cwd,
    encoding: "utf8",
  });
}

type PackageOptions = {
  // Merges the bundled Effect block and lists effect as a direct dependency.
  effect?: boolean;

  // Written as the whole .oxlintrc.json; defaults to the bundled block.
  oxlintrc?: string;
};

type FixtureManifest = {
  name: string;
  private: boolean;
  dependencies?: Record<string, string>;
};

// A package with the plugin installed by the skill, a lint configuration, and
// the repository's own oxlint and @oxlint/plugins on its resolve path.
function makePackage(name: string, options: PackageOptions = {}) {
  const dir = join(tempRoot, name);

  const manifest: FixtureManifest = { name: "fixture", private: true };

  if (options.effect) manifest.dependencies = { effect: "3.19.0" };

  mkdirSync(join(dir, "test"), { recursive: true });

  writeFileSync(join(dir, "package.json"), JSON.stringify(manifest));

  assert.equal(runScript("install.ts", dir).status, 0);

  writeFileSync(
    join(dir, ".oxlintrc.json"),
    options.oxlintrc ??
      readFileSync(
        join(
          skillAssets,
          options.effect
            ? "oxlint-bad-test-terminator.effect.json"
            : "oxlint-bad-test-terminator.json",
        ),
        "utf8",
      ),
  );

  mkdirSync(join(dir, "node_modules/.bin"), { recursive: true });

  mkdirSync(join(dir, "node_modules/@oxlint"), { recursive: true });

  symlinkSync(
    join(nodeModules, ".bin/oxlint"),
    join(dir, "node_modules/.bin/oxlint"),
  );

  symlinkSync(
    join(nodeModules, "@oxlint/plugins"),
    join(dir, "node_modules/@oxlint/plugins"),
  );

  return dir;
}

// The part of the resolved Vitest configuration check-vitest.ts reads.
type StubbedSettings = {
  sequence: { shuffle: boolean };
  retry: number;
  allowOnly: boolean;
  passWithNoTests: boolean;
  restoreMocks: boolean;
  unstubGlobals: boolean;
  unstubEnvs: boolean;
};

// A package whose node_modules holds a vitest stub exporting resolveConfig,
// so the script reads settings without installing Vitest.
function makeVitestPackage(name: string, settings: StubbedSettings) {
  const dir = join(tempRoot, name);

  mkdirSync(join(dir, "node_modules/vitest"), { recursive: true });

  writeFileSync(
    join(dir, "node_modules/vitest/package.json"),
    JSON.stringify({ name: "vitest", exports: { "./node": "./node.cjs" } }),
  );

  writeFileSync(
    join(dir, "node_modules/vitest/node.cjs"),
    `module.exports = { resolveConfig: async () => ({ vitestConfig: ${JSON.stringify(settings)} }) };`,
  );

  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fixture" }));

  return dir;
}

const bundledVitestSettings: StubbedSettings = {
  sequence: { shuffle: true },
  retry: 0,
  allowOnly: false,
  passWithNoTests: false,
  restoreMocks: true,
  unstubGlobals: true,
  unstubEnvs: true,
};

test("install.ts copies the bundle and starts an accurate provenance record", () => {
  const dir = makePackage("install");

  for (const path of [
    "index.ts",
    "effect/index.ts",
    "rules/no-current-date.ts",
    "rules/no-focused-or-skipped-tests.ts",
    "rules/no-test-retries.ts",
    "effect/rules/no-live-test-runtime.ts",
    "shared/test-api.ts",
    "UPSTREAM.md",
  ]) {
    assert.ok(
      existsSync(join(dir, "tools/oxlint/bad-test-terminator", path)),
      path,
    );
  }

  const upstream = readFileSync(
    join(dir, "tools/oxlint/bad-test-terminator/UPSTREAM.md"),
    "utf8",
  );

  assert.match(
    upstream,
    /Source: `bad-test-terminator` skill, bundle `[0-9a-f]{12}`/,
  );

  const installed = readFileSync(
    join(dir, "tools/oxlint/bad-test-terminator/index.ts"),
    "utf8",
  );

  const hash = createHash("sha256").update(installed).digest("hex");

  assert.ok(
    upstream.includes(`| \`index.ts\` | \`${hash}\` |`),
    "the provenance hash table matches the installed file",
  );
});

test("install.ts refuses to overwrite an existing copy", () => {
  const dir = join(tempRoot, "install");

  assert.equal(runScript("install.ts", dir).status, 1);

  assert.ok(
    existsSync(join(dir, "tools/oxlint/bad-test-terminator/UPSTREAM.md")),
  );
});

test("verify.ts proves the guards bite on a fresh install", () => {
  const dir = makePackage("verify-fresh");

  assert.equal(runScript("verify.ts", dir).status, 0);

  // The self-check cleans up after itself.
  assert.ok(!existsSync(join(dir, "test/bad-test-terminator-selfcheck")));
});

test("verify.ts fails when the guards are not registered", () => {
  const dir = makePackage("verify-unregistered", { oxlintrc: "{}" });

  assert.equal(runScript("verify.ts", dir).status, 1);
});

test("verify.ts covers the Effect fixtures when the manifest lists effect", () => {
  const dir = makePackage("verify-effect", { effect: true });

  assert.equal(runScript("verify.ts", dir).status, 0);
});

test("check-vitest.ts exits 2 when vitest is not installed", () => {
  const dir = join(tempRoot, "check-vitest-missing");

  mkdirSync(dir, { recursive: true });

  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fixture" }));

  assert.equal(runScript("check-vitest.ts", dir).status, 2);
});

test("check-vitest.ts passes the seven bundled settings", () => {
  const dir = makeVitestPackage("check-vitest-ok", bundledVitestSettings);

  assert.equal(runScript("check-vitest.ts", dir).status, 0);
});

test("check-vitest.ts exits 1 when a setting differs", () => {
  const dir = makeVitestPackage("check-vitest-differs", {
    ...bundledVitestSettings,
    retry: 1,
  });

  assert.equal(runScript("check-vitest.ts", dir).status, 1);
});
