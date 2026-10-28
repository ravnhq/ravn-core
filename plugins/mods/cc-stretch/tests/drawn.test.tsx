import { describe, expect, test } from "claude-code/testing";
import type { Engine } from "claude-code/testing";

import { render } from "../bench/measure.ts";
import { parse, stretches } from "../hooks/parse.ts";

// The benchmark measures what the reader sees, so its skim must be the text the terminal draws.

const FULLSCREEN = { columns: 100, rows: 40, isFullscreen: true };

const mountReply = ($: Engine, text: string) =>
  $.ui.mount({
    plugin: "cc-stretch",
    surface: "terminal",
    component: "AssistantMessage",
    props: { text, isFirstOfReply: true },
    requestId: "reply",
    viewport: FULLSCREEN,
  });

/** The text a node shows, its children's strings joined. */
const textOf = (node: unknown): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && node !== null && "children" in node)
    return textOf(node.children);
  return "";
};

/** What the reply's first paragraph shows on screen, its rows joined and its spaces collapsed. */
const onScreen = async ($: Engine, text: string) => {
  const ui = await mountReply($, text);
  const tree = await ui.drawn({ in: "paragraph-0" });
  const children: unknown = "children" in tree ? tree.children : [];
  const rows = (
    Array.isArray(children) ? children.flat(Infinity) : [children]
  ).map(textOf);
  await ui.unmount();
  return rows.join(" ").replace(/\s+/g, " ").trim();
};
const collapsed = (text: string) => text.replace(/\s+/g, " ").trim();

describe("the benchmark skim", () => {
  for (const [name, text] of [
    [
      "a one-line stretch",
      "The build fails {{on a stale cache|on a stale cache keyed only by the manifest}}.",
    ],
    [
      "a short form over two lines",
      "Before {{the first line\nand the second|the long form the screen draws open}} after.",
    ],
    [
      "a short form over two lines with no long form",
      "Before {{the first line\nand the second|}} after.",
    ],
    [
      "a stretch with no long form",
      "Plain {{words only}} here, and {{a link|a link that opens}}.",
    ],
  ] as const) {
    test(`is what the screen draws: ${name}`, async ($) => {
      expect(collapsed(render(text, new Set()))).toBe(await onScreen($, text));
    });
  }

  // A key with a line break split the link's markup across rows, and laying it out never ended. The key
  // check runs first, so that fault fails this test instead of hanging the run.
  test("is what the screen draws for a stretch nested in a short form over two lines, whose key breaks no line", async ($) => {
    const text =
      "Before {{the first line\nand the second|the long {{form|form drawn}} open}} after.";
    expect(
      stretches(parse(text))
        .map((s) => s.key)
        .filter((key) => key.includes("\n")),
    ).toEqual([]);
    expect(collapsed(render(text, new Set()))).toBe(await onScreen($, text));
  });
});
