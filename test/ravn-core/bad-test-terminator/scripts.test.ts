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

const skillDir = join(repoRoot, "plugins/agent/ravn-core/skills/test");

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

  runner?: "jest" | "bun" | "node";

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
      (options.runner
        ? runScript("config.ts", dir, [options.runner]).stdout
        : readFileSync(
            join(
              skillAssets,
              options.effect
                ? "oxlint-bad-test-terminator.effect.json"
                : "oxlint-bad-test-terminator.json",
            ),
            "utf8",
          )),
  );

  mkdirSync(join(dir, "node_modules/.bin"), { recursive: true });

  mkdirSync(join(dir, "node_modules/@oxlint"), { recursive: true });

  symlinkSync(
    join(nodeModules, ".bin/oxlint"),
    join(dir, "node_modules/.bin/oxlint"),
  );

  symlinkSync(join(nodeModules, "oxlint"), join(dir, "node_modules/oxlint"));

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

for (const runner of ["jest", "bun", "node"] as const) {
  test(`verify.ts proves ${runner} guards and accepts behavior assertions`, () => {
    const dir = makePackage(`verify-${runner}`, { runner });
    const result = runScript("verify.ts", dir, [`--runner=${runner}`]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(!existsSync(join(dir, "test/bad-test-terminator-selfcheck")));
  });

  test(`verify.ts rejects missing ${runner} guards`, () => {
    const dir = makePackage(`verify-${runner}-missing`, { oxlintrc: "{}" });
    assert.equal(runScript("verify.ts", dir, [`--runner=${runner}`]).status, 1);
  });
}

test("config.ts rejects an unsupported runner and Effect on another runner", () => {
  assert.equal(runScript("config.ts", tempRoot, ["mocha"]).status, 2);
  assert.equal(runScript("config.ts", tempRoot, ["bun", "--effect"]).status, 2);
});

test("repeat.ts runs every attempt and stops on the first failing attempt", () => {
  const counter = join(tempRoot, "attempts.json");
  const program = join(tempRoot, "attempt.cjs");
  writeFileSync(
    program,
    `const fs = require('node:fs'); const file = process.argv[2]; const n = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) + 1 : 1; fs.writeFileSync(file, JSON.stringify(n)); process.exit(n === Number(process.argv[3]) ? 7 : 0);`,
  );
  assert.equal(
    runScript("repeat.ts", tempRoot, [
      "3",
      process.execPath,
      program,
      counter,
      "0",
    ]).status,
    0,
  );
  assert.equal(JSON.parse(readFileSync(counter, "utf8")), 3);
  assert.equal(
    runScript("repeat.ts", tempRoot, [
      "5",
      process.execPath,
      program,
      counter,
      "5",
    ]).status,
    7,
  );
  assert.equal(JSON.parse(readFileSync(counter, "utf8")), 5);
});

test("check-runner.ts rejects Node suite filters", () => {
  const result = runScript("check-runner.ts", tempRoot, [
    "node",
    "--test-randomize",
    "--test-only",
  ]);

  assert.equal(result.status, 1, result.stdout + result.stderr);
});

test("Node guards recognize CommonJS aliases, subtests, and context APIs", () => {
  const dir = makePackage("node-commonjs", { runner: "node" });
  const file = join(dir, "test/behavior.test.cjs");
  writeFileSync(
    file,
    `
const { test: check, mock: doubles } = require("node:test");
const { strictEqual: equal } = require("node:assert");
check("outer", async (context) => {
  equal(1, 1);
  context.runOnly(true);
  context.mock.method(console, "log");
  await context.test("inner", (child) => { child.assert.snapshot(1); });
});
check("skipped", { skip: "unconditional" }, () => { equal(1, 1); });
check("empty", () => {});
`,
  );

  const result = spawnSync(
    join(dir, "node_modules/.bin/oxlint"),
    ["-f", "json", file],
    { cwd: dir, encoding: "utf8" },
  );

  const report: { diagnostics: { code: string }[] } = JSON.parse(result.stdout);
  const codes = report.diagnostics.map((diagnostic) => diagnostic.code);
  assert.equal(
    codes.filter(
      (code) => code === "bad-test-terminator(no-focused-or-skipped-tests)",
    ).length,
    2,
  );
  assert.equal(
    codes.filter((code) => code === "bad-test-terminator(no-test-doubles)")
      .length,
    1,
  );
  assert.equal(
    codes.filter((code) => code === "bad-test-terminator(test-assertions)")
      .length,
    2,
  );
});

test("Runner guards accept shadowed test names and local methods", () => {
  const dir = makePackage("shadowed", { runner: "node" });
  const file = join(dir, "test/local.test.ts");
  writeFileSync(
    file,
    `
import { test } from "node:test";
import assert from "node:assert/strict";
test("local methods", () => {
  const test = { only() { return 2; } };
  const mock = { method() { return 2; } };
  assert.equal(test.only() + mock.method(), 4);
});
`,
  );

  const result = spawnSync(
    join(dir, "node_modules/.bin/oxlint"),
    ["-f", "json", file],
    { cwd: dir, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stdout + result.stderr);
});

function makeJestPackage(name: string, restoreMocks: boolean) {
  const dir = join(tempRoot, name);
  const packageDir = join(dir, "node_modules/jest");
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(join(dir, "package.json"), "{}");
  writeFileSync(
    join(packageDir, "package.json"),
    JSON.stringify({ name: "jest", exports: { "./bin/jest": "./cli.cjs" } }),
  );

  const resolved = {
    globalConfig: { randomize: true, showSeed: true, passWithNoTests: false },
    configs: [
      { restoreMocks: true, clearMocks: true },
      { restoreMocks, resetMocks: true },
    ],
  };

  writeFileSync(
    join(packageDir, "cli.cjs"),
    `process.stdout.write(${JSON.stringify(JSON.stringify(resolved))});`,
  );

  return dir;
}

test("check-runner.ts checks every resolved Jest project", () => {
  const good = makeJestPackage("jest-settings-good", true);
  const bad = makeJestPackage("jest-settings-bad", false);
  assert.equal(runScript("check-runner.ts", good, ["jest"]).status, 0);
  assert.equal(runScript("check-runner.ts", bad, ["jest"]).status, 1);
  assert.equal(
    runScript("check-runner.ts", good, ["jest", "--onlyFailures"]).status,
    1,
  );
});

test("check-runner.ts requires a package-local Jest installation", () => {
  assert.equal(runScript("check-runner.ts", tempRoot, ["jest"]).status, 2);
});

test("repeat.ts rejects empty commands and nonpositive counts", () => {
  assert.equal(runScript("repeat.ts", tempRoot).status, 2);
  assert.equal(
    runScript("repeat.ts", tempRoot, ["0", process.execPath]).status,
    2,
  );
});

test("verify.ts runs the package's Oxlint through Node without a shell shim", () => {
  const dir = makePackage("verify-no-shell-shim", { runner: "bun" });
  rmSync(join(dir, "node_modules/.bin/oxlint"));
  const result = runScript("verify.ts", dir, ["--runner=bun"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
