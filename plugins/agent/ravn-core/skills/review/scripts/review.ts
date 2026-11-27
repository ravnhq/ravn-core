// review-and-simplify helper. Two commands, both reading a unified diff file:
//
//   tier  <diff-file> [--tier trivial|lite|full]
//   check <diff-file> <findings-file> [--commit <sha>] [--max-findings <n>|all]
//
// Every result is one JSON object on stdout. A failure prints
// {"ok": false, "code", "message", "hint"} and exits 1 so the coordinator can
// correct its input and run the command again; a usage error exits 64.

import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { parseArgs } from "node:util";
import {
  classify,
  type FileChange,
  hasDefaultPrefixes,
  member,
  parseDiff,
  specialistsFor,
  tiers,
} from "./diff.ts";
import {
  cap,
  decodeAll,
  dedupe,
  githubReview,
  parseReply,
  ReplyError,
  type Rejection,
  renderReport,
  verdictFor,
} from "./findings.ts";

class Failure extends Error {
  code: string;
  hint: string;
  rejected: Rejection[];

  constructor(code: string, message: string, hint: string) {
    super(message);
    this.code = code;
    this.hint = hint;
    this.rejected = [];
  }
}

const usage =
  "usage: review.ts tier <diff-file> [--tier trivial|lite|full]\n" +
  "       review.ts check <diff-file> <findings-file> [--commit <sha>] [--max-findings <n>|all]";

const lockfiles = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "Cargo.lock",
  "go.sum",
  "poetry.lock",
  "uv.lock",
  "Gemfile.lock",
  "composer.lock",
  "Pipfile.lock",
  "flake.lock",
]);

function exclusion(change: FileChange): string | null {
  const name = basename(change.path);

  if (change.binary) {
    return "binary";
  }

  if (lockfiles.has(name)) {
    return "lockfile";
  }

  if (/\.min\.(js|css)$|\.map$/.test(name)) {
    return "generated";
  }

  return null;
}

function readText(path: string, code: string, hint: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (cause) {
    throw new Failure(code, "cannot read " + path + ": " + String(cause), hint);
  }
}

function readDiff(path: string): FileChange[] {
  const text = readText(
    path,
    "diff_unreadable",
    "Write the diff of the change to a file with git diff against the merge base, and pass that path.",
  );

  if (!hasDefaultPrefixes(text)) {
    throw new Failure(
      "diff_prefix",
      path + " uses file prefixes other than a/ and b/",
      "Write the diff again with --src-prefix=a/ --dst-prefix=b/, which override a diff.mnemonicPrefix or diff.noprefix setting.",
    );
  }

  const changes = parseDiff(text);

  if (changes.length === 0) {
    throw new Failure(
      "empty_diff",
      path + " holds no file changes",
      "Check the base: an empty diff means the branch matches its merge base. Append untracked files with git diff --no-index.",
    );
  }

  return changes;
}

type Excluded = { path: string; reason: string };

function tierCommand(diffFile: string, forced: string | undefined) {
  const reviewed: FileChange[] = [];
  const excluded: Excluded[] = [];

  for (const change of readDiff(diffFile)) {
    const reason = exclusion(change);

    if (reason === null) {
      reviewed.push(change);
    } else {
      excluded.push({ path: change.path, reason });
    }
  }

  const override = member(tiers, forced);

  if (forced !== undefined && override === null) {
    throw new Failure(
      "bad_tier",
      "unknown tier " + forced,
      "Pass one of " + tiers.join(", ") + ", or omit --tier.",
    );
  }

  const classified = classify(reviewed);
  const tier = override ?? classified.tier;

  return {
    ok: true,
    tier,
    reason:
      override === null
        ? classified.reason
        : "forced by --tier (" + classified.reason + ")",
    specialists: specialistsFor(tier),
    files: reviewed.map((change) => ({
      path: change.path,
      status: change.status,
      added: change.added,
      removed: change.removed,
    })),
    excluded,
  };
}

const defaultMaxFindings = 20;

// The --max-findings value: a positive integer, or `all` for no cap.
function maxFindings(value: string | undefined): number | null {
  if (value === undefined) {
    return defaultMaxFindings;
  }

  if (value === "all") {
    return null;
  }

  const max = Number(value);

  if (!Number.isInteger(max) || max < 1) {
    throw new Failure(
      "bad_max_findings",
      "--max-findings " + value + " is not a positive integer or all",
      "Pass a positive integer, all, or omit --max-findings for the default of " +
        String(defaultMaxFindings) +
        ".",
    );
  }

  return max;
}

function checkCommand(
  diffFile: string,
  findingsFile: string,
  commit: string | undefined,
  max: number | null,
) {
  const files = new Map(
    readDiff(diffFile)
      .filter((change) => !change.binary)
      .map((change) => [change.path, change]),
  );

  const reply = readText(
    findingsFile,
    "findings_unreadable",
    'Write the judged findings as {"findings": [...]} to a file and pass its path.',
  );

  const decoded = decodeAll(parseReply(reply), files);

  if (decoded.rejected.length > 0) {
    const failure = new Failure(
      "invalid_findings",
      String(decoded.rejected.length) + " finding(s) failed validation",
      "Fix each rejected finding: move its anchor onto changed lines of that file's hunks, or drop it. Then run check again.",
    );

    failure.rejected = decoded.rejected;

    throw failure;
  }

  const capped = cap(dedupe(decoded.findings), max);
  const findings = capped.findings;
  const report = renderReport(capped);
  const reportFile = join(dirname(findingsFile), "report.md");
  const reviewFile = join(dirname(findingsFile), "github-review.json");

  writeFileSync(reportFile, report);

  writeFileSync(
    reviewFile,
    JSON.stringify(githubReview(findings, commit), null, 2) + "\n",
  );

  return {
    ok: true,
    verdict: verdictFor(findings),
    omitted: capped.omitted,
    reportFile,
    reviewFile,
    report,
  };
}

type FailureOutput = {
  ok: false;
  code: string;
  message: string;
  hint: string;
  rejected?: Rejection[];
};

function print<T>(result: T): void {
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

function main(argv: string[]): number {
  let parsed;

  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        tier: { type: "string" },
        commit: { type: "string" },
        "max-findings": { type: "string" },
      },
    });
  } catch (cause) {
    process.stderr.write(String(cause) + "\n" + usage + "\n");

    return 64;
  }

  const [command, diffFile, findingsFile] = parsed.positionals;

  try {
    if (command === "tier" && diffFile !== undefined) {
      print(tierCommand(diffFile, parsed.values.tier));
    } else if (
      command === "check" &&
      diffFile !== undefined &&
      findingsFile !== undefined
    ) {
      print(
        checkCommand(
          diffFile,
          findingsFile,
          parsed.values.commit,
          maxFindings(parsed.values["max-findings"]),
        ),
      );
    } else {
      process.stderr.write(usage + "\n");

      return 64;
    }

    return 0;
  } catch (cause) {
    const failure =
      cause instanceof ReplyError
        ? new Failure(
            "bad_findings_json",
            findingsFile + ": " + cause.message,
            'Rewrite the file as {"findings": [...]} with the fields in references/reviewer.md, then run check again.',
          )
        : cause;

    if (!(failure instanceof Failure)) {
      throw failure;
    }

    const output: FailureOutput = {
      ok: false,
      code: failure.code,
      message: failure.message,
      hint: failure.hint,
    };

    if (failure.rejected.length > 0) {
      output.rejected = failure.rejected;
    }

    print(output);

    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
