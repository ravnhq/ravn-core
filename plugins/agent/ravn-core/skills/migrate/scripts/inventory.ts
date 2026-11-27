import { spawnSync } from "node:child_process";
import {
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  closeSync,
  statSync,
} from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";

// Lists every line in a repo that names an old symbol, endpoint, column, or
// key, so a migration knows its callers before it removes anything. Exit 0
// means files were searched (the count may be 0); exit 1 means no file was
// searched, so the empty result measures nothing; exit 2 is a usage or
// search error.

type Match = { location: string; text: string };

type Inventory = {
  pattern: string;
  regex: boolean;
  word: boolean;
  root: string;
  excluded: string[];
  method: "git-grep" | "walk";
  filesSearched: number;
  count: number;
  files: number;
  matches: Match[];
};

const maxText = 200;

const skippedDirs = new Set([".git", "node_modules"]);

const usage =
  "Usage: node inventory.ts <pattern> [--word] [--regex] [--exclude <path>]... [--root <dir>]";

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

function normalizeExclude(path: string): string {
  return toPosix(path)
    .replace(/^(\.\/)+/, "")
    .replace(/\/+$/, "");
}

function clip(text: string): string {
  const line = text.replace(/\r$/, "").trim();

  return line.length > maxText ? line.slice(0, maxText) + "..." : line;
}

function git(root: string, args: string[]) {
  const options = { cwd: root, encoding: "utf8", maxBuffer: 1 << 30 } as const;

  return spawnSync("git", ["-c", "core.quotePath=false", ...args], options);
}

function isGitWorkTree(root: string): boolean {
  const result = git(root, ["rev-parse", "--is-inside-work-tree"]);

  return result.status === 0 && result.stdout.trim() === "true";
}

function pathspecs(excluded: string[]): string[] {
  return [".", ...excluded.map((path) => ":(exclude,literal)" + path)];
}

const listFlags = ["-z", "--cached", "--others", "--exclude-standard"];

const grepFlags = ["--untracked", "--no-color", "-I", "-n", "-z"];

function gitInventory(
  root: string,
  pattern: string,
  regex: boolean,
  word: boolean,
  excluded: string[],
) {
  const scope = ["--", ...pathspecs(excluded)];

  const listed = git(root, ["ls-files", ...listFlags, ...scope]);

  if (listed.status !== 0) fail("git ls-files failed: " + listed.stderr);

  const files = new Set(
    listed.stdout
      .split("\0")
      .filter((file) => file !== "" && existsSync(join(root, file))),
  );

  const mode = [regex ? "-E" : "-F", ...(word ? ["-w"] : [])];

  const grep = git(root, [
    "grep",
    ...grepFlags,
    ...mode,
    "-e",
    pattern,
    ...scope,
  ]);

  // git grep exits 1 when nothing matches; anything above is an error.
  if (grep.status === null || grep.status > 1) {
    fail("git grep failed: " + (grep.error?.message ?? grep.stderr));
  }

  const matches = grep.stdout
    .split("\n")
    .filter((record) => record !== "")
    .map((record) => {
      const [file = "", line = "", ...text] = record.split("\0");

      return { location: file + ":" + line, text: clip(text.join("\0")) };
    });

  return { filesSearched: files.size, matches };
}

function isBinary(path: string): boolean {
  const buffer = Buffer.alloc(8000);

  const fd = openSync(path, "r");

  try {
    const read = readSync(fd, buffer, 0, buffer.length, 0);

    return buffer.subarray(0, read).includes(0);
  } finally {
    closeSync(fd);
  }
}

function walk(root: string, dir: string, excluded: string[], out: string[]) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);

    const rel = toPosix(relative(root, path));

    if (excluded.some((ex) => rel === ex || rel.startsWith(ex + "/"))) {
      continue;
    }

    if (entry.isDirectory()) {
      if (!skippedDirs.has(entry.name)) walk(root, path, excluded, out);
    } else if (entry.isFile() && !isBinary(path)) {
      out.push(rel);
    }
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function walkInventory(
  root: string,
  pattern: string,
  regex: boolean,
  word: boolean,
  excluded: string[],
) {
  const source = regex ? pattern : escapeRegExp(pattern);

  let matcher: RegExp;

  try {
    matcher = new RegExp(
      word ? "(?<![A-Za-z0-9_])(?:" + source + ")(?![A-Za-z0-9_])" : source,
    );
  } catch (error) {
    fail("invalid pattern: " + String(error));
  }

  const files: string[] = [];

  walk(root, root, excluded, files);

  files.sort();

  const matches = files.flatMap((file) =>
    readFileSync(join(root, file), "utf8")
      .split("\n")
      .flatMap((text, index) =>
        matcher.test(text)
          ? [{ location: file + ":" + (index + 1), text: clip(text) }]
          : [],
      ),
  );

  return { filesSearched: files.length, matches };
}

const { positionals, values } = (() => {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        regex: { type: "boolean", default: false },
        word: { type: "boolean", default: false },
        exclude: { type: "string", multiple: true, default: [] },
        root: { type: "string", default: "." },
      },
    });
  } catch (error) {
    fail(String(error) + "\n" + usage);
  }
})();

const [pattern, ...extra] = positionals;

if (pattern === undefined || pattern === "" || extra.length > 0) fail(usage);

const root = resolve(values.root);

if (!existsSync(root) || !statSync(root).isDirectory()) {
  fail("root is not a directory: " + root);
}

const excluded = values.exclude.map(normalizeExclude).filter((p) => p !== "");

const method = isGitWorkTree(root) ? "git-grep" : "walk";

const { filesSearched, matches } = (
  method === "git-grep" ? gitInventory : walkInventory
)(root, pattern, values.regex, values.word, excluded);

const inventory: Inventory = {
  pattern,
  regex: values.regex,
  word: values.word,
  root,
  excluded,
  method,
  filesSearched,
  count: matches.length,
  files: new Set(matches.map(({ location }) => location.replace(/:\d+$/, "")))
    .size,
  matches,
};

console.log(JSON.stringify(inventory, null, 2));

if (filesSearched === 0) {
  console.error(
    "No files searched under " +
      root +
      ": this inventory measured nothing. Check --root and --exclude.",
  );
  process.exit(1);
}
