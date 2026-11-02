// Parses `git diff` output into per-file changes and classifies a change into
// a review tier. The tier rules follow Symphony's engine.Classify.

export type Hunk = { start: number; count: number };

export type FileStatus = "added" | "modified" | "deleted" | "renamed";

export type FileChange = {
  path: string;
  oldPath: string | null;
  status: FileStatus;
  binary: boolean;
  added: number;
  removed: number;
  hunks: Hunk[];
  patch: string;
};

export type Tier = "trivial" | "lite" | "full";

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

export const tiers: readonly Tier[] = ["trivial", "lite", "full"];

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

const limits = {
  trivialLines: 10,
  trivialFiles: 20,
  liteLines: 100,
  liteFiles: 20,
  fullFiles: 50,
} as const;

export function specialistsFor(tier: Tier): readonly Specialist[] {
  return tierSpecialists[tier];
}

export function modelFor(specialist: Specialist): "session" | "step-down" {
  return sessionModelSpecialists.includes(specialist) ? "session" : "step-down";
}

function isUpper(char: string): boolean {
  return char !== char.toLowerCase() && char === char.toUpperCase();
}

function isLower(char: string): boolean {
  return char !== char.toUpperCase() && char === char.toLowerCase();
}

// Splits one path segment into lowercase words at `_`, `-`, `.`, and camel
// case boundaries, so `OAuthToken.ts` yields `o`, `auth`, `token`, `ts`.
export function pathWords(segment: string): string[] {
  const chars = [...segment];
  const words: string[] = [];
  let start = 0;

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index] ?? "";
    const separator = char === "_" || char === "-" || char === ".";
    const previous = chars[index - 1] ?? "";
    const next = chars[index + 1] ?? "";
    const acronymEnds = isUpper(previous) && isLower(next);

    const boundary =
      index > 0 && isUpper(char) && (isLower(previous) || acronymEnds);

    if (separator || boundary) {
      words.push(chars.slice(start, index).join("").toLowerCase());
      start = separator ? index + 1 : index;
    }
  }

  words.push(chars.slice(start).join("").toLowerCase());

  return words.filter((word) => word !== "");
}

export function isSensitive(path: string): boolean {
  return path
    .split("/")
    .some(
      (segment) =>
        sensitiveWords.has(segment.toLowerCase()) ||
        pathWords(segment).some((word) => sensitiveWords.has(word)),
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

  const counts =
    String(lines) + " changed lines in " + String(changes.length) + " files";

  if (changes.length > limits.fullFiles) {
    return { tier: "full", reason: counts };
  }

  if (lines <= limits.trivialLines && changes.length <= limits.trivialFiles) {
    return { tier: "trivial", reason: counts };
  }

  if (lines <= limits.liteLines && changes.length <= limits.liteFiles) {
    return { tier: "lite", reason: counts };
  }

  return { tier: "full", reason: counts };
}

function stripPrefix(path: string, prefix: string): string {
  const unquoted =
    path.startsWith('"') && path.endsWith('"') ? path.slice(1, -1) : path;

  return unquoted.startsWith(prefix) ? unquoted.slice(prefix.length) : unquoted;
}

type HeaderPaths = { oldPath: string; newPath: string };

function headerPaths(line: string): HeaderPaths {
  const body = line.slice("diff --git ".length);
  const split = body.lastIndexOf(" b/");

  if (split === -1) {
    return { oldPath: body, newPath: body };
  }

  return {
    oldPath: stripPrefix(body.slice(0, split), "a/"),
    newPath: body.slice(split + " b/".length),
  };
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

const hunkHeader = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

type Draft = FileChange & { inHunk: boolean; lines: string[] };

function startFile(line: string): Draft {
  const { oldPath, newPath } = headerPaths(line);

  return {
    path: newPath,
    oldPath: oldPath === newPath ? null : oldPath,
    status: "modified",
    binary: false,
    added: 0,
    removed: 0,
    hunks: [],
    patch: "",
    inHunk: false,
    lines: [line],
  };
}

function finish(draft: Draft): FileChange {
  const { inHunk: _inHunk, lines, ...change } = draft;

  return {
    ...change,
    oldPath: change.status === "renamed" ? change.oldPath : null,
    patch: lines.join("\n") + "\n",
  };
}

function readHeader(draft: Draft, line: string): void {
  if (line.startsWith("new file mode")) {
    draft.status = "added";
  } else if (line.startsWith("deleted file mode")) {
    draft.status = "deleted";
  } else if (line.startsWith("rename from ")) {
    draft.status = "renamed";
    draft.oldPath = line.slice("rename from ".length);
  } else if (line.startsWith("rename to ")) {
    draft.path = line.slice("rename to ".length);
  } else if (line.startsWith("Binary files ") || line === "GIT binary patch") {
    draft.binary = true;
  } else if (line.startsWith("--- ")) {
    const path = line.slice(4);

    if (path === "/dev/null") {
      draft.status = "added";
    }
  } else if (line.startsWith("+++ ")) {
    const path = line.slice(4);

    if (path === "/dev/null") {
      draft.status = "deleted";
      draft.path = draft.oldPath ?? draft.path;
    } else {
      draft.path = stripPrefix(path, "b/");
    }
  }
}

export function parseDiff(text: string): FileChange[] {
  const changes: FileChange[] = [];
  let draft: Draft | null = null;

  for (const line of text.split("\n")) {
    if (line.startsWith("diff --git ")) {
      if (draft !== null) {
        changes.push(finish(draft));
      }

      draft = startFile(line);

      continue;
    }

    if (draft === null) {
      continue;
    }

    draft.lines.push(line);

    const hunk = hunkHeader.exec(line);

    if (hunk !== null) {
      draft.inHunk = true;
      draft.hunks.push({
        start: Number(hunk[1]),
        count: hunk[2] === undefined ? 1 : Number(hunk[2]),
      });
    } else if (!draft.inHunk) {
      readHeader(draft, line);
    } else if (line.startsWith("+")) {
      draft.added += 1;
    } else if (line.startsWith("-")) {
      draft.removed += 1;
    }
  }

  if (draft !== null) {
    changes.push(finish(draft));
  }

  for (const change of changes) {
    if (change.patch.endsWith("\n\n")) {
      change.patch = change.patch.slice(0, -1);
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
