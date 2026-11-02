// review-and-simplify helper. Two commands, both reading a unified diff file:
//
//   tier  <diff-file> [--tier trivial|lite|full]
//   check <diff-file> <findings-file> [--out <dir>] [--commit <sha>]
//
// Every result is one JSON object on stdout. A failure prints
// {"ok": false, "code", "message", "hint"} and exits 1 so the coordinator can
// correct its input and run the command again; a usage error exits 64.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  classify,
  type FileChange,
  hasDefaultPrefixes,
  modelFor,
  parseDiff,
  specialistsFor,
  type Tier,
  tiers,
} from "./diff.ts";
import {
  decodeAll,
  dedupe,
  githubReview,
  parseReply,
  ReplyError,
  renderReport,
  severities,
  verdictFor,
} from "./findings.ts";

class Failure extends Error {
  code: string;
  hint: string;

  constructor(code: string, message: string, hint: string) {
    super(message);
    this.code = code;
    this.hint = hint;
  }
}

const usage =
  "usage: review.ts tier <diff-file> [--tier trivial|lite|full]\n" +
  "       review.ts check <diff-file> <findings-file> [--out <dir>] [--commit <sha>]";

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
  const name = change.path.split("/").pop() ?? change.path;

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

function readDiff(path: string): FileChange[] {
  let text: string;

  try {
    text = readFileSync(path, "utf8");
  } catch (cause) {
    throw new Failure(
      "diff_unreadable",
      "cannot read diff file " + path + ": " + String(cause),
      "Write the diff of the change to a file with git diff against the merge base, and pass that path.",
    );
  }

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

function tierCommand(diffFile: string, forced: string | undefined) {
  const changes = readDiff(diffFile);
  const reviewed = changes.filter((change) => exclusion(change) === null);

  const excluded = changes.flatMap((change) => {
    const reason = exclusion(change);

    return reason === null ? [] : [{ path: change.path, reason }];
  });

  const override = tiers.find((tier) => tier === forced);

  if (forced !== undefined && override === undefined) {
    throw new Failure(
      "bad_tier",
      "unknown tier " + forced,
      "Pass one of " + tiers.join(", ") + ", or omit --tier.",
    );
  }

  const classified = classify(reviewed);
  const tier: Tier = override ?? classified.tier;

  return {
    ok: true,
    tier,
    reason:
      override === undefined
        ? classified.reason
        : "forced by --tier (" + classified.reason + ")",
    specialists: specialistsFor(tier).map((name) => ({
      name,
      model: modelFor(name),
    })),
    files: reviewed.map((change) => ({
      path: change.path,
      status: change.status,
      added: change.added,
      removed: change.removed,
    })),
    excluded,
  };
}

function checkCommand(
  diffFile: string,
  findingsFile: string,
  out: string | undefined,
  commit: string | undefined,
) {
  const changes = readDiff(diffFile);

  const files = new Map(
    changes
      .filter((change) => !change.binary)
      .map((change) => [change.path, change]),
  );

  let reply: string;

  try {
    reply = readFileSync(findingsFile, "utf8");
  } catch (cause) {
    throw new Failure(
      "findings_unreadable",
      "cannot read findings file " + findingsFile + ": " + String(cause),
      'Write the judged findings as {"findings": [...]} to a file and pass its path.',
    );
  }

  let raws;

  try {
    raws = parseReply(findingsFile, reply);
  } catch (cause) {
    if (cause instanceof ReplyError) {
      throw new Failure(
        "bad_findings_json",
        cause.message,
        'Rewrite the file as {"findings": [...]} with the fields in references/reviewer.md, then run check again.',
      );
    }

    throw cause;
  }

  const decoded = decodeAll(findingsFile, raws, null, files);

  if (decoded.rejected.length > 0) {
    return {
      ok: false,
      code: "invalid_findings",
      message:
        String(decoded.rejected.length) + " finding(s) failed validation",
      hint: "Fix each rejected finding: move its anchor onto changed lines of that file's hunks, or drop it. Then run check again.",
      rejected: decoded.rejected,
    };
  }

  const findings = dedupe(decoded.findings);
  const dir = resolve(out ?? dirname(findingsFile));
  const report = renderReport(findings);
  const reportFile = join(dir, "report.md");
  const reviewFile = join(dir, "github-review.json");

  writeFileSync(reportFile, report);
  writeFileSync(
    reviewFile,
    JSON.stringify(githubReview(findings, commit ?? null), null, 2) + "\n",
  );

  const counts = Object.fromEntries(
    severities.map((severity) => [
      severity,
      findings.filter(
        (finding) =>
          finding.severity === severity && finding.status !== "applied",
      ).length,
    ]),
  );

  return {
    ok: true,
    verdict: verdictFor(findings),
    counts: {
      ...counts,
      applied: findings.filter((finding) => finding.status === "applied")
        .length,
      duplicatesDropped: decoded.findings.length - findings.length,
    },
    reportFile,
    reviewFile,
    report,
  };
}

function main(argv: string[]): number {
  let parsed;

  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        tier: { type: "string" },
        out: { type: "string" },
        commit: { type: "string" },
      },
    });
  } catch (cause) {
    process.stderr.write(String(cause) + "\n" + usage + "\n");

    return 64;
  }

  const [command, diffFile, findingsFile] = parsed.positionals;

  try {
    let result:
      | ReturnType<typeof tierCommand>
      | ReturnType<typeof checkCommand>;

    if (command === "tier" && diffFile !== undefined) {
      result = tierCommand(diffFile, parsed.values.tier);
    } else if (
      command === "check" &&
      diffFile !== undefined &&
      findingsFile !== undefined
    ) {
      result = checkCommand(
        diffFile,
        findingsFile,
        parsed.values.out,
        parsed.values.commit,
      );
    } else {
      process.stderr.write(usage + "\n");

      return 64;
    }

    process.stdout.write(JSON.stringify(result, null, 2) + "\n");

    return "ok" in result && result.ok === false ? 1 : 0;
  } catch (cause) {
    if (cause instanceof Failure) {
      process.stdout.write(
        JSON.stringify(
          {
            ok: false,
            code: cause.code,
            message: cause.message,
            hint: cause.hint,
          },
          null,
          2,
        ) + "\n",
      );

      return 1;
    }

    throw cause;
  }
}

process.exitCode = main(process.argv.slice(2));
