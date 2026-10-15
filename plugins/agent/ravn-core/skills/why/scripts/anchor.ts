import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

type Commit = {
  hash: string;
  author: string;
  date: string;
  subject: string;
  body: string;
};

type Anchor = {
  file: string;
  lines: string | null;
  blameCommits: string[];
  commits: Commit[];
  prNumbers: number[];
  ticketIds: string[];
  pullRequests: object[];
  gaps: string[];
};

const fieldSeparator = "\u001f";

const recordSeparator = "\u001e";

const commitLimit = "20";

const prPattern = /\(#(\d+)\)/g;

const ticketPattern = /\b[A-Z][A-Z0-9]+-\d+\b/g;

const prFields =
  "number,title,body,author,createdAt,mergedAt,labels,closingIssuesReferences,comments,reviews";

function run(command: string, args: string[]) {
  return spawnSync(command, args, { encoding: "utf8" });
}

function blameCommits(file: string, lines: string): string[] {
  const result = run("git", ["blame", "--porcelain", "-L", lines, "--", file]);

  if (result.status !== 0) {
    throw new Error(`git blame failed: ${result.stderr.trim()}`);
  }

  const hashes = result.stdout
    .split("\n")
    .flatMap((line) => line.match(/^[0-9a-f]{40}(?= )/) ?? []);

  return [...new Set(hashes)];
}

function fileHistory(file: string): Commit[] {
  const format = ["%H", "%an", "%aI", "%s", "%b"].join(fieldSeparator);

  const result = run("git", [
    "log",
    "--follow",
    `-${commitLimit}`,
    `--format=${format}${recordSeparator}`,
    "--",
    file,
  ]);

  if (result.status !== 0) {
    throw new Error(`git log failed: ${result.stderr.trim()}`);
  }

  return result.stdout
    .split(recordSeparator)
    .filter((record) => record.trim() !== "")
    .map((record) => {
      const [hash = "", author = "", date = "", subject = "", body = ""] =
        record.trim().split(fieldSeparator);

      return { hash, author, date, subject, body: body.trim() };
    });
}

function pullRequest(prNumber: number, gaps: string[]): object[] {
  const result = run("gh", [
    "pr",
    "view",
    String(prNumber),
    "--json",
    prFields,
  ]);

  if (result.error !== undefined || result.status !== 0) {
    const reason = result.error?.message ?? result.stderr.trim();

    gaps.push(`gh pr view ${prNumber} failed: ${reason}`);

    return [];
  }

  return [JSON.parse(result.stdout)];
}

function anchor(file: string, lines: string | null): Anchor {
  const gaps: string[] = [];

  const commits = fileHistory(file);

  if (commits.length === 0) {
    gaps.push(`No commits touch ${file}; it may be untracked or new.`);
  }

  const messages = commits.flatMap((commit) => [commit.subject, commit.body]);

  const prNumbers = [
    ...new Set(
      messages.flatMap((message) =>
        [...message.matchAll(prPattern)].map((match) => Number(match[1])),
      ),
    ),
  ];

  const ticketIds = [
    ...new Set(
      messages.flatMap((message) => message.match(ticketPattern) ?? []),
    ),
  ];

  return {
    file,
    lines,
    blameCommits: lines === null ? [] : blameCommits(file, lines),
    commits,
    prNumbers,
    ticketIds,
    pullRequests: prNumbers.flatMap((prNumber) => pullRequest(prNumber, gaps)),
    gaps,
  };
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { lines: { type: "string" } },
});

const [file] = positionals;

if (file === undefined) {
  console.error("Usage: node anchor.ts <file> [--lines <start>,<end>]");
  process.exit(2);
}

console.log(JSON.stringify(anchor(file, values.lines ?? null), null, 2));
