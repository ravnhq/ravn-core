// Pure logic for the secret-entry mod: the {{secret:NAME}} marker convention,
// the masked-entry mapping, dotenv patching, Edit application, and Read-result
// redaction. Everything here works on plain strings, so every rule is testable
// without the engine.

/** The marker a file's content carries where a secret goes. */
export const MARKER = "{{secret:NAME}}";

const MARKER_SOURCE = "\\{\\{secret:([A-Za-z0-9_.-]+)\\}\\}";

function markerPattern(flags: "g" | ""): RegExp {
  return new RegExp(MARKER_SOURCE, flags);
}

/** The distinct marker names in a template, in order of first appearance. */
export function markerNames(template: string): string[] {
  const names: string[] = [];

  for (const match of template.matchAll(markerPattern("g"))) {
    const name = match[1] ?? "";

    if (name !== "" && !names.includes(name)) names.push(name);
  }

  return names;
}

/** Replaces every marker with the value entered for its name. */
export function fillMarkers(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(
    markerPattern("g"),
    (_all: string, name: string) => values[name] ?? "",
  );
}

/** What the entry field draws: one bullet per character. */
export function maskOf(value: string): string {
  return "•".repeat(Array.from(value).length);
}

/**
 * Maps what the entry field shows back to the real value. The field holds
 * bullets for what was drawn plus whatever the person just typed or pasted,
 * so the shared bullet prefix is the untouched part and the rest is fresh.
 */
export function typedValue(shown: string, real: string): string {
  const mask = Array.from(maskOf(real));
  const typed = Array.from(shown);
  const end = Math.min(mask.length, typed.length);
  let k = 0;

  while (k < end && mask[k] === typed[k]) k += 1;

  return `${Array.from(real).slice(0, k).join("")}${typed.slice(k).join("")}`;
}

/**
 * A terminal delivers a pasted newline as a carriage return, so a multi-line
 * value (a PEM key) comes in with CR line ends. Every line end becomes LF,
 * and line ends after the value are dropped.
 */
export function normalizeLineEnds(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
}

/** A dotenv value that needs no quotes. */
const BARE_VALUE = /^[A-Za-z0-9_@%+=:,./-]+$/;

/** One `KEY=value` line, quoted only when the value needs it. */
export function dotenvLine(key: string, value: string): string {
  const trimmed = value.replace(/[\r\n]+$/, "");

  return BARE_VALUE.test(trimmed)
    ? `${key}=${trimmed}`
    : `${key}="${trimmed.replace(/([$"\\])/g, "\\$1")}"`;
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Sets each KEY in the file: its first `KEY=` line (an `export ` prefix is
 * kept) is replaced, and a KEY with no line is appended.
 */
export function applyDotenv(
  content: string,
  entries: { key: string; value: string }[],
): string {
  let out = content;

  for (const entry of entries) {
    const line = new RegExp(
      // A double-quoted value may span lines, as a pasted PEM key does.
      `^(export\\s+)?${escapeRe(entry.key)}=(?:"(?:[^"\\\\]|\\\\.)*"|.*)$`,
      "m",
    );

    if (line.test(out)) {
      out = out.replace(
        line,
        (_all: string, exported: string | undefined) =>
          `${exported ?? ""}${dotenvLine(entry.key, entry.value)}`,
      );
      continue;
    }

    out =
      out === ""
        ? `${dotenvLine(entry.key, entry.value)}\n`
        : `${out.replace(/\n*$/, "\n")}${dotenvLine(entry.key, entry.value)}\n`;
  }

  return out;
}

export type EditOutcome =
  | { ok: true; content: string }
  | { ok: false; error: string };

/** The Edit tool's replacement, with the filled new string. */
export function applyEdit(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean,
): EditOutcome {
  const count = content.split(oldString).length - 1;

  if (count === 0) {
    return { ok: false, error: "the text to replace is not in the file" };
  }

  if (count > 1 && !replaceAll) {
    return {
      ok: false,
      error: `the text to replace appears ${count} times`,
    };
  }

  return {
    ok: true,
    content: replaceAll
      ? content.split(oldString).join(newString)
      : content.replace(oldString, newString),
  };
}

/** The template with its markers elided, safe to show in a tool result. */
export function elideMarkers(template: string, limit = 400): string {
  const text = template.replace(
    markerPattern("g"),
    (_all: string, name: string) => `<secret:${name}>`,
  );

  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

/** What a redacted string shows in place of a secret. */
export const REDACTED = "<secret redacted>";

/** Replaces every occurrence of each value in a string. */
export function redactText(text: string, values: string[]): string {
  let out = text;

  for (const value of values) {
    if (value !== "" && out.includes(value))
      out = out.split(value).join(REDACTED);
  }

  return out;
}

/**
 * Replaces each value inside serialized JSON, as a Read result travels. A
 * value is matched in its JSON-escaped form, so one holding a quote or a
 * backslash is found too.
 */
export function redactSerialized(json: string, values: string[]): string {
  return redactText(
    json,
    values.map((value) => JSON.stringify(value).slice(1, -1)),
  );
}

type Json = null | boolean | number | string | Json[] | JsonObject;

type JsonObject = { [key: string]: Json };

/** The arguments of a Write, Edit, or write-tool call that the mod reads. */
export type ToolArgs = {
  filePath: string | undefined;
  content: string | undefined;
  oldString: string | undefined;
  newString: string | undefined;
  replaceAll: boolean;
};

function isJsonObject(value: Json | undefined): value is JsonObject {
  return value === Object(value) && !Array.isArray(value);
}

function isString(value: Json | undefined): value is string {
  return value === String(value);
}

/** Reads a tool call's arguments, as JSON, keeping the string fields. */
export function parseToolArgs(source: string): ToolArgs {
  let input: Json = null;

  try {
    input = JSON.parse(source);
  } catch {
    // an unreadable call has no arguments the mod acts on
  }

  const fields: JsonObject = isJsonObject(input) ? input : {};

  const text = (name: string) => {
    const value = fields[name];

    return isString(value) ? value : undefined;
  };

  return {
    filePath: text("file_path"),
    content: text("content"),
    oldString: text("old_string"),
    newString: text("new_string"),
    replaceAll: fields.replace_all === true,
  };
}

/** Ways to print the system clipboard, by what `uname -s` says. */
export function clipboardReaders(uname: string): string[][] {
  if (uname === "Darwin") return [["pbpaste"]];

  if (uname === "Linux") {
    return [
      ["wl-paste"],
      ["xclip", "-o", "-selection", "clipboard"],
      ["xsel", "--clipboard", "--output"],
    ];
  }

  return [];
}

/** The input schema of the write tool Claude can call. */
export const INPUT_SCHEMA = {
  type: "object",
  properties: {
    file_path: {
      type: "string",
      description: "The file to write, as for the Write tool",
    },
    content: {
      type: "string",
      description: `The file's content, with ${MARKER} where each secret goes`,
    },
  },
  required: ["file_path", "content"],
} as const;
