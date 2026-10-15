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

// The band wraps long text; this cap only stops a runaway reply.
const REASON_CHARS = 300;

export const SYSTEM = `You watch a Claude Code session from the side. After each turn you decide whether the user should run one of their installed skills next, and which one.

Each skill's description says what situations it is for ("Use when...", "Apply when..."). Match the situation in the latest exchange to those descriptions, not just the topic.

Suggest a skill when:
- the user's goal is what a skill is for, and the assistant answered without that skill's process: it guessed, gave a quick summary, or proposed a shortcut;
- the work just done calls for a check that a skill provides, and the assistant has not done that check;
- the user is about to start, plan, pause, resume, hand off, or ship work, and a skill covers that step.

Suggest nothing when:
- the turn was small talk, a trivial edit, or a complete self-contained answer;
- the assistant already did what the skill would do: ran it, verified against the real artifact, or wrote and ran the regression test;
- the assistant is mid-task and simply continuing.

Pick the single most specific skill.

Reply with one JSON object and nothing else:
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

  return `Recent conversation, oldest first:\n${lines.join("\n\n")}`;
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

  if (!skills.some((one) => one.name === skill)) return undefined;

  return { skill, reason: clip(reason.trim(), REASON_CHARS) };
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
