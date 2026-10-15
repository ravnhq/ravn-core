import assert from "node:assert/strict";
import {
  cpSync,
  mkdtempSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { verifyValeStyles } from "../scripts/check-prose.ts";

const repoDir = join(import.meta.dirname, "..");

const passive = ".vale/styles/write-good/Passive.yml";

let copyDir: string;

beforeEach(() => {
  copyDir = mkdtempSync(join(tmpdir(), "check-prose-"));
  cpSync(join(repoDir, ".vale"), join(copyDir, ".vale"), { recursive: true });
});

afterEach(() => {
  rmSync(copyDir, { recursive: true, force: true });
});

test("accepts the committed style set", () => {
  assert.deepEqual(verifyValeStyles(copyDir), {
    fileCount: 15,
    packageLabel: "write-good 0.4.1",
  });
});

test("rejects a missing vendored style", () => {
  unlinkSync(join(copyDir, passive));

  assert.throws(
    () => verifyValeStyles(copyDir),
    /missing: write-good\/Passive/,
  );
});

test("rejects a drifted vendored style", () => {
  writeFileSync(join(copyDir, passive), "extends: existence\n");

  assert.throws(
    () => verifyValeStyles(copyDir),
    /drifted: write-good\/Passive/,
  );
});

test("rejects style files outside the lock", () => {
  writeFileSync(
    join(copyDir, ".vale/styles/write-good/Unpinned.yml"),
    "extends: existence\n",
  );

  assert.throws(
    () => verifyValeStyles(copyDir),
    /unexpected: write-good\/Unpinned/,
  );
});
