// Decodes specialist and coordinator findings, checks each anchor against the
// reviewed diff, drops exact duplicates, and renders the report.

import {
  type FileChange,
  inHunk,
  type Specialist,
  specialists,
} from "./diff.ts";

export const severities = ["critical", "warning", "suggestion"] as const;

export type Severity = (typeof severities)[number];

export const statuses = ["open", "applied", "reverted"] as const;

export type Status = (typeof statuses)[number];

export type Finding = {
  specialist: Specialist;
  path: string;
  start_line: number;
  end_line: number;
  severity: Severity;
  title: string;
  body: string;
  replacement: string | null;
  status: Status;
  also_raised_by: Specialist[];
};

// The contract a reply claims to follow. Every field is checked at runtime by
// `decodeFinding`, because a model wrote it.
export type RawFinding = {
  specialist?: string;
  path?: string;
  start_line?: number;
  end_line?: number;
  severity?: string;
  title?: string;
  body?: string;
  replacement?: string | null;
  status?: string;
  also_raised_by?: string[];
};

type RawReply = RawFinding[] | { findings?: RawFinding[] };

export type Rejection = {
  source: string;
  index: number;
  code: string;
  detail: string;
};

export type Decoded = { findings: Finding[]; rejected: Rejection[] };

export type Verdict = "approve" | "comment" | "request_changes";

function text(value: string | undefined): string | null {
  return value !== undefined && String(value) === value && value.trim() !== ""
    ? value
    : null;
}

function line(value: number | undefined): number | null {
  return Number.isInteger(value) && Number(value) >= 1 ? Number(value) : null;
}

function member<T extends string>(
  values: readonly T[],
  value: string | undefined,
): T | null {
  return values.find((candidate) => candidate === value) ?? null;
}

// Written as \u0060 so no literal backtick sits in a string.
const tick = "\u0060";

const fence = tick.repeat(3);

const fencePattern = new RegExp(
  fence + "(?:json)?\\s*\\n([\\s\\S]*?)\\n" + fence,
);

// A reply may wrap its JSON in a Markdown fence or add prose around it; keep
// the outermost JSON value.
export function extractJson(reply: string): string {
  const fenced = reply.match(fencePattern);
  const body = (fenced?.[1] ?? reply).trim();
  const starts = [body.indexOf("{"), body.indexOf("[")].filter((at) => at >= 0);

  if (starts.length === 0) {
    return body;
  }

  const start = Math.min(...starts);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));

  return end > start ? body.slice(start, end + 1) : body;
}

export class ReplyError extends Error {}

export function parseReply(source: string, reply: string): RawFinding[] {
  let parsed: RawReply;

  try {
    parsed = JSON.parse(extractJson(reply));
  } catch (cause) {
    throw new ReplyError(source + ": not JSON (" + String(cause) + ")");
  }

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed !== null && Array.isArray(parsed.findings)) {
    return parsed.findings;
  }

  throw new ReplyError(
    source + ': expected {"findings": [...]} or a JSON array of findings',
  );
}

export function decodeFinding(
  raw: RawFinding,
  fallback: Specialist | null,
  files: ReadonlyMap<string, FileChange>,
): Finding | { code: string; detail: string } {
  const specialist = member(specialists, raw.specialist) ?? fallback;
  const path = text(raw.path);
  const start = line(raw.start_line);
  const end = line(raw.end_line ?? raw.start_line);
  const severity = member(severities, raw.severity);
  const title = text(raw.title);
  const body = text(raw.body);

  const status =
    raw.status === undefined ? "open" : member(statuses, raw.status);

  const replacement = raw.replacement ?? null;

  if (specialist === null) {
    return {
      code: "bad_specialist",
      detail: "specialist " + String(raw.specialist),
    };
  }

  if (path === null || !files.has(path)) {
    return { code: "path_not_reviewed", detail: "path " + String(raw.path) };
  }

  if (start === null || end === null || end < start) {
    return {
      code: "bad_lines",
      detail:
        "start_line " +
        String(raw.start_line) +
        ", end_line " +
        String(raw.end_line),
    };
  }

  const change = files.get(path);

  if (change === undefined || !inHunk(change, start, end)) {
    return {
      code: "line_not_in_hunk",
      detail:
        path +
        ":" +
        String(start) +
        "-" +
        String(end) +
        " is outside every hunk of the diff",
    };
  }

  if (severity === null) {
    return { code: "bad_severity", detail: "severity " + String(raw.severity) };
  }

  if (title === null || body === null) {
    return { code: "missing_text", detail: "title and body must be non-empty" };
  }

  if (status === null) {
    return { code: "bad_status", detail: "status " + String(raw.status) };
  }

  if (replacement !== null && String(replacement) !== replacement) {
    return { code: "bad_replacement", detail: "replacement must be a string" };
  }

  const alsoRaisedBy = (raw.also_raised_by ?? []).flatMap((name) => {
    const known = member(specialists, name);

    return known === null ? [] : [known];
  });

  return {
    specialist,
    path,
    start_line: start,
    end_line: end,
    severity,
    title,
    body,
    replacement,
    status,
    also_raised_by: alsoRaisedBy,
  };
}

export function decodeAll(
  source: string,
  raws: readonly RawFinding[],
  fallback: Specialist | null,
  files: ReadonlyMap<string, FileChange>,
): Decoded {
  const findings: Finding[] = [];
  const rejected: Rejection[] = [];

  raws.forEach((raw, index) => {
    const decoded = decodeFinding(raw, fallback, files);

    if ("code" in decoded) {
      rejected.push({ source, index, ...decoded });
    } else {
      findings.push(decoded);
    }
  });

  return { findings, rejected };
}

function normalize(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const severityRank: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  suggestion: 2,
};

// Keeps one finding per path, overlapping range, and title. The coordinator's
// judge pass handles duplicates that differ in wording.
export function dedupe(findings: readonly Finding[]): Finding[] {
  const kept: Finding[] = [];

  for (const finding of findings) {
    const twin = kept.find(
      (other) =>
        other.path === finding.path &&
        other.start_line <= finding.end_line &&
        finding.start_line <= other.end_line &&
        normalize(other.title) === normalize(finding.title),
    );

    if (twin === undefined) {
      kept.push({ ...finding, also_raised_by: [...finding.also_raised_by] });

      continue;
    }

    if (
      twin.specialist !== finding.specialist &&
      !twin.also_raised_by.includes(finding.specialist)
    ) {
      twin.also_raised_by.push(finding.specialist);
    }

    if (severityRank[finding.severity] < severityRank[twin.severity]) {
      twin.severity = finding.severity;
    }
  }

  return kept;
}

export function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(
    (left, right) =>
      severityRank[left.severity] - severityRank[right.severity] ||
      left.path.localeCompare(right.path) ||
      left.start_line - right.start_line,
  );
}

function blocking(findings: readonly Finding[]): Finding[] {
  return findings.filter((finding) => finding.status !== "applied");
}

export function verdictFor(findings: readonly Finding[]): Verdict {
  const open = blocking(findings);

  if (open.some((finding) => finding.severity === "critical")) {
    return "request_changes";
  }

  if (open.some((finding) => finding.severity === "warning")) {
    return "comment";
  }

  return "approve";
}

const verdictLine: Record<Verdict, string> = {
  approve: "Approve: nothing above a suggestion remains.",
  comment: "Comment: warnings remain; fix or answer them before merging.",
  request_changes: "Request changes: a critical finding remains.",
};

export function verdictText(verdict: Verdict): string {
  return verdictLine[verdict];
}

function capitalize(word: string): string {
  return word.slice(0, 1).toUpperCase() + word.slice(1);
}

function range(finding: Finding): string {
  return finding.start_line === finding.end_line
    ? String(finding.start_line)
    : String(finding.start_line) + "-" + String(finding.end_line);
}

export function findingBody(finding: Finding): string {
  const label = capitalize(finding.severity);
  const raisedBy = [finding.specialist, ...finding.also_raised_by].join(", ");

  const parts = [
    "**" + label + ": " + finding.title + "** (" + raisedBy + ")",
    "",
    finding.body,
  ];

  if (finding.replacement !== null) {
    parts.push("", fence + "suggestion", finding.replacement, fence);
  }

  return parts.join("\n");
}

export function renderReport(input: readonly Finding[]): string {
  const findings = sortFindings(input);
  const applied = findings.filter((finding) => finding.status === "applied");
  const open = blocking(findings);
  const lines = ["**Verdict:** " + verdictText(verdictFor(findings))];

  for (const severity of severities) {
    const group = open.filter((finding) => finding.severity === severity);

    if (group.length === 0) {
      continue;
    }

    lines.push("", "## " + capitalize(severity) + " (" + group.length + ")");

    for (const finding of group) {
      const reverted =
        finding.status === "reverted" ? " (simplification reverted)" : "";

      lines.push(
        "",
        "### " + tick + finding.path + ":" + range(finding) + tick + reverted,
        "",
        findingBody(finding),
      );
    }
  }

  if (applied.length > 0) {
    lines.push(
      "",
      "## Applied simplifications (" + String(applied.length) + ")",
      "",
    );

    for (const finding of applied) {
      lines.push(
        "- " +
          tick +
          finding.path +
          ":" +
          range(finding) +
          tick +
          " " +
          finding.title,
      );
    }
  }

  if (findings.length === 0) {
    lines.push("", "No findings.");
  }

  return lines.join("\n") + "\n";
}

export type ReviewComment = {
  path: string;
  line: number;
  side: "RIGHT";
  start_line?: number;
  start_side?: "RIGHT";
  body: string;
};

export type GithubReview = {
  commit_id?: string;
  event: "COMMENT";
  body: string;
  comments: ReviewComment[];
};

// The body of `POST /repos/{owner}/{repo}/pulls/{number}/reviews`. The event
// is always COMMENT: the verdict is text, so the agent never approves or
// blocks a pull request.
export function githubReview(
  input: readonly Finding[],
  commit: string | null,
): GithubReview {
  const findings = sortFindings(blocking(input));
  const verdict = verdictText(verdictFor(input));

  const comments = findings.map((finding): ReviewComment => {
    const comment: ReviewComment = {
      path: finding.path,
      line: finding.end_line,
      side: "RIGHT",
      body: findingBody(finding),
    };

    if (finding.start_line !== finding.end_line) {
      comment.start_line = finding.start_line;
      comment.start_side = "RIGHT";
    }

    return comment;
  });

  const review: GithubReview = {
    event: "COMMENT",
    body:
      "**review-and-simplify verdict:** " +
      verdict +
      " " +
      String(comments.length) +
      " inline finding(s).",
    comments,
  };

  if (commit !== null) {
    review.commit_id = commit;
  }

  return review;
}
