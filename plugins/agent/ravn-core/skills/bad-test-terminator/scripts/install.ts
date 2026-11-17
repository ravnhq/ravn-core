#!/usr/bin/env node
// Copies the bundled bad-test-terminator plugin into the current package and
// starts its provenance record.
//
//   node <skill-directory>/scripts/install.ts [destination]
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const skillRoot = resolve(import.meta.dirname, "..");

const source = resolve(skillRoot, "assets/bad-test-terminator");

const destination = process.argv[2] ?? "tools/oxlint/bad-test-terminator";

const target = resolve(process.cwd(), destination);

if (existsSync(target)) {
  console.error(
    `Refusing to overwrite ${target}. An existing copy is updated by merging, as references/update.md describes.`,
  );

  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });

cpSync(source, target, { recursive: true });

const files = readdirSync(target, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) =>
    relative(target, join(entry.parentPath, entry.name)).split("\\").join("/"),
  )
  .sort();

const hashes = files.map(
  (file) =>
    [
      file,
      createHash("sha256")
        .update(readFileSync(join(target, file)))
        .digest("hex"),
    ] as const,
);

const bundle = createHash("sha256")
  .update(hashes.map(([file, hash]) => `${file} ${hash}\n`).join(""))
  .digest("hex")
  .slice(0, 12);

writeFileSync(
  join(target, "UPSTREAM.md"),
  `# bad-test-terminator provenance

- Source: \`bad-test-terminator\` skill, bundle \`${bundle}\`
- Installed: ${new Date().toISOString().slice(0, 10)}
- Installed at: \`${destination}/\`
- Lint block:
- Test file patterns:
- Vitest settings:
- Repeat run:
- Baseline:
- Deviations:

## Files as installed

A file whose \`shasum -a 256\` still equals its entry here is unchanged since the install.

| File | SHA-256 |
| --- | --- |
${hashes.map(([file, hash]) => `| \`${file}\` | \`${hash}\` |`).join("\n")}
`,
);

console.log(
  `Copied the bad-test-terminator plugin (bundle ${bundle}) to ${target}`,
);

console.log(`Generic plugin: ${destination}/index.ts`);

console.log(`Effect plugin:  ${destination}/effect/index.ts`);

console.log(
  `Provenance:     ${destination}/UPSTREAM.md, with six fields for step 10 to fill`,
);
