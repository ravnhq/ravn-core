#!/usr/bin/env node
// Proves the installed guards bite: lints fixtures of banned and allowed test
// code with the Oxlint configuration the repository already has, then cleans
// up the copies.
//
//   node <skill-directory>/scripts/verify.ts [test-directory] [--runner=vitest|jest|bun|node] [--effect | --no-effect]
//
// test-directory defaults to "test". The Effect fixtures run when the package
// manifest lists effect or @effect/vitest as a direct dependency; the flags
// override that.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

type Manifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type Diagnostic = { filename: string; code: string };

const skillRoot = resolve(import.meta.dirname, "..");

const runnerOption = process.argv.find((argument) =>
  argument.startsWith("--runner="),
);

const runner = runnerOption?.slice("--runner=".length) ?? "vitest";

if (!["vitest", "jest", "bun", "node"].includes(runner)) {
  console.error("Use --runner=vitest|jest|bun|node");
  process.exit(2);
}

const fixtures = resolve(
  skillRoot,
  "assets/fixtures",
  runner === "vitest" ? "." : runner,
);

const arguments_ = process.argv.slice(2);

function manifestListsEffect() {
  try {
    const manifest: Manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    );

    const direct = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
    };

    return "effect" in direct || "@effect/vitest" in direct;
  } catch {
    return false;
  }
}

const effect =
  runner === "vitest" &&
  (arguments_.includes("--effect") ||
    (!arguments_.includes("--no-effect") && manifestListsEffect()));

const testDirectory = resolve(
  process.cwd(),
  arguments_.find((argument) => !argument.startsWith("--")) ?? "test",
);

const staging = join(testDirectory, "bad-test-terminator-selfcheck");

const vitestExpected = {
  "banned.test.ts": {
    "eslint(no-restricted-globals)": 3,
    "eslint(no-restricted-imports)": 1,
    "eslint(no-restricted-properties)": 3,
    "bad-test-terminator(no-current-date)": 1,
    "bad-test-terminator(no-focused-or-skipped-tests)": 2,
    "bad-test-terminator(no-test-retries)": 1,
    "vitest(expect-expect)": 1,
    "vitest(valid-expect)": 1,
    "vitest(no-conditional-expect)": 1,
    "vitest(no-standalone-expect)": 1,
    "vitest(no-restricted-matchers)": 2,
    "vitest(no-restricted-vi-methods)": 2,
  },
  "banned-effect.test.ts": {
    "eslint(no-restricted-imports)": 3,
    "eslint(no-restricted-properties)": 3,
    "bad-test-terminator(no-focused-or-skipped-tests)": 2,
    "bad-test-terminator-effect(no-live-test-runtime)": 2,
    "vitest(expect-expect)": 1,
  },
};

const expected: Record<string, Record<string, number>> = runner === "vitest"
  ? vitestExpected
  : {
      "banned.test.ts":
        runner === "node"
          ? {
              "eslint(no-restricted-globals)": 2,
              "eslint(no-restricted-imports)": 1,
              "eslint(no-restricted-properties)": 3,
              "bad-test-terminator(no-current-date)": 1,
              "bad-test-terminator(no-focused-or-skipped-tests)": 3,
              "bad-test-terminator(no-test-retries)": 1,
              "bad-test-terminator(no-test-doubles)": 3,
              "bad-test-terminator(test-assertions)": 3,
            }
          : {
              "eslint(no-restricted-globals)": 3,
              "eslint(no-restricted-imports)": 1,
              "eslint(no-restricted-properties)": 3,
              "bad-test-terminator(no-current-date)": 1,
              "bad-test-terminator(no-focused-or-skipped-tests)": 2,
              "bad-test-terminator(no-test-retries)": 1,
              "bad-test-terminator(no-test-doubles)": 2,
              "jest(expect-expect)": 1,
              "jest(valid-expect)": 1,
              "jest(no-conditional-expect)": 1,
              "jest(no-standalone-expect)": 1,
              "jest(no-restricted-matchers)": 2,
            },
    };

if (runner === "bun") {
  const codes = expected["banned.test.ts"];

  if (codes !== undefined) {
    for (const code of Object.keys(codes))
      if (code.startsWith("jest(")) delete codes[code];
    codes["bad-test-terminator(test-assertions)"] = 6;
  }
}

if (runner === "bun" || runner === "node") {
  for (const name of [
    "missing",
    "conditional",
    "snapshot",
    "calls",
    ...(runner === "bun" ? ["incomplete", "standalone"] : []),
  ]) {
    expected[`banned-${name}.test.ts`] = {
      "bad-test-terminator(test-assertions)": 1,
    };
  }
}

const allowed = ["allowed.test.ts", "allowed-effect.test.ts"];

const guardCodes = new Set(
  Object.values(expected).flatMap((codes) => Object.keys(codes)),
);

const selected = (name: string) => effect || !name.includes("effect");

function findOxlint(from: string) {
  for (let directory = from; ; directory = dirname(directory)) {
    const candidate = join(directory, "node_modules/.bin/oxlint");

    if (existsSync(candidate)) return candidate;

    if (dirname(directory) === directory) return null;
  }
}

const oxlint = findOxlint(process.cwd());

if (oxlint === null) {
  console.error(
    "No node_modules/.bin/oxlint at or above the current directory. Install oxlint, then run this from the package that owns the lint configuration.",
  );

  process.exit(2);
}

if (!existsSync(testDirectory)) {
  console.error(
    `${testDirectory} does not exist. Pass a directory that holds test files as the first argument.`,
  );

  process.exit(2);
}

if (existsSync(staging)) {
  console.error(
    `${staging} already exists. Clear it, then run the check again.`,
  );

  process.exit(2);
}

const fixtureLabel = effect
  ? "generic and Effect fixtures"
  : "generic fixtures";

console.log(`Checking ${runner}: the ${fixtureLabel} in ${staging}`);

let failures = 0;

try {
  mkdirSync(staging, { recursive: true });

  for (const name of [...Object.keys(expected), ...allowed].filter(selected)) {
    cpSync(join(fixtures, name), join(staging, name));
  }

  const run = spawnSync(oxlint, ["-f", "json", staging], {
    encoding: "utf8",
  });

  let diagnostics: Diagnostic[];

  try {
    // SAFETY: `oxlint -f json` prints `{ "diagnostics": [...] }`; a parse
    // failure is reported and exits above.
    diagnostics = (JSON.parse(run.stdout) as { diagnostics: Diagnostic[] })
      .diagnostics;
  } catch {
    console.error(`Oxlint did not return JSON:\n${run.stdout}\n${run.stderr}`);

    process.exit(2);
  }

  const counts = new Map<string, number>();

  for (const diagnostic of diagnostics) {
    const file = diagnostic.filename.split(/[\\/]/).at(-1);

    const key = `${file} ${diagnostic.code}`;

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const [name, codes] of Object.entries(expected).filter(([name]) =>
    selected(name),
  )) {
    for (const [code, wanted] of Object.entries(codes)) {
      const found = counts.get(`${name} ${code}`) ?? 0;

      const ok = found >= wanted;

      if (!ok) failures += 1;

      const verdict = ok ? "ok  " : "FAIL";

      console.log(
        `${verdict} ${name}: ${code} reported ${found}, needs at least ${wanted}`,
      );
    }
  }

  for (const name of allowed.filter(selected)) {
    const reported = [...counts].filter(
      ([key]) =>
        key.startsWith(`${name} `) &&
        guardCodes.has(key.slice(name.length + 1)),
    );

    const ok = reported.length === 0;

    if (!ok) failures += 1;

    if (ok) {
      console.log(`ok   ${name}: no guard rule reports allowed code`);
    } else {
      const rules = reported
        .map(([key, count]) => key.slice(name.length + 1) + " x" + count)
        .join(", ");

      console.log(`FAIL ${name}: guard rules report allowed code: ${rules}`);
    }
  }
} finally {
  rmSync(staging, { recursive: true, force: true });
}

const summary =
  failures === 0
    ? "The guards catch every banned construct and accept the allowed ones."
    : `${failures} check(s) failed. Compare the lint configuration with the bundled block.`;

console.log(summary);

process.exit(failures === 0 ? 0 : 1);
