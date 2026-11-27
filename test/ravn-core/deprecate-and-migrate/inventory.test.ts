import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";

const inventoryScript = join(
  import.meta.dirname,
  "../../../plugins/agent/ravn-core/skills/migrate/scripts/inventory.ts",
);

const tempRoot = realpathSync(mkdtempSync(join(tmpdir(), "inventory-")));

after(() => rmSync(tempRoot, { recursive: true, force: true }));

const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: join(tempRoot, ".no-global-gitconfig"),
  GIT_CONFIG_NOSYSTEM: "1",
};

// A repo where the deprecated `fetchUser` has a definition, three callers in
// three files (one untracked, one under a bracketed route directory), a
// look-alike `fetchUserById`, an ignored build copy, and a binary file.
const files = {
  "src/users.ts":
    "export function fetchUser(id) {\n  return db.get(id);\n}\nexport function fetchUserById(id) {\n  return fetchUser(id);\n}\n",
  "src/profile.ts":
    'import { fetchUser } from "./users";\nconst user = fetchUser(1);\n',
  "app/api/[id]/route.ts":
    'import { fetchUser } from "../../../src/users";\nexport const GET = () => fetchUser(2);\n',
  "src/admin.ts": "import { fetchUserById } from './users';\n",
  ".gitignore": "dist/\n",
  "dist/bundle.js": "fetchUser(3);\n",
};

function makeTree(name: string): string {
  const dir = join(tempRoot, name);

  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), contents);
  }

  writeFileSync(join(dir, "logo.bin"), Buffer.from([0, 1, 2, 0x66, 0x65]));

  return dir;
}

function git(cwd: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd,
    env: gitEnv,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
}

function makeRepo(): string {
  const dir = makeTree("repo");

  git(dir, ["init", "-q"]);
  git(dir, ["add", "src/users.ts", "src/profile.ts", "src/admin.ts"]);
  git(dir, ["add", ".gitignore", "logo.bin"]);
  git(dir, [
    "-c",
    "user.name=Ada",
    "-c",
    "user.email=ada@example.com",
    "commit",
    "-qm",
    "init",
  ]);

  return dir;
}

const repo = makeRepo();

const plain = makeTree("plain");

function inventory(cwd: string, args: string[]) {
  const result = spawnSync(process.execPath, [inventoryScript, ...args], {
    cwd,
    env: gitEnv,
    encoding: "utf8",
  });

  return {
    status: result.status,
    stderr: result.stderr,
    json: result.stdout === "" ? null : JSON.parse(result.stdout),
  };
}

function locations(json: { matches: { location: string }[] }): string[] {
  return json.matches.map(({ location }) => location).sort();
}

const callers = [
  "app/api/[id]/route.ts:1",
  "app/api/[id]/route.ts:2",
  "src/profile.ts:1",
  "src/profile.ts:2",
  "src/users.ts:1",
  "src/users.ts:5",
];

// The walk has no git to read .gitignore with, so it also finds the build copy.
for (const [method, dir, ignored] of [
  ["git-grep", repo, []],
  ["walk", plain, ["dist/bundle.js:1"]],
] as const) {
  test(`${method}: finds every whole-word caller, untracked ones included`, () => {
    const { status, json } = inventory(dir, ["fetchUser", "--word"]);

    assert.equal(status, 0);
    assert.equal(json.method, method);
    const expected = [...callers, ...ignored].sort();

    assert.deepEqual(locations(json), expected);
    assert.equal(json.count, expected.length);
    assert.equal(json.files, 3 + ignored.length);
  });

  test(`${method}: excluding the definition leaves only the callers`, () => {
    const { status, json } = inventory(dir, [
      "fetchUser",
      "--word",
      "--exclude",
      "./src/users.ts",
      "--exclude",
      "app/api/[id]/",
      "--exclude",
      "dist",
    ]);

    assert.equal(status, 0);
    assert.deepEqual(locations(json), ["src/profile.ts:1", "src/profile.ts:2"]);
  });

  test(`${method}: a regex matches the alternation`, () => {
    const { status, json } = inventory(dir, [
      "fetchUserById|db\\.get",
      "--regex",
    ]);

    assert.equal(status, 0);
    assert.deepEqual(locations(json), [
      "src/admin.ts:1",
      "src/users.ts:2",
      "src/users.ts:4",
    ]);
  });

  test(`${method}: no callers is a measured zero with exit 0`, () => {
    const { status, json } = inventory(dir, ["removedHelper"]);

    assert.equal(status, 0);
    assert.equal(json.count, 0);
    assert.ok(json.filesSearched > 0);
  });

  test(`${method}: searching no files exits 1`, () => {
    const { status, json } = inventory(dir, [
      "fetchUser",
      "--exclude",
      "src",
      "--exclude",
      "app",
      "--exclude",
      ".gitignore",
      "--exclude",
      "dist",
      "--exclude",
      "logo.bin",
    ]);

    assert.equal(status, 1);
    assert.equal(json.filesSearched, 0);
  });
}

test("git-grep: a root inside the repo searches only that subtree", () => {
  const { status, json } = inventory(repo, [
    "fetchUser",
    "--word",
    "--root",
    "src",
  ]);

  assert.equal(status, 0);
  assert.deepEqual(locations(json), [
    "profile.ts:1",
    "profile.ts:2",
    "users.ts:1",
    "users.ts:5",
  ]);
});

test("an empty directory exits 1", () => {
  const empty = join(tempRoot, "empty");

  mkdirSync(empty);

  assert.equal(inventory(empty, ["fetchUser"]).status, 1);
});

test("usage errors exit 2", () => {
  assert.equal(inventory(plain, []).status, 2);
  assert.equal(inventory(plain, ["a", "b"]).status, 2);
  assert.equal(inventory(plain, ["x", "--root", "missing"]).status, 2);
  assert.equal(inventory(plain, ["(", "--regex"]).status, 2);
  assert.equal(inventory(repo, ["(", "--regex"]).status, 2);
});
