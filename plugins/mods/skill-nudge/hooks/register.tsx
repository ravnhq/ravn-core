import { atom, read, update } from "claude-code";
import type { EngineInterface, Register } from "claude-code";

import {
  SYSTEM,
  catalog,
  listing,
  parse,
  transcript,
  usedSkills,
} from "../lib/nudge.ts";
import {
  parseEvents,
  promptVersion,
  report,
  summarize,
} from "../lib/telemetry.ts";
import type { NudgeEvent, TipFate } from "../lib/telemetry.ts";

const COMMAND = "skill-nudge";

const ENABLED_KEY = "enabled";

const MODEL = "haiku";

const INSTALL_KEY = "installId";

// One store key per session, so concurrent sessions never overwrite each other's events.
const EVENTS_PREFIX = "events:";

const MAX_EVENTS_PER_SESSION = 500;

const MAX_SESSIONS = 50;

// Haiku judges at most once per this many finished turns.
const TURNS_BETWEEN_JUDGMENTS = 2;

const nudge = atom({ plugin: "skill-nudge", key: "nudge" } as const, null);

const offered = atom({ plugin: "skill-nudge", key: "offered" } as const, []);

const turnsSinceJudgment = atom(
  { plugin: "skill-nudge", key: "turnsSinceJudgment" } as const,
  0,
);

async function isEnabled($: EngineInterface): Promise<boolean> {
  return (await $.store.get(ENABLED_KEY)) !== false;
}

let isInteractive = false;

let isJudging = false;

// Bumped by each prompt, so a judgment that lands after the user moved on is dropped.
let epoch = 0;

// Appends run one at a time, so this session's events never overwrite each other.
let recording: Promise<void> = Promise.resolve();

function record($: EngineInterface, event: NudgeEvent): Promise<void> {
  recording = recording.then(() => append($, event)).catch(() => undefined);

  return recording;
}

async function append($: EngineInterface, event: NudgeEvent): Promise<void> {
  const key = EVENTS_PREFIX + (await $.session.id());
  const events = await eventsAt($, key);
  await $.store.set(
    key,
    JSON.stringify([...events, event].slice(-MAX_EVENTS_PER_SESSION)),
  );
}

async function eventsAt(
  $: EngineInterface,
  key: string,
): Promise<NudgeEvent[]> {
  return parseEvents(String((await $.store.get(key)) ?? "[]"));
}

async function fate(
  $: EngineInterface,
  type: TipFate["type"],
  skill: string,
): Promise<void> {
  await record($, {
    type,
    skill,
    at: await $.clock.now(),
    prompt: await promptVersion(SYSTEM),
  });
}

async function dismissTip($: EngineInterface, skill: string): Promise<void> {
  await update($, nudge, () => null);
  await fate($, "dismissed", skill);
}

async function prepareTelemetry($: EngineInterface): Promise<void> {
  if ((await $.store.get(INSTALL_KEY)) === undefined)
    await $.store.set(INSTALL_KEY, crypto.randomUUID());

  const sessions = (await $.store.keys()).filter((key) =>
    key.startsWith(EVENTS_PREFIX),
  );

  for (const key of sessions.slice(0, -MAX_SESSIONS)) await $.store.delete(key);
}

async function stats($: EngineInterface): Promise<string> {
  await recording;

  const keys = (await $.store.keys()).filter((key) =>
    key.startsWith(EVENTS_PREFIX),
  );

  const sessions: NudgeEvent[][] = [];

  for (const key of keys) sessions.push(await eventsAt($, key));

  const summary = summarize(String(await $.store.get(INSTALL_KEY)), sessions);
  const json = JSON.stringify(summary, null, 2);
  const { isCopied } = await $.ui.copy({ text: json });

  return `${report(summary)}\n\n${
    isCopied
      ? "Copied the JSON summary to the clipboard."
      : `JSON summary:\n${json}`
  }`;
}

async function judge($: EngineInterface, at: number): Promise<void> {
  const messages = await $.session.messages();

  const exclude = new Set([
    ...usedSkills(messages),
    ...(await read($, offered)),
  ]);

  const skills = catalog(await $.command.list(), exclude);

  if (skills.length === 0) return;

  const startedAt = await $.clock.now();

  const reply = await $.model.complete({
    model: MODEL,
    system: SYSTEM,
    prompt: [
      { text: listing(skills), cache: true },
      { text: transcript(messages) },
    ],
    maxTokens: 200,
    timeoutMs: 20000,
  });

  const now = await $.clock.now();
  const found = reply.isAnswered ? parse(reply.text, skills) : undefined;
  const isStale = at !== epoch;
  const shows = found !== undefined && !isStale;

  // The tip shows first; recording it never delays it.
  if (shows) {
    await update($, nudge, () => found);
    await update($, offered, (list) => [...list, found.skill]);
  }

  await record($, {
    type: "judged",
    at: now,
    prompt: await promptVersion(SYSTEM),
    outcome: reply.isAnswered
      ? isStale
        ? "stale"
        : found === undefined
          ? "none"
          : "nudge"
      : "error",
    skill: found?.skill ?? null,
    skills: skills.length,
    latencyMs: now - startedAt,
    inputTokens: reply.usage.input_tokens,
    outputTokens: reply.usage.output_tokens,
    cacheReadTokens: reply.usage.cache_read_input_tokens,
  });
}

export const register: Register = (on) => {
  // Each load starts fresh, as a reload's new environment does.
  isInteractive = false;
  isJudging = false;
  epoch = 0;
  recording = Promise.resolve();

  on("session.start", async ($, e, next) => {
    isInteractive = e.isInteractive;
    await $.command.register({
      name: COMMAND,
      description: "Turn skill nudges on or off; `stats` shows how tips fared",
      argumentHint: "[stats]",
    });
    await prepareTelemetry($).catch(() => undefined);

    return next(e);
  });

  on("command.run", { command: COMMAND }, async ($, e) => {
    if (e.args.trim() === "stats") return { text: await stats($) };

    const isOn = !(await isEnabled($));
    await $.store.set(ENABLED_KEY, isOn);
    const shown = await read($, nudge);

    if (!isOn && shown !== null) await dismissTip($, shown.skill);

    return { text: `Skill nudges ${isOn ? "on" : "off"}.` };
  });

  on("prompt.submit", async ($, e, next) => {
    epoch += 1;
    const shown = await read($, nudge);

    if (shown !== null) {
      await update($, nudge, () => null);
      const [command = ""] = e.text.trimStart().split(/\s/, 1);
      const typed = command === `/${shown.skill}`;
      await fate($, typed ? "typed" : "ignored", shown.skill);
    }

    return next(e);
  });

  on("turn.complete", async ($, e, next) => {
    const result = await next(e);

    if (e.agentId !== undefined || e.reason !== "answer" || !isInteractive)
      return result;

    const turns = (await read($, turnsSinceJudgment)) + 1;
    await update($, turnsSinceJudgment, () => turns);

    if (isJudging || turns < TURNS_BETWEEN_JUDGMENTS || !(await isEnabled($)))
      return result;

    isJudging = true;
    await update($, turnsSinceJudgment, () => 0);
    const at = epoch;
    $.clock.after(0, () => {
      void judge($, at)
        .catch(() => undefined)
        .finally(() => {
          isJudging = false;
        });
    });

    return result;
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const shown = await read($, nudge);

    if (shown === null || e.props.hasSurvey) return next(e);

    const { Box, Button, Text } = $.ui.resolve(e);

    const dismiss = () => dismissTip($, shown.skill);

    const use = async () => {
      // A draft the user already typed becomes the skill's arguments.
      const { text } = await $.prompt.read();
      await $.prompt.fill({ text: `/${shown.skill} ${text.trimStart()}` });
      await update($, nudge, () => null);
      await fate($, "used", shown.skill);
    };

    // Digit hotkeys, as a survey's: a bare digit in the empty prompt presses
    // them, while a letter works only after the person focuses the band.
    return (
      <Box flexDirection="column" padding={1}>
        <Text>
          <Text color="suggestion" bold>
            ✦ Skill tip
          </Text>
          <Text dimColor> · </Text>
          <Text bold>/{shown.skill}</Text>
        </Text>
        <Box paddingLeft={2} flexDirection="column">
          <Text>{shown.reason}</Text>
          <Box columnGap={2}>
            <Button key="use" label="Use" hotkey="1" plain onPress={use} />
            <Button
              key="dismiss"
              label="Dismiss"
              hotkey="2"
              plain
              role="dismiss"
              onPress={dismiss}
            />
          </Box>
        </Box>
      </Box>
    );
  });
};
