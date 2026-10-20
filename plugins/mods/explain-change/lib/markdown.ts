// A section's markdown, cut at its fenced code blocks so the pane can draw
// each fence with the element that colours it.
export type Segment =
  | { kind: "prose"; text: string }
  | { kind: "code"; language: string; source: string };

// Fence languages the skill uses for drawings rather than source code.
export const DIAGRAM_LANGUAGES: ReadonlySet<string> = new Set([
  "",
  "text",
  "txt",
  "plain",
]);

// An opening fence: up to three spaces of indent, so a fence nested in a list stays prose.
const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/;

export function segments(markdown: string): Segment[] {
  const result: Segment[] = [];
  const prose: string[] = [];
  const lines = markdown.split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const open = FENCE.exec(line);

    if (open === null) {
      prose.push(line);
      index += 1;
      continue;
    }

    const marker = open[1] ?? "```";

    const close = lines.findIndex(
      (candidate, at) => at > index && isClosing(candidate.trim(), marker),
    );

    // An unclosed fence stays prose, as a markdown renderer would draw it.
    if (close === -1) {
      prose.push(line);
      index += 1;
      continue;
    }

    pushProse(result, prose);
    result.push({
      kind: "code",
      language: (open[2] ?? "").toLowerCase(),
      source: lines.slice(index + 1, close).join("\n"),
    });
    index = close + 1;
  }

  pushProse(result, prose);

  return result;
}

function pushProse(result: Segment[], prose: string[]): void {
  const text = prose.join("\n").trim();

  if (text !== "") result.push({ kind: "prose", text });

  prose.length = 0;
}

function isClosing(line: string, marker: string): boolean {
  return line.startsWith(marker) && /^(`+|~+)$/.test(line);
}
