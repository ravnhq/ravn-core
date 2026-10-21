// Structural types, not the `claude-code` ones, so evals/skill-nudge can run this
// prompt code under plain Node.
export type Command = {
  name: string;
  description: string;
  source: string;
  plugin?: string;
};

export type Message = {
  role: "user" | "assistant";
  text: string;
  toolUses: readonly { tool: string; input: { skill?: unknown } }[];
};

export type Skill = { name: string; description: string };

export type Suggestion = { skill: string; reason: string };

type Json = null | boolean | number | string | Json[] | JsonObject;

type JsonObject = { [key: string]: Json };

const RECENT_MESSAGES = 8;

const MESSAGE_CHARS = 1500;

// Haiku's reply cap; the eval sends the same, so a reply cut short there is cut short here.
export const MAX_TOKENS = 200;

// The band wraps long text; this cap only stops a runaway reply.
const REASON_CHARS = 300;

// The format rule closes the transcript too: Haiku follows what it read last.
const REPLY_FORMAT =
  "Reply with exactly one JSON object: no code fence, and no text before or after it.";

export const SYSTEM = `You watch a Claude Code session from the side. After each turn you decide whether the user should run one of their installed skills next, and which one. You are not in the conversation: never answer the user, continue the work, or explain your choice.

Each skill's description says what situations it is for ("Use when...", "Apply when..."). Match the situation in the latest exchange to those descriptions, not just the topic.

First check whether to suggest nothing. Suggest nothing when:
- the turn was small talk, a trivial edit, or a complete self-contained answer;
- the assistant already did what the skill would do: ran it, verified against the real artifact, or wrote and ran the regression test (a test that was run, or output checked against real data, is that check);
- the assistant is mid-task and simply continuing: it reports progress and names its next step, without asking the user anything.

Otherwise, suggest a skill when:
- the user's goal is what a skill is for, and the assistant answered without that skill's process: it guessed, gave a quick summary, or proposed a shortcut;
- the work just done calls for a check that a skill provides, and the assistant has not done that check;
- the user is about to start, plan, pause, resume, hand off, or ship work, and a skill covers that step;
- the assistant made, or is about to make, a mistake that a principle skill ("Apply when...") names.

Choosing between skills:
- Prefer a principle skill that names the assistant's specific mistake over a broad workflow skill that covers the same topic.
- A description that assumes something exists ("the supplied PR", "a handoff note") fits only once the session has it; before that, pick the skill that creates it.
- Match whose knowledge the question needs. Why this repo chose something is in its own history; what other teams or the wider field do needs outside sources.
- Tests of the changed code do not check the code that calls it.

Pick the single most specific skill.

${REPLY_FORMAT}
{"skill": "<a name exactly as listed>", "reason": "<one short sentence to the user, under 120 characters, saying why now; address them as \\"you\\", never as \\"the user\\">"}
or, when nothing fits:
{"skill": null}`;

/** The user's own skills: plugin and user slash commands, less the ones already used or offered. */
export function catalog(
  commands: readonly Command[],
  exclude: ReadonlySet<string>,
): Skill[] {
  return commands.flatMap(({ name, description, source, plugin }) =>
    (source === "plugin" || source === "user") &&
    plugin !== "skill-nudge" &&
    !exclude.has(name)
      ? [{ name, description }]
      : [],
  );
}

/** Skills the session already ran, by the Skill tool or typed as `/name`. */
export function usedSkills(messages: readonly Message[]): Set<string> {
  const used = new Set<string>();

  for (const message of messages) {
    for (const call of message.toolUses) {
      const skill = call.tool === "Skill" ? String(call.input.skill ?? "") : "";

      if (skill) used.add(skill);
    }

    const typed = /^\/([\w:-]+)/.exec(message.text.trimStart());

    if (message.role === "user" && typed) used.add(typed[1]!);
  }

  return used;
}

export function listing(skills: readonly Skill[]): string {
  const lines = skills.map(
    ({ name, description }) => `- ${name}: ${description}`,
  );

  return `Installed skills:\n${lines.join("\n")}\n\n`;
}

export function transcript(messages: readonly Message[]): string {
  const lines = messages.slice(-RECENT_MESSAGES).map((message) => {
    const tools = message.toolUses.map((call) => call.tool);
    const text = clip(message.text.trim(), MESSAGE_CHARS);
    const used = tools.length > 0 ? ` [tools: ${tools.join(", ")}]` : "";

    return `${message.role}: ${text}${used}`;
  });

  return `Recent conversation, oldest first:\n${lines.join("\n\n")}\n\n${REPLY_FORMAT}`;
}

/** Reads the model's reply; anything but a listed skill with a reason is no nudge. */
export function parse(
  reply: string,
  skills: readonly Skill[],
): Suggestion | undefined {
  const source = /\{[\s\S]*\}/.exec(reply)?.[0];

  if (source === undefined) return undefined;

  let value: Json;

  try {
    value = JSON.parse(source);
  } catch {
    return undefined;
  }

  if (!isJsonObject(value)) return undefined;

  const { skill, reason } = value;

  if (!isString(skill) || !isString(reason) || reason.trim() === "")
    return undefined;

  const listed = listedName(skill, skills);

  if (listed === undefined) return undefined;

  return { skill: listed, reason: clip(reason.trim(), REASON_CHARS) };
}

// Haiku sometimes drops a plugin prefix; a bare name counts when one listed skill ends with it.
function listedName(
  name: string,
  skills: readonly Skill[],
): string | undefined {
  if (skills.some((one) => one.name === name)) return name;

  const matches = skills.filter((one) => one.name.endsWith(`:${name}`));

  return matches.length === 1 ? matches[0]!.name : undefined;
}

function isJsonObject(value: Json | undefined): value is JsonObject {
  return value === Object(value) && !Array.isArray(value);
}

function isString(value: Json | undefined): value is string {
  return value === String(value);
}

function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}
