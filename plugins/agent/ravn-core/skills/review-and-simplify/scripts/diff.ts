// Parses `git diff` output into per-file changes and classifies a change into
// a review tier. The tier rules follow Symphony's engine.Classify.

type Hunk = { start: number; count: number };

export type FileChange = {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  binary: boolean;
  added: number;
  removed: number;
  hunks: Hunk[];
};

export const tiers = ["trivial", "lite", "full"] as const;

export type Tier = (typeof tiers)[number];

export const specialists = [
  "security",
  "performance",
  "code_quality",
  "documentation",
  "release",
  "engineering_standards",
  "agents_md",
  "simplify",
] as const;

export type Specialist = (typeof specialists)[number];

export type Assignment = {
  name: Specialist;
  model: "session" | "step-down";
};

const tierSpecialists: Record<Tier, readonly Specialist[]> = {
  trivial: ["code_quality"],
  lite: ["code_quality", "documentation", "agents_md", "simplify"],
  full: specialists,
};

// These specialists need the session's own model; the rest may step down to a
// cheaper model of the same family where the harness lets a spawn pick one.
const sessionModelSpecialists: readonly Specialist[] = [
  "security",
  "code_quality",
  "simplify",
];

const sensitiveWords = new Set([
  "auth",
  "authn",
  "authz",
  "authentication",
  "authorization",
  "login",
  "credential",
  "credentials",
  "crypto",
  "security",
  "secret",
  "secrets",
  "password",
  "passwords",
  "token",
  "tokens",
  "session",
  "sessions",
  "oauth",
  "jwt",
  "permission",
  "permissions",
  "acl",
  "rbac",
  "iam",
]);

export function member<T extends string>(
  values: readonly T[],
  value: string | undefined,
): T | null {
  return values.find((candidate) => candidate === value) ?? null;
}

export function specialistsFor(tier: Tier): Assignment[] {
  return tierSpecialists[tier].map((name) => ({
    name,
    model: sessionModelSpecialists.includes(name) ? "session" : "step-down",
  }));
}

// A path segment's words, split at non-letters and camel-case boundaries, so
// `OAuthToken.ts` yields `O`, `Auth`, `Token`, `ts`.
const wordBoundary = /[^A-Za-z]+|(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/;

function isSensitive(path: string): boolean {
  return path
    .split("/")
    .some((segment) =>
      segment
        .split(wordBoundary)
        .some((word) => sensitiveWords.has(word.toLowerCase())),
    );
}

export type Classification = { tier: Tier; reason: string };

export function classify(changes: readonly FileChange[]): Classification {
  const sensitive = changes.find((change) => isSensitive(change.path));

  if (sensitive !== undefined) {
    return { tier: "full", reason: "sensitive path " + sensitive.path };
  }

  const lines = changes.reduce(
    (total, change) => total + change.added + change.removed,
    0,
  );

  const reason =
    String(lines) + " changed lines in " + String(changes.length) + " files";

  if (lines <= 10 && changes.length <= 20) {
    return { tier: "trivial", reason };
  }

  if (lines <= 100 && changes.length <= 20) {
    return { tier: "lite", reason };
  }

  return { tier: "full", reason };
}

// True when every file header uses git's default a/ and b/ prefixes. A user's
// diff.mnemonicPrefix or diff.noprefix setting changes them, and the parser
// would then read the prefix as part of each path.
export function hasDefaultPrefixes(text: string): boolean {
  return text
    .split("\n")
    .filter((line) => line.startsWith("diff --git "))
    .every((line) => {
      const body = line.slice("diff --git ".length);

      return (
        (body.startsWith("a/") || body.startsWith('"a/')) &&
        (body.includes(" b/") || body.includes(' "b/'))
      );
    });
}

// `b/src/x.ts` or `"b/src/x y.ts"` without its quotes and b/ prefix.
function unprefixed(path: string): string {
  const unquoted =
    path.startsWith('"') && path.endsWith('"') ? path.slice(1, -1) : path;

  return unquoted.slice(2);
}

function headerPath(line: string): string {
  const at = Math.max(line.lastIndexOf(" b/"), line.lastIndexOf(' "b/'));

  return unprefixed(line.slice(at + 1));
}

function readHeader(change: FileChange, line: string): void {
  if (line.startsWith("new file mode")) {
    change.status = "added";
  } else if (line.startsWith("deleted file mode")) {
    change.status = "deleted";
  } else if (line.startsWith("rename to ")) {
    change.status = "renamed";
    change.path = line.slice("rename to ".length);
  } else if (line.startsWith("Binary files ") || line === "GIT binary patch") {
    change.binary = true;
  } else if (line.startsWith("+++ ") && line !== "+++ /dev/null") {
    change.path = unprefixed(line.slice(4));
  }
}

const hunkHeader = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

export function parseDiff(text: string): FileChange[] {
  const changes: FileChange[] = [];
  let change: FileChange | null = null;
  let inBody = false;

  for (const line of text.split("\n")) {
    if (line.startsWith("diff --git ")) {
      change = {
        path: headerPath(line),
        status: "modified",
        binary: false,
        added: 0,
        removed: 0,
        hunks: [],
      };

      changes.push(change);

      inBody = false;

      continue;
    }

    if (change === null) {
      continue;
    }

    const hunk = line.match(hunkHeader);

    if (hunk !== null) {
      inBody = true;
      change.hunks.push({
        start: Number(hunk[1]),
        count: hunk[2] === undefined ? 1 : Number(hunk[2]),
      });
    } else if (!inBody) {
      readHeader(change, line);
    } else if (line.startsWith("+")) {
      change.added += 1;
    } else if (line.startsWith("-")) {
      change.removed += 1;
    }
  }

  return changes;
}

// True when new-file lines start..end sit inside one hunk of the change.
export function inHunk(
  change: FileChange,
  start: number,
  end: number,
): boolean {
  return change.hunks.some(
    (hunk) =>
      hunk.count > 0 &&
      start >= hunk.start &&
      end <= hunk.start + hunk.count - 1,
  );
}
