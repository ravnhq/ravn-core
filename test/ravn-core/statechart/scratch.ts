import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";

// One folder per test file for everything its tests write, removed when the
// file's tests end.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "statechart-test-"));

after(() => fs.rmSync(root, { recursive: true, force: true }));

export const scratch = (prefix: string) =>
  fs.mkdtempSync(path.join(root, prefix));
