import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { z } from "zod";

const repoDir = join(import.meta.dirname, "..");

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/u);

const styleLockSchema = z.object({
  package: z.object({
    name: z.string(),
    version: z.string(),
    source: z.string(),
    archiveSha256: hashSchema,
  }),
  files: z.record(z.string(), hashSchema),
});

const styleFiles = (dir: string, base = dir): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return styleFiles(path, base);
    }

    return entry.isFile() ? [relative(base, path).split(sep).join("/")] : [];
  });

const hash = (content: Buffer) =>
  createHash("sha256").update(content).digest("hex");

// Fails when the committed styles differ from .vale/styles.lock.json, so a
// stray `vale sync` or a hand edit cannot silently change the house style.
export const verifyValeStyles = (root: string) => {
  const stylesDir = join(root, ".vale/styles");

  const lock = styleLockSchema.parse(
    JSON.parse(readFileSync(join(root, ".vale/styles.lock.json"), "utf8")),
  );

  const expected = Object.keys(lock.files).sort();
  const actual = styleFiles(stylesDir).sort();

  const problems = [
    ...expected
      .filter((path) => !actual.includes(path))
      .map((path) => `missing: ${path}`),
    ...actual
      .filter((path) => !expected.includes(path))
      .map((path) => `unexpected: ${path}`),
    ...expected
      .filter((path) => actual.includes(path))
      .filter(
        (path) =>
          hash(readFileSync(join(stylesDir, path))) !== lock.files[path],
      )
      .map((path) => `drifted: ${path}`),
  ];

  if (problems.length > 0) {
    throw new Error(
      `Vale styles do not match .vale/styles.lock.json\n${problems.join("\n")}`,
    );
  }

  return {
    fileCount: expected.length,
    packageLabel: `${lock.package.name} ${lock.package.version}`,
  };
};

if (import.meta.main) {
  try {
    const { fileCount, packageLabel } = verifyValeStyles(repoDir);

    console.log(
      `Verified ${fileCount} Vale style files, including ${packageLabel}.`,
    );

    // .vale.ini decides which of these files take the house style. Vale exits
    // nonzero only on errors, so any printed alert, warnings included, fails.
    const result = spawnSync(
      "vale",
      ["--output=line", "README.md", "plugins"],
      { cwd: repoDir, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
    );

    if (result.error) {
      throw new Error(`Could not run Vale: ${result.error.message}`);
    }

    const alerts = result.stdout.trim();

    console[alerts ? "error" : "log"](alerts || "Vale found no alerts.");

    process.exitCode = alerts || result.status !== 0 ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
