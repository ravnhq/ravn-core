import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";

const script = join(
  import.meta.dirname,
  "../../../plugins/agent/ravn-core/skills/review-and-simplify/scripts/review.ts",
);

const root = realpathSync(mkdtempSync(join(tmpdir(), "review-and-simplify-")));

const repo = join(root, "repo");

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "Ada",
  GIT_AUTHOR_EMAIL: "ada@example.com",
  GIT_COMMITTER_NAME: "Ada",
  GIT_COMMITTER_EMAIL: "ada@example.com",
  GIT_CONFIG_GLOBAL: join(root, ".no-global-gitconfig"),
  GIT_CONFIG_NOSYSTEM: "1",
};

function git(args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: repo,
    env: gitEnv,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);

  return result.stdout;
}

function write(path: string, contents: string): void {
  mkdirSync(dirname(join(repo, path)), { recursive: true });

  writeFileSync(join(repo, path), contents);
}

function lines(count: number, label: string): string {
  return Array.from({ length: count }, (_, index) => `${label} ${index + 1}`)
    .join("\n")
    .concat("\n");
}

let base = "";

// Writes the working tree's diff against the base commit to a file, the way
// the skill tells the coordinator to.
function diffFile(name: string): string {
  const path = join(root, `${name}.diff`);

  git(["add", "-A"]);

  writeFileSync(path, git(["diff", "--no-color", "--no-ext-diff", "-M", base]));

  return path;
}

function reset(): void {
  git(["reset", "-q", "--hard", base]);

  git(["clean", "-qfd"]);
}

// The fields of the script's JSON output that these tests read.
type Output = {
  ok?: boolean;
  code?: string;
  hint?: string;
  tier?: string;
  specialists?: { name: string; model: string }[];
  excluded?: { path: string; reason: string }[];
  rejected?: { index: number; code: string }[];
  verdict?: string;
  reviewFile?: string;
  reportFile?: string;
  report?: string;
};

type Run = { status: number | null; json: Output };

function run(args: string[]): Run {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repo,
    encoding: "utf8",
  });

  return {
    status: result.status,
    json: result.stdout.trim() === "" ? {} : JSON.parse(result.stdout),
  };
}

type Review = {
  event: string;
  commit_id?: string;
  comments: { path: string; line: number; start_line?: number; body: string }[];
};

function readReview(result: Run): Review {
  return JSON.parse(readFileSync(String(result.json.reviewFile), "utf8"));
}

function findingsFile(name: string, findings: object[]): string {
  const dir = join(root, name);

  mkdirSync(dir, { recursive: true });

  const path = join(dir, "judged.json");

  writeFileSync(path, JSON.stringify({ findings }));

  return path;
}

before(() => {
  mkdirSync(repo);

  git(["init", "-q", "-b", "main"]);

  write("src/math.ts", lines(40, "line"));

  write("src/old.ts", lines(5, "old"));

  write("docs/guide.md", lines(10, "doc"));

  git(["add", "."]);

  git(["commit", "-q", "-m", "base"]);

  base = git(["rev-parse", "HEAD"]).trim();
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

test("a small change is trivial and runs code_quality only", () => {
  reset();

  write("src/math.ts", lines(40, "line").replace("line 3\n", "changed 3\n"));

  const result = run(["tier", diffFile("trivial")]);

  assert.equal(result.status, 0);

  assert.equal(result.json.tier, "trivial");

  assert.deepEqual(result.json.specialists, [
    { name: "code_quality", model: "session" },
  ]);
});

test("a medium change is lite and adds documentation, agents_md, and simplify", () => {
  reset();

  write("src/math.ts", lines(40, "line").concat(lines(30, "added")));

  const result = run(["tier", diffFile("lite")]);

  assert.equal(result.json.tier, "lite");

  assert.deepEqual(result.json.specialists, [
    { name: "code_quality", model: "session" },
    { name: "documentation", model: "step-down" },
    { name: "agents_md", model: "step-down" },
    { name: "simplify", model: "session" },
  ]);
});

test("a one-line change on a sensitive path is full and runs all eight", () => {
  reset();

  write("src/OAuthToken.ts", "export const ttl = 60;\n");

  const result = run(["tier", diffFile("sensitive")]);

  assert.equal(result.json.tier, "full");

  const names = (result.json.specialists ?? []).map(
    (specialist) => `${specialist.name}:${specialist.model}`,
  );

  assert.deepEqual(names, [
    "security:session",
    "performance:step-down",
    "code_quality:session",
    "documentation:step-down",
    "release:step-down",
    "engineering_standards:step-down",
    "agents_md:step-down",
    "simplify:session",
  ]);
});

test("lockfiles are excluded and do not raise the tier", () => {
  reset();

  write("pnpm-lock.yaml", lines(500, "lock"));

  write("src/math.ts", lines(40, "line").replace("line 1\n", "changed 1\n"));

  git(["add", "pnpm-lock.yaml"]);

  const result = run(["tier", diffFile("lockfile")]);

  assert.equal(result.json.tier, "trivial");

  assert.deepEqual(result.json.excluded, [
    { path: "pnpm-lock.yaml", reason: "lockfile" },
  ]);
});

test("--tier overrides the classification and rejects unknown tiers", () => {
  reset();

  write("src/math.ts", lines(40, "line").replace("line 3\n", "changed 3\n"));

  const diff = diffFile("forced");

  assert.equal(run(["tier", diff, "--tier", "full"]).json.tier, "full");

  const bad = run(["tier", diff, "--tier", "huge"]);

  assert.equal(bad.status, 1);

  assert.equal(bad.json.ok, false);

  assert.equal(bad.json.code, "bad_tier");
});

test("an empty diff fails with a correctable error", () => {
  reset();

  const result = run(["tier", diffFile("empty")]);

  assert.equal(result.status, 1);

  assert.equal(result.json.code, "empty_diff");

  assert.notEqual(result.json.hint, undefined);
});

test("a diff with mnemonic prefixes fails with a correctable error", () => {
  reset();

  write("src/math.ts", lines(40, "line").replace("line 3\n", "changed 3\n"));

  const path = join(root, "mnemonic.diff");

  writeFileSync(
    path,
    git(["-c", "diff.mnemonicPrefix=true", "diff", "--no-color", base]),
  );

  const result = run(["tier", path]);

  assert.equal(result.status, 1);

  assert.equal(result.json.code, "diff_prefix");
});

test("a missing diff file fails with a correctable error", () => {
  const result = run(["tier", join(root, "missing.diff")]);

  assert.equal(result.status, 1);

  assert.equal(result.json.code, "diff_unreadable");
});

test("check validates anchors, renders the report, and builds a COMMENT review", () => {
  reset();

  write(
    "src/math.ts",
    lines(40, "line").replace("line 10\nline 11\n", "bug 10\nbug 11\n"),
  );

  const diff = diffFile("check");

  const findings = findingsFile("check", [
    {
      specialist: "code_quality",
      path: "src/math.ts",
      start_line: 10,
      end_line: 11,
      severity: "critical",
      title: "Off by one",
      body: "Fails for an empty list.",
      replacement: "fixed 10\nfixed 11",
    },
  ]);

  const result = run(["check", diff, findings, "--commit", base]);

  assert.equal(result.status, 0);

  assert.equal(result.json.verdict, "request_changes");

  const review = readReview(result);

  assert.equal(review.event, "COMMENT");

  assert.equal(review.commit_id, base);

  assert.equal(review.comments.length, 1);

  assert.equal(review.comments[0].path, "src/math.ts");

  assert.equal(review.comments[0].start_line, 10);

  assert.equal(review.comments[0].line, 11);

  assert.match(
    review.comments[0].body,
    /```suggestion\nfixed 10\nfixed 11\n```/,
  );

  assert.ok(existsSync(String(result.json.reportFile)));
});

test("check rejects anchors outside the diff and names each one", () => {
  reset();

  write("src/math.ts", lines(40, "line").replace("line 10\n", "bug 10\n"));

  write("src/new.ts", "export const value = 1;\n");

  git(["rm", "-q", "src/old.ts"]);

  git(["add", "src/new.ts"]);

  const diff = diffFile("reject");

  const anchored = {
    specialist: "code_quality",
    severity: "warning",
    title: "t",
    body: "b",
  };

  const findings = findingsFile("reject", [
    { ...anchored, path: "src/math.ts", start_line: 30, end_line: 30 },
    { ...anchored, path: "src/elsewhere.ts", start_line: 1, end_line: 1 },
    { ...anchored, path: "src/old.ts", start_line: 1, end_line: 1 },
    { ...anchored, path: "src/new.ts", start_line: 1, end_line: 1 },
    { ...anchored, path: "src/math.ts", start_line: 10, severity: "high" },
  ]);

  const result = run(["check", diff, findings]);

  assert.equal(result.status, 1);

  assert.equal(result.json.code, "invalid_findings");

  const codes = (result.json.rejected ?? []).map(
    (rejection) => `${rejection.index}:${rejection.code}`,
  );

  assert.deepEqual(codes, [
    "0:line_not_in_hunk",
    "1:path_not_reviewed",
    "2:line_not_in_hunk",
    "4:bad_severity",
  ]);
});

test("check accepts a fenced reply and rejects one that is not JSON", () => {
  reset();

  write("src/math.ts", lines(40, "line").replace("line 10\n", "bug 10\n"));

  const diff = diffFile("fenced");

  const dir = join(root, "fenced");

  mkdirSync(dir, { recursive: true });

  const fenced = join(dir, "fenced.md");

  writeFileSync(
    fenced,
    'Here you go:\n```json\n{"findings": [{"specialist": "security", "path": "src/math.ts", "start_line": 10, "severity": "warning", "title": "t", "body": "b"}]}\n```\n',
  );

  const accepted = run(["check", diff, fenced]);

  assert.equal(accepted.status, 0);

  assert.equal(accepted.json.verdict, "comment");

  const garbage = join(dir, "garbage.json");

  writeFileSync(garbage, "no findings here");

  const rejected = run(["check", diff, garbage]);

  assert.equal(rejected.status, 1);

  assert.equal(rejected.json.code, "bad_findings_json");
});

test("check drops exact duplicates and keeps the higher severity", () => {
  reset();

  write(
    "src/math.ts",
    lines(40, "line").replace("line 10\nline 11\n", "bug 10\nbug 11\n"),
  );

  const diff = diffFile("dedupe");

  const findings = findingsFile("dedupe", [
    {
      specialist: "code_quality",
      path: "src/math.ts",
      start_line: 10,
      end_line: 11,
      severity: "suggestion",
      title: "Leaks the handle",
      body: "b",
    },
    {
      specialist: "performance",
      path: "src/math.ts",
      start_line: 11,
      end_line: 11,
      severity: "warning",
      title: "leaks the handle!",
      body: "b",
    },
  ]);

  const result = run(["check", diff, findings]);

  assert.equal(result.status, 0);

  assert.equal(result.json.verdict, "comment");

  const review = readReview(result);

  assert.equal(review.comments.length, 1);

  assert.match(review.comments[0].body, /^\*\*Warning:/);

  assert.match(review.comments[0].body, /code_quality, performance/);
});

test("applied simplifications neither block the verdict nor post as comments", () => {
  reset();

  write("src/math.ts", lines(40, "line").replace("line 10\n", "bug 10\n"));

  const diff = diffFile("applied");

  const findings = findingsFile("applied", [
    {
      specialist: "simplify",
      path: "src/math.ts",
      start_line: 10,
      severity: "warning",
      title: "Reuse the helper",
      body: "b",
      status: "applied",
    },
  ]);

  const result = run(["check", diff, findings]);

  assert.equal(result.json.verdict, "approve");

  const review = readReview(result);

  assert.equal(review.comments.length, 0);

  assert.match(String(result.json.report), /Applied simplifications \(1\)/);
});

test("a renamed file is anchored at its new path", () => {
  reset();

  git(["mv", "docs/guide.md", "docs/handbook.md"]);

  write("docs/handbook.md", lines(10, "doc").replace("doc 2\n", "edited 2\n"));

  const diff = diffFile("rename");

  const findings = findingsFile("rename", [
    {
      specialist: "documentation",
      path: "docs/handbook.md",
      start_line: 2,
      severity: "suggestion",
      title: "t",
      body: "b",
    },
  ]);

  assert.equal(run(["check", diff, findings]).status, 0);
});

test("a malformed command line exits 64", () => {
  assert.equal(run(["tier"]).status, 64);

  assert.equal(run(["unknown", "x"]).status, 64);
});
