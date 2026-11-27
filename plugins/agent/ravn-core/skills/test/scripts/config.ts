#!/usr/bin/env node
// Print the lint block for a runner; merge it into the package's Oxlint configuration.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const runner = process.argv[2] ?? "vitest";

const effect = process.argv.includes("--effect");

if (
  !["vitest", "jest", "bun", "node"].includes(runner) ||
  (effect && runner !== "vitest")
) {
  console.error(
    "Usage: config.ts vitest|jest|bun|node [--effect (Vitest only)]",
  );
  process.exit(2);
}

type Override = {
  files: string[];
  plugins: string[];
  rules: Record<string, string | (string | object)[]> & {
    "vitest/no-restricted-matchers": [string, Record<string, string>];
  };
};

type Block = {
  ignorePatterns: string[];
  jsPlugins: { name: string; specifier: string }[];
  overrides: Override[];
};

const block: Block = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../assets/config",
      effect
        ? "oxlint-bad-test-terminator.effect.json"
        : "oxlint-bad-test-terminator.json",
    ),
    "utf8",
  ),
);

const override = block.overrides[0];

if (override === undefined)
  throw new Error("The bundled block has no test override.");

if (runner !== "vitest") {
  const rules = override.rules;
  const matchers = Object.keys(rules["vitest/no-restricted-matchers"][1]);

  for (const [name, value] of Object.entries(rules)) {
    if (!name.startsWith("vitest/")) continue;
    delete rules[name];

    if (
      runner === "jest" &&
      ![
        "vitest/warn-todo",
        "vitest/no-restricted-vi-methods",
        "vitest/require-mock-type-parameters",
        "vitest/require-to-throw-message",
        "vitest/prefer-snapshot-hint",
      ].includes(name)
    )
      rules[name.replace("vitest/", "jest/")] = value;
  }

  override.plugins = runner === "jest" ? ["jest"] : [];
  rules["bad-test-terminator/no-test-doubles"] = "error";

  if (runner !== "jest")
    rules["bad-test-terminator/test-assertions"] = ["error", { matchers }];
}

console.log(JSON.stringify(block, null, 2));
