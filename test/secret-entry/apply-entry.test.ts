import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  applyEntry,
  type ApplyEntry,
  type EntryIo,
} from "../../plugins/mods/secret-entry/lib/apply-entry.ts";

const SECRET = "s3cret-value";

function entry(file: string): ApplyEntry {
  return {
    file,
    template: null,
    edit: null,
    keys: ["TOKEN"],
    values: { TOKEN: SECRET },
  };
}

function realIo(modesAtWrite: number[]): EntryIo {
  return {
    read: async (path) => readFileSync(path, "utf8"),
    write: async (path, text) => {
      modesAtWrite.push(statSync(path).mode & 0o777);
      // Same shape as $.fs.write: no mode argument, so an existing mode sticks.
      writeFileSync(path, text);
    },
    exists: async (path) => {
      try {
        statSync(path);

        return true;
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return false;
        }

        throw error;
      }
    },
    run: async (argv) => {
      const result = spawnSync(argv[0] ?? "", argv.slice(1), {
        encoding: "utf8",
        timeout: 3000,
      });

      if (result.error) throw result.error;

      return {
        exitCode: result.status ?? 1,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    },
  };
}

test("a new secret file is mode 0600 before any secret byte is written", async () => {
  const dir = mkdtempSync(join(tmpdir(), "secret-entry-"));
  const file = join(dir, "nested", "secret.env");
  const modesAtWrite: number[] = [];

  try {
    const applied = await applyEntry(realIo(modesAtWrite), entry(file));

    assert.deepEqual(applied, { ok: true });
    assert.deepEqual(modesAtWrite, [0o600]);
    assert.equal(statSync(file).mode & 0o777, 0o600);
    assert.equal(readFileSync(file, "utf8"), `TOKEN=${SECRET}\n`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function failingIo(run: EntryIo["run"], writes: string[]): EntryIo {
  return {
    read: async () => {
      throw new Error("missing");
    },
    write: async (_path, text) => {
      writes.push(text);
    },
    exists: async () => false,
    run,
  };
}

const ran = {
  exitCode: 0,
  stdout: "",
  stderr: "",
};

test("applyEntry fails when creating the file exits non-zero", async () => {
  const writes: string[] = [];

  const applied = await applyEntry(
    failingIo(
      async () => ({ exitCode: 1, stdout: "", stderr: "denied" }),
      writes,
    ),
    entry("/tmp/secret.env"),
  );

  assert.equal(applied.ok, false);
  assert.equal(writes.length, 0);

  if (!applied.ok) assert.match(applied.error, /0600/);
});

test("applyEntry fails when the permission command cannot start", async () => {
  const writes: string[] = [];

  const applied = await applyEntry(
    failingIo(async () => {
      throw new Error("spawn timed out");
    }, writes),
    entry("/tmp/secret.env"),
  );

  assert.equal(applied.ok, false);
  assert.equal(writes.length, 0);

  if (!applied.ok) assert.match(applied.error, /0600/);
});

test("applyEntry fails when stat reports a mode other than 0600", async () => {
  const writes: string[] = [];
  const chmod: string[][] = [];

  const applied = await applyEntry(
    failingIo(async (argv) => {
      if (argv[0] === "chmod") {
        chmod.push([...argv]);

        return ran;
      }

      if (argv[0] === "stat") {
        return { exitCode: 0, stdout: "644\n", stderr: "" };
      }

      return ran;
    }, writes),
    entry("/tmp/secret.env"),
  );

  assert.equal(applied.ok, false);
  assert.equal(writes.length, 0);
  assert.deepEqual(chmod, [["chmod", "600", "--", "/tmp/secret.env"]]);

  if (!applied.ok) assert.match(applied.error, /0600/);
});
