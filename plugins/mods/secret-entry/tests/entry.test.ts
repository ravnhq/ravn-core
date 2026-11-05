import { expect, test } from "claude-code/testing";

import {
  REDACTED,
  applyDotenv,
  applyEdit,
  clipboardReaders,
  dotenvLine,
  elideMarkers,
  fillMarkers,
  markerNames,
  maskOf,
  normalizeLineEnds,
  parseToolArgs,
  redactSerialized,
  redactText,
  typedValue,
} from "../lib/entry.ts";

test("markerNames lists each distinct name in order", () => {
  expect(markerNames("a={{secret:A}} b={{secret:B}} a={{secret:A}}")).toEqual([
    "A",
    "B",
  ]);
  expect(markerNames("no markers here")).toEqual([]);
  expect(markerNames("{{secret:a.b_c-d}}")).toEqual(["a.b_c-d"]);
});

test("fillMarkers replaces each marker with its value", () => {
  expect(
    fillMarkers("A={{secret:A}}\nB={{secret:B}}", { A: "1", B: "2" }),
  ).toBe("A=1\nB=2");
  // A name no value was entered for becomes empty, never a leftover marker.
  expect(fillMarkers("A={{secret:A}}", {})).toBe("A=");
});

test("maskOf draws one bullet per character", () => {
  expect(maskOf("abc")).toBe("•••");
  expect(maskOf("a🎉b")).toBe("•••");
  expect(maskOf("")).toBe("");
});

test("typedValue maps the masked field back to the real value", () => {
  // A paste into the empty field.
  expect(typedValue("hunter2", "")).toBe("hunter2");
  // Typing after what was drawn: the bullet prefix maps back to the value.
  expect(typedValue("••••••2", "hunter")).toBe("hunter2");
  // Deleting a trailing character shortens the value.
  expect(typedValue("•••••", "hunter")).toBe("hunte");
  // A paste in the middle: everything past the shared prefix is fresh.
  expect(typedValue("••XY", "ab")).toBe("abXY");
  // An emoji is one bullet, and maps back as one character.
  expect(typedValue("•🎉", "a")).toBe("a🎉");
});

test("normalizeLineEnds turns a pasted CR into LF and trims the end", () => {
  expect(normalizeLineEnds("-----BEGIN-----\rAAA\rBBB\r-----END-----\r")).toBe(
    "-----BEGIN-----\nAAA\nBBB\n-----END-----",
  );
  expect(normalizeLineEnds("a\r\nb\n\n")).toBe("a\nb");
  expect(normalizeLineEnds("sk-plain")).toBe("sk-plain");
});

test("dotenvLine quotes only values that need it", () => {
  expect(dotenvLine("K", "abc123")).toBe("K=abc123");
  expect(dotenvLine("K", "a b")).toBe('K="a b"');
  expect(dotenvLine("K", 'a"b$c\\d')).toBe('K="a\\"b\\$c\\\\d"');
  // A trailing newline would swallow the next line, so it is trimmed.
  expect(dotenvLine("K", "abc\n")).toBe("K=abc");
  expect(dotenvLine("K", "")).toBe('K=""');
});

test("applyDotenv replaces a key's line and appends a new key", () => {
  expect(applyDotenv("A=1\nK=old\nB=2\n", [{ key: "K", value: "new" }])).toBe(
    "A=1\nK=new\nB=2\n",
  );
  expect(applyDotenv("A=1\n", [{ key: "K", value: "new" }])).toBe(
    "A=1\nK=new\n",
  );
  expect(applyDotenv("", [{ key: "K", value: "new" }])).toBe("K=new\n");
  expect(applyDotenv("A=1", [{ key: "K", value: "new" }])).toBe("A=1\nK=new\n");
  // An export prefix is kept, and several keys land in one pass.
  expect(
    applyDotenv("export K=old\n", [
      { key: "K", value: "new" },
      { key: "J", value: "2" },
    ]),
  ).toBe("export K=new\nJ=2\n");
  // A quoted multi-line value is replaced whole, not just its first line.
  expect(
    applyDotenv('A=1\nPEM="-----BEGIN-----\nOLD\n-----END-----"\nB=2\n', [
      { key: "PEM", value: "-----BEGIN-----\nNEW\n-----END-----" },
    ]),
  ).toBe('A=1\nPEM="-----BEGIN-----\nNEW\n-----END-----"\nB=2\n');
});

test("applyEdit applies the Edit tool's replacement rules", () => {
  expect(applyEdit("a old b", "old", "new", false)).toEqual({
    ok: true,
    content: "a new b",
  });
  expect(applyEdit("a b a", "a", "c", false)).toEqual({
    ok: false,
    error: "the text to replace appears 2 times",
  });
  expect(applyEdit("a b a", "a", "c", true)).toEqual({
    ok: true,
    content: "c b c",
  });
  expect(applyEdit("a b", "x", "c", false)).toEqual({
    ok: false,
    error: "the text to replace is not in the file",
  });
});

test("elideMarkers replaces markers and truncates a long template", () => {
  expect(elideMarkers("A={{secret:A}}\nB={{secret:B}}")).toBe(
    "A=<secret:A>\nB=<secret:B>",
  );
  const long = `${"x".repeat(500)}{{secret:A}}`;
  expect(elideMarkers(long)).toBe(`${"x".repeat(400)}…`);
});

test("redaction replaces each value in text and in serialized JSON", () => {
  expect(redactText("key=hunter2 end", ["hunter2"])).toBe(
    `key=${REDACTED} end`,
  );
  const result = JSON.stringify({ file: { content: 'a hun"ter b' } });
  expect(JSON.parse(redactSerialized(result, ['hun"ter']))).toEqual({
    file: { content: `a ${REDACTED} b` },
  });
  // An empty value would redact everything, so it never does.
  expect(redactText("abc", [""])).toBe("abc");
});

test("parseToolArgs keeps the string fields and the replace flag", () => {
  expect(
    parseToolArgs(
      JSON.stringify({
        tool: "Edit",
        file_path: "conf",
        old_string: "a",
        new_string: "b",
        replace_all: true,
        content: 3,
      }),
    ),
  ).toEqual({
    filePath: "conf",
    content: undefined,
    oldString: "a",
    newString: "b",
    replaceAll: true,
  });
  expect(parseToolArgs("not json").filePath).toBeUndefined();
});

test("clipboardReaders names the readers each platform has", () => {
  expect(clipboardReaders("Darwin")).toEqual([["pbpaste"]]);
  expect(clipboardReaders("Linux")[0]).toEqual(["wl-paste"]);
  expect(clipboardReaders("Linux")).toContainEqual([
    "xclip",
    "-o",
    "-selection",
    "clipboard",
  ]);
  expect(clipboardReaders("SunOS")).toEqual([]);
});
