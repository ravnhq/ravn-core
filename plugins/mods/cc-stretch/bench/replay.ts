// Replays real replies from ordinary coding sessions under cc-stretch: each sampled reply is
// rewritten by Claude with the plugin's guide, told to keep every fact and add nothing, and then
// measured. Short replies (under MIN_WORDS) need no stretches by the guide's own rule and are
// counted as they are, without a model call.
//   node bench/replay.ts --per-project 20 <~/.claude/projects/<dir>>... > bench/out/replay.jsonl
// Needs a signed-in `claude`. Raw text stays in bench/out/, which git ignores.
import { execFile } from "node:child_process";
import { readdirSync } from "node:fs";
import { promisify } from "node:util";
import { GUIDE } from "../hooks/guide.ts";
import { measure, render, words } from "./measure.ts";
import { turnsOf } from "./transcripts.ts";

const run = promisify(execFile);
const MIN_WORDS = 40;
const args = process.argv.slice(2);
const option = (name: string, fallback: number) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : Number(args.splice(at, 2)[1]);
};
const perProject = option("--per-project", 20);
const seed = option("--seed", 7);
const concurrency = option("--concurrency", 3);
const dirs = args;

/** A small seeded generator, so the same transcripts always give the same sample. */
function random(state: number) {
  return () => (state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

const PROMPT = (reply: string) =>
  `Below is a reply you wrote earlier in a coding session, before stretches existed. Rewrite it the way you would write it now, with stretches: keep every fact, step, command, file path, number and decision it contains, leave nothing out, and add nothing new. With every stretch open, the text must say everything the original says. Output only the rewritten reply, nothing before or after it.\n\n<reply>\n${reply}\n</reply>`;

async function rewrite(reply: string): Promise<string> {
  const { stdout } = await run(
    "claude",
    [
      "-p",
      "--model",
      "opus",
      "--setting-sources",
      "project,local",
      "--strict-mcp-config",
      "--no-session-persistence",
      "--tools",
      "",
      "--output-format",
      "json",
      "--append-system-prompt",
      GUIDE,
      PROMPT(reply),
    ],
    { maxBuffer: 1 << 26, timeout: 300000 },
  );
  // As of Claude Code 2.1.294, --output-format json prints the run's events; the answer is the result event.
  const events = JSON.parse(stdout) as { type?: string; result?: string }[];
  const result = events.find((e) => e.type === "result")?.result;
  if (typeof result !== "string")
    throw new Error("no result event in the claude output");
  return result.trim();
}

/** How many of the original's content words (four letters or more) the full rewrite still has. */
function recall(original: string, full: string): number {
  const bag = (text: string) =>
    new Set(text.toLowerCase().match(/[\p{L}\p{N}_'-]{4,}/gu) ?? []);
  const before = bag(original),
    after = bag(full);
  return before.size === 0
    ? 1
    : [...before].filter((w) => after.has(w)).length / before.size;
}

const jobs: (() => Promise<void>)[] = [];
for (const dir of dirs) {
  const project = dir.split("/").filter(Boolean).pop() ?? dir;
  const turns = readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .flatMap((f) => turnsOf(`${dir}/${f}`))
    .filter((t) => words(t.reply) > 0);
  // A seeded Fisher-Yates shuffle: every reply is equally likely to be sampled.
  const pick = random(seed);
  const shuffled = [...turns];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(pick() * (i + 1));
    const a = shuffled[i],
      b = shuffled[j];
    if (a !== undefined && b !== undefined) {
      shuffled[i] = b;
      shuffled[j] = a;
    }
  }
  const sample = shuffled.slice(0, perProject);
  for (const turn of sample) {
    jobs.push(async () => {
      const original = words(turn.reply);
      const row = {
        source: "replay",
        project,
        session: turn.session,
        turn: turn.index,
        original,
      };
      if (original < MIN_WORDS) {
        console.log(
          JSON.stringify({
            ...row,
            skim: original,
            full: original,
            rewritten: false,
            recall: 1,
          }),
        );
        return;
      }
      try {
        const text = await rewrite(turn.reply);
        const m = measure(text);
        console.log(
          JSON.stringify({
            ...row,
            ...m,
            rewritten: true,
            recall: recall(turn.reply, render(text, "all")),
            text,
          }),
        );
      } catch (error) {
        console.error(
          `skipped ${project} ${turn.session} #${turn.index}: ${(error as Error).message.split("\n")[0]}`,
        );
      }
    });
  }
}

let next = 0;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    for (let job = jobs[next++]; job !== undefined; job = jobs[next++])
      await job();
  }),
);
