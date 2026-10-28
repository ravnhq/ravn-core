// What the guide bench asks Claude, and how it reads the answers back. Writers rewrite a reply or
// answer a task under a guide; a judge, which is never told which guide wrote what, lists a reply's
// must-know points, reads a skim, and grades text against a key. Every judge answer is read
// strictly: a wrong count or a word outside the expected set throws, so a confused judge becomes a
// failed call that a resume retries, never a grade. A run's manifest hashes this file, so a change
// to what Claude is asked is never mixed into a run begun before it.
import { stringsOf } from "./tasks.ts";
import type { Task } from "./tasks.ts";

export const REWRITE = (reply: string) =>
  `Below is a reply you wrote earlier in a coding session, before stretches existed. Rewrite it the way you would write it now, with stretches: keep every fact, step, command, file path, number and decision it contains, leave nothing out, and add nothing new. With every stretch open, the text must say everything the original says. Output only the rewritten reply, nothing before or after it.\n\n<reply>\n${reply}\n</reply>`;

export const POINTS = (reply: string) =>
  `Below is a reply from a coding assistant. List its must-know points for the person who asked: the main answer, decisions they must make, actions they must take, results they must know. At most eight, the most important first, each one short sentence. Output only JSON of the form {"points":["..."]}.\n\n<reply>\n${reply}\n</reply>`;

export const READ = (text: string) =>
  `You are reading a reply from a coding assistant in a terminal, and this is all you can see of it. Write down, as a short numbered list, the main answer, every decision you are asked to make, every action you are told to take, and every result you are told about. Output only the list.\n\n<reply>\n${text}\n</reply>`;

export const CHECK = (points: string[], notes: string) =>
  `Below are the must-know points of a reply, and the notes of a reader who saw some version of it. For each point, in order, judge whether the notes capture it: "yes", "partly" or "no". Output only JSON of the form {"verdicts":["yes","no"]}, one verdict per point.\n\n<points>\n${numbered(points)}\n</points>\n\n<notes>\n${notes}\n</notes>`;

export const LABELS = (skim: string, longs: string[]) =>
  `Below is a reply as a reader first sees it. Some phrases are marked ⟦n⟧…⟦/n⟧; a click on one replaces it with its long form, listed under the reply. Judge every marked phrase as it reads in its place, before any click:\n- "gist": it says something itself: a claim, an answer, a finding, a step, or a phrase that completes its sentence with real content. Read the surrounding visible words: in "The tests ⟦1⟧passed⟦/1⟧", the marked word is a gist. It need not be a standalone sentence.\n- "label": it only names or announces what its long form says, as a heading or a teaser does ("Details.", "What changed.", "Two options exist.", "The fix:"). A link consisting only of punctuation also has no content and is a label. Ordinary headings outside the marked phrases are not being graded.\nOutput only JSON of the form {"verdicts":{"1":"gist"}}, one entry per number.\n\n<reply>\n${skim}\n</reply>\n<long-forms>\n${longs.map((l, i) => `${i + 1}: ${l}`).join("\n")}\n</long-forms>`;

/** What a writer is asked for a task: its question with the evidence it may use, or its reply to rewrite, then any closing instruction. */
export function ANSWER(task: Task): string {
  const asked =
    task.kind === "rewrite"
      ? REWRITE(task.reply)
      : `I ran these in my project, on my machine, and pasted what they showed. That is all you know about the project; your own working folder is unrelated to it.\n\n<evidence>\n${task.evidence}\n</evidence>\n\n${task.question}`;
  return task.closing === undefined ? asked : `${asked}\n\n${task.closing}`;
}

export const KEY = (
  text: string,
  know: string[],
  never: string[],
  question?: string,
) =>
  `Below is a reply from a coding assistant, as much of it as a reader sees, then a list of points and a list of claims. Judge the visible answer in context of the original question when provided. The question resolves references; it cannot supply missing results or evidence. Do not fill gaps from the point or claim lists. A correct command or code can answer a question completely without prose explaining what it does.\n- For each point, in order: does the answer tell the reader this? "yes", "partly" or "no".\n- For each claim, in order: does the answer state it, or leave a reader believing it? "yes" or "no".\nOutput only JSON of the form {"know":["yes"],"never":["no"]}, one entry per point and per claim.\n\n${question === undefined ? "" : `<question>\n${question}\n</question>\n\n`}<text>\n${text}\n</text>\n\n<points>\n${numbered(know)}\n</points>\n\n<claims>\n${numbered(never)}\n</claims>`;

const numbered = (items: string[]) =>
  items.map((item, i) => `${i + 1}. ${item}`).join("\n");

/**
 * The arguments of one `claude -p` call: safe mode keeps the person's own CLAUDE.md files, skills and
 * plugins out, and no tools are offered, so the guide is the only instruction beyond Claude Code's own.
 */
export function claudeArgs(
  model: string,
  prompt: string,
  options: { system?: string; effort?: string },
): string[] {
  return [
    "-p",
    "--model",
    model,
    "--safe-mode",
    "--no-session-persistence",
    "--tools",
    "",
    "--output-format",
    "json",
    ...(options.effort === undefined ? [] : ["--effort", options.effort]),
    ...(options.system === undefined
      ? []
      : ["--append-system-prompt", options.system]),
    prompt,
  ];
}

export type Grade = "yes" | "partly" | "no";
export type Claim = "yes" | "no";
export type Label = "gist" | "label";

const GRADES: readonly Grade[] = ["yes", "partly", "no"];
const CLAIMS: readonly Claim[] = ["yes", "no"];
const LABEL_KINDS: readonly Label[] = ["gist", "label"];

/** A reply's must-know points: one to eight sentences. */
export const readPoints = (answer: string): string[] =>
  pointsOf(field(objectIn(answer), "points"));

/** Points as a judge gave them or a run saved them, held to the same shape. */
export function pointsOf(value: unknown): string[] {
  const points = stringsOf(value);
  if (
    points === undefined ||
    points.length === 0 ||
    points.length > 8 ||
    points.some((p) => p.trim() === "")
  )
    throw new Error("the judge gave no list of one to eight points");
  return points;
}

/** One grade per point, in order. */
export function readChecks(answer: string, points: number): Grade[] {
  return listOf(
    field(objectIn(answer), "verdicts"),
    GRADES,
    points,
    "verdicts",
  );
}

/** One grade per point the reader must learn, and one verdict per claim the text must not make. */
export function readKey(
  answer: string,
  know: number,
  never: number,
): { know: Grade[]; never: Claim[] } {
  const object = objectIn(answer);
  return {
    know: listOf(field(object, "know"), GRADES, know, "know"),
    never: listOf(field(object, "never"), CLAIMS, never, "never"),
  };
}

/** One verdict for each marked phrase, numbered from 1. */
export function readLabels(answer: string, phrases: number): Label[] {
  const verdicts = field(objectIn(answer), "verdicts");
  if (
    typeof verdicts !== "object" ||
    verdicts === null ||
    Array.isArray(verdicts) ||
    Object.keys(verdicts).length !== phrases
  ) {
    throw new Error(`the judge did not label exactly ${phrases} phrases`);
  }
  return Array.from({ length: phrases }, (_, i) => {
    const verdict: unknown = Reflect.get(verdicts, String(i + 1));
    const known = LABEL_KINDS.find((kind) => kind === verdict);
    if (known === undefined)
      throw new Error(
        `the judge labelled phrase ${i + 1} ${JSON.stringify(verdict)}`,
      );
    return known;
  });
}

/** Grades stored in a run's rows, read back as strictly as they were first read. */
export const gradesOf = (
  value: unknown,
  count: number,
  name: string,
): Grade[] => listOf(value, GRADES, count, name);
export const claimsOf = (
  value: unknown,
  count: number,
  name: string,
): Claim[] => listOf(value, CLAIMS, count, name);

/** The answer of a `claude -p --output-format json` run, and the models that wrote it. */
export function resultOf(stdout: string): { text: string; models: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error("Claude Code printed no JSON");
  }
  const events: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
  const result = events.find((event) => field(event, "type") === "result");
  const text = field(result, "result");
  if (
    field(result, "is_error") !== false ||
    typeof text !== "string" ||
    text.trim() === ""
  ) {
    throw new Error(
      typeof text === "string" && text !== ""
        ? (text.split("\n")[0] ?? text)
        : "no result",
    );
  }
  const models = new Set<string>();
  for (const event of events) {
    const model =
      field(field(event, "message"), "model") ??
      (field(event, "type") === "system" ? field(event, "model") : undefined);
    if (typeof model === "string") models.add(model);
  }
  const usage = field(result, "modelUsage");
  if (typeof usage === "object" && usage !== null)
    for (const model of Object.keys(usage)) models.add(model);
  if (models.size === 0) throw new Error("Claude Code named no model");

  return { text: text.trim(), models: [...models].sort() };
}

/** The JSON object a judge answered with, fenced or not. */
function objectIn(answer: string): unknown {
  const start = answer.indexOf("{");
  const end = answer.lastIndexOf("}");
  if (start === -1 || end < start)
    throw new Error("the judge gave no JSON object");
  try {
    return JSON.parse(answer.slice(start, end + 1));
  } catch {
    throw new Error("the judge gave malformed JSON");
  }
}

function field(value: unknown, name: string): unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? Reflect.get(value, name)
    : undefined;
}

function listOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  count: number,
  name: string,
): T[] {
  if (!Array.isArray(value) || value.length !== count)
    throw new Error(
      `the judge gave ${Array.isArray(value) ? value.length : "no"} ${name}, not ${count}`,
    );
  return value.map((item, i) => {
    const known = allowed.find((kind) => kind === item);
    if (known === undefined)
      throw new Error(
        `the judge's ${name} ${i + 1} is ${JSON.stringify(item)}, not ${allowed.join(", ")}`,
      );
    return known;
  });
}
