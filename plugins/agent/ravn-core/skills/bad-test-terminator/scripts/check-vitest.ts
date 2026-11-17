#!/usr/bin/env node
// Prints the guard settings Vitest resolves for the current package and exits
// 1 when one differs.
//
//   node <skill-directory>/scripts/check-vitest.ts
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// The seven settings every install must resolve, with their bundled values.
const wanted = {
  "sequence.shuffle": true,
  retry: 0,
  allowOnly: false,
  passWithNoTests: false,
  restoreMocks: true,
  unstubGlobals: true,
  unstubEnvs: true,
} as const;

// The part of the resolved Vitest configuration the guard settings live in.
// Vitest 3 returns it as `vitestConfig`, older versions as `test`.
type Resolved = {
  vitestConfig?: GuardSettings;

  test?: GuardSettings;
};

type GuardSettings = {
  sequence: { shuffle: boolean };
  retry: number;
  allowOnly: boolean;
  passWithNoTests: boolean;
  restoreMocks: boolean;
  unstubGlobals: boolean;
  unstubEnvs: boolean;
};

type VitestNode = {
  resolveConfig: (options: { watch: boolean }) => Promise<Resolved>;
};

let resolveConfig: VitestNode["resolveConfig"];

try {
  const entry = createRequire(join(process.cwd(), "package.json")).resolve(
    "vitest/node",
  );

  // SAFETY: vitest/node exports resolveConfig, whose resolved configuration
  // carries the seven guard settings as booleans and a retry count.
  ({ resolveConfig } = (await import(pathToFileURL(entry).href)) as VitestNode);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`Vitest does not resolve from ${process.cwd()}: ${message}`);
  console.error(
    "Run this from the package that owns the tests, after installing its dependencies.",
  );

  process.exit(2);
}

const resolved = await resolveConfig({ watch: false });

const config = resolved.vitestConfig ?? resolved.test;

if (config === undefined || config.sequence === undefined) {
  console.error(
    "This Vitest version returns its resolved configuration in a layout this script does not know. Read the settings in the Vitest configuration file instead.",
  );

  process.exit(2);
}

// Each guard setting as Vitest resolved it, keyed the way `wanted` is.
type FoundSettings = { [setting in keyof typeof wanted]: boolean | number };

const found: FoundSettings = {
  "sequence.shuffle": config.sequence.shuffle,
  retry: config.retry,
  allowOnly: config.allowOnly,
  passWithNoTests: config.passWithNoTests,
  restoreMocks: config.restoreMocks,
  unstubGlobals: config.unstubGlobals,
  unstubEnvs: config.unstubEnvs,
};

const settingKeys: readonly (keyof typeof wanted)[] = [
  "sequence.shuffle",
  "retry",
  "allowOnly",
  "passWithNoTests",
  "restoreMocks",
  "unstubGlobals",
  "unstubEnvs",
];

let failures = 0;

for (const setting of settingKeys) {
  const value = wanted[setting];

  const ok = found[setting] === value;

  if (!ok) failures += 1;

  const verdict = ok ? "ok  " : "FAIL";

  const detail = ok ? "" : `, wanted ${JSON.stringify(value)}`;

  console.log(
    `${verdict} ${setting}: ${JSON.stringify(found[setting])}${detail}`,
  );
}

console.log(
  failures === 0
    ? "Vitest resolves all seven guard settings."
    : `${failures} setting(s) differ from the bundled configuration.`,
);

process.exit(failures === 0 ? 0 : 1);
