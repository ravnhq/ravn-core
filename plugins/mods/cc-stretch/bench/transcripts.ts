// Reads Claude Code session transcripts (the JSONL files under ~/.claude/projects, as written by
// Claude Code 2.1.29x) into turns: the person's prompt, the reply they read, and the reading note
// cc-stretch attached to their next prompt, if any.
import { readFileSync } from "node:fs";
import { openedFrom } from "./measure.ts";
import { shortsNamed } from "./opened.ts";

export type Turn = {
  session: string;
  index: number;
  prompt: string;
  /** The text after the turn's last tool call: what the person reads as the answer. */
  reply: string;
  /**
   * Short forms the reader opened, from the note on the next prompt, beside the names it gives stretches
   * with no words of their own (bench/opened.ts); undefined when there was none.
   */
  opened?: Set<string>;
};

type Block = { type?: string; text?: string };
type Row = {
  type?: string;
  isMeta?: boolean;
  /** Set on newer transcripts: `human` for a prompt the person typed. */
  origin?: { kind?: string };
  message?: { role?: string; content?: string | Block[] };
  attachment?: { type?: string; content?: unknown };
};

const textOf = (content: string | Block[] | undefined) =>
  typeof content === "string"
    ? content
    : (content ?? [])
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n");

/**
 * A prompt the person typed. Newer transcripts say so in `origin`; older ones are judged by
 * content: not a tool result, a reminder, a command's echo, a skill's text or a notification.
 */
function isPrompt(row: Row): boolean {
  if (row.type !== "user" || row.isMeta || row.message?.role !== "user")
    return false;
  if (row.origin !== undefined) return row.origin.kind === "human";
  const content = row.message.content;
  if (Array.isArray(content) && content.some((b) => b.type === "tool_result"))
    return false;
  const text = textOf(content).trim();
  return (
    text !== "" &&
    !/^(<|Base directory for this skill|\[Image|Caveat:|This session is being continued)/.test(
      text,
    )
  );
}

export function turnsOf(path: string): Turn[] {
  const rows: Row[] = readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const session = path.split("/").pop()?.replace(".jsonl", "") ?? path;
  const turns: Turn[] = [];
  let current: { prompt: string; texts: string[] } | null = null;
  const close = () => {
    if (current && current.texts.length > 0) {
      turns.push({
        session,
        index: turns.length,
        prompt: current.prompt,
        reply: current.texts.join("\n\n").trim(),
      });
    }
  };
  for (const row of rows) {
    if (isPrompt(row)) {
      close();
      current = { prompt: textOf(row.message?.content).trim(), texts: [] };
      continue;
    }
    const note =
      row.type === "attachment" &&
      row.attachment?.type === "hook_additional_context"
        ? JSON.stringify(row.attachment.content)
        : "";
    const last = turns.at(-1);
    if (note.includes("Stretchtext:") && last !== undefined) {
      const text = JSON.parse(
        `"${/Stretchtext:[^"\\]*(?:\\.[^"\\]*)*/.exec(note)?.[0] ?? ""}"`,
      ) as string;
      last.opened = shortsNamed(last.reply, openedFrom(text));
      continue;
    }
    if (!current || row.type !== "assistant") continue;
    const content = row.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      // A tool call starts the reply over: only the text after the last one is the answer.
      if (block.type === "tool_use") current.texts = [];
      else if (block.type === "text" && (block.text ?? "").trim() !== "")
        current.texts.push(block.text ?? "");
    }
  }
  close();
  return turns;
}
