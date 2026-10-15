// Outcome events, kept on the user's machine. They hold no conversation text and
// no Haiku reason: only what happened, which skill, and what it cost.

export type Judgment = {
  type: "judged";
  at: number;
  prompt: string;
  // `stale`: Haiku answered after the user had already sent another prompt.
  outcome: "nudge" | "none" | "error" | "stale";
  skill: string | null;
  skills: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
};

export type TipFate = {
  // `typed`: the user ran the suggested skill without pressing Use.
  type: "used" | "typed" | "dismissed" | "ignored";
  at: number;
  prompt: string;
  skill: string;
};

export type NudgeEvent = Judgment | TipFate;

type Fates = {
  shown: number;
  used: number;
  typed: number;
  dismissed: number;
  ignored: number;
};

export type Summary = {
  installId: string;
  sessions: number;
  from: string | null;
  to: string | null;
  judgments: { total: number } & Record<Judgment["outcome"], number>;
  averageLatencyMs: number;
  tokens: { input: number; output: number; cacheRead: number };
  tips: Fates;
  bySkill: Record<string, Fates>;
  byPrompt: Record<string, Fates & { judged: number }>;
};

const emptyFates = (): Fates => ({
  shown: 0,
  used: 0,
  typed: 0,
  dismissed: 0,
  ignored: 0,
});

type Json = null | boolean | number | string | Json[] | JsonObject;

type JsonObject = { [key: string]: Json };

const OUTCOMES = ["nudge", "none", "error", "stale"] as const;

const FATES = ["used", "typed", "dismissed", "ignored"] as const;

/** Reads a session's stored events, keeping only well-formed ones. */
export function parseEvents(text: string): NudgeEvent[] {
  let value: Json;

  try {
    value = JSON.parse(text);
  } catch {
    return [];
  }

  return Array.isArray(value) ? value.flatMap(eventOf) : [];
}

function eventOf(value: Json): NudgeEvent[] {
  if (!isJsonObject(value)) return [];

  const row = value;
  const { type, at, prompt, skill } = row;

  if (!isNumber(at) || !isString(prompt)) return [];

  if (type === "judged") {
    const outcome = OUTCOMES.find((one) => one === row.outcome);

    const numbers = [
      row.skills,
      row.latencyMs,
      row.inputTokens,
      row.outputTokens,
      row.cacheReadTokens,
    ];

    if (outcome === undefined || !numbers.every(isNumber)) return [];

    return [
      {
        type,
        at,
        prompt,
        outcome,
        skill: isString(skill) ? skill : null,
        skills: Number(row.skills),
        latencyMs: Number(row.latencyMs),
        inputTokens: Number(row.inputTokens),
        outputTokens: Number(row.outputTokens),
        cacheReadTokens: Number(row.cacheReadTokens),
      },
    ];
  }

  const fate = FATES.find((one) => one === type);

  return fate !== undefined && isString(skill)
    ? [{ type: fate, at, prompt, skill }]
    : [];
}

function isJsonObject(value: Json): value is JsonObject {
  return value === Object(value) && !Array.isArray(value);
}

function isNumber(value: Json | undefined): value is number {
  return Number.isFinite(value);
}

function isString(value: Json | undefined): value is string {
  return value === String(value);
}

/** A short, stable name for a system prompt, so results compare across prompt changes. */
export async function promptVersion(system: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(system),
  );

  return [...new Uint8Array(digest).slice(0, 4)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function summarize(
  installId: string,
  sessions: readonly (readonly NudgeEvent[])[],
): Summary {
  const events = sessions.flat().sort((a, b) => a.at - b.at);
  const judgments = { total: 0, nudge: 0, none: 0, error: 0, stale: 0 };
  const tokens = { input: 0, output: 0, cacheRead: 0 };
  const tips = emptyFates();
  const bySkill: Record<string, Fates> = {};
  const byPrompt: Record<string, Fates & { judged: number }> = {};
  let latency = 0;

  for (const event of events) {
    const prompt = (byPrompt[event.prompt] ??= { judged: 0, ...emptyFates() });

    if (event.type === "judged") {
      judgments.total += 1;
      judgments[event.outcome] += 1;
      prompt.judged += 1;
      latency += event.latencyMs;
      tokens.input += event.inputTokens;
      tokens.output += event.outputTokens;
      tokens.cacheRead += event.cacheReadTokens;

      if (event.outcome !== "nudge" || event.skill === null) continue;

      tips.shown += 1;
      prompt.shown += 1;
      (bySkill[event.skill] ??= emptyFates()).shown += 1;
      continue;
    }

    tips[event.type] += 1;
    prompt[event.type] += 1;
    (bySkill[event.skill] ??= emptyFates())[event.type] += 1;
  }

  return {
    installId,
    sessions: sessions.filter((one) => one.length > 0).length,
    from: dateOf(events.at(0)),
    to: dateOf(events.at(-1)),
    judgments,
    averageLatencyMs:
      judgments.total === 0 ? 0 : Math.round(latency / judgments.total),
    tokens,
    tips,
    bySkill,
    byPrompt,
  };
}

export function report(summary: Summary): string {
  const { judgments, tips } = summary;

  if (judgments.total === 0) return "Skill Nudge has not judged a turn yet.";

  const taken = tips.used + tips.typed;

  const skills = Object.entries(summary.bySkill)
    .sort(([, a], [, b]) => b.shown - a.shown)
    .map(
      ([skill, fates]) =>
        `  /${skill}: shown ${fates.shown}, taken ${fates.used + fates.typed}, dismissed ${fates.dismissed}, ignored ${fates.ignored}`,
    );

  return [
    `Skill Nudge, ${summary.from} to ${summary.to} (${summary.sessions} sessions)`,
    `Judgments: ${judgments.total} (${judgments.nudge} tips, ${judgments.none} quiet, ${judgments.error} errors, ${judgments.stale} too late), ${summary.averageLatencyMs} ms average`,
    `Tips: ${tips.shown} shown, ${taken} taken (${percent(taken, tips.shown)}), ${tips.dismissed} dismissed, ${tips.ignored} ignored`,
    ...skills,
  ].join("\n");
}

function dateOf(event: NudgeEvent | undefined): string | null {
  return event === undefined
    ? null
    : new Date(event.at).toISOString().slice(0, 10);
}

function percent(part: number, whole: number): string {
  return whole === 0 ? "0%" : `${Math.round((part / whole) * 100)}%`;
}
