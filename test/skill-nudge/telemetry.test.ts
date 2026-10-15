import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseEvents,
  promptVersion,
  report,
  summarize,
} from "../../plugins/mods/skill-nudge/lib/telemetry.ts";
import type { NudgeEvent } from "../../plugins/mods/skill-nudge/lib/telemetry.ts";

const DAY = Date.UTC(2026, 9, 9);

function judged(
  outcome: "nudge" | "none" | "error" | "stale",
  skill: string | null = null,
  prompt = "aaaa0000",
): NudgeEvent {
  return {
    type: "judged",
    at: DAY,
    prompt,
    outcome,
    skill,
    skills: 25,
    latencyMs: 1000,
    inputTokens: 100,
    outputTokens: 10,
    cacheReadTokens: 50,
  };
}

test("summarize counts judgments, tip fates, and per-skill and per-prompt rates", () => {
  const sessionA: NudgeEvent[] = [
    judged("nudge", "ravn-core:research"),
    {
      type: "used",
      at: DAY + 1,
      prompt: "aaaa0000",
      skill: "ravn-core:research",
    },
    judged("none"),
    judged("nudge", "ravn-core:pr"),
    { type: "ignored", at: DAY + 2, prompt: "aaaa0000", skill: "ravn-core:pr" },
  ];

  const sessionB: NudgeEvent[] = [
    judged("nudge", "ravn-core:why", "bbbb1111"),
    { type: "typed", at: DAY + 3, prompt: "bbbb1111", skill: "ravn-core:why" },
    judged("error", null, "bbbb1111"),
    judged("stale", "ravn-core:how", "bbbb1111"),
  ];

  const summary = summarize("install-1", [sessionA, sessionB, []]);

  assert.equal(summary.sessions, 2);
  assert.deepEqual(summary.judgments, {
    total: 6,
    nudge: 3,
    none: 1,
    error: 1,
    stale: 1,
  });
  assert.deepEqual(summary.tips, {
    shown: 3,
    used: 1,
    typed: 1,
    dismissed: 0,
    ignored: 1,
  });
  assert.equal(summary.bySkill["ravn-core:pr"]?.ignored, 1);
  assert.equal(summary.bySkill["ravn-core:how"], undefined);
  assert.equal(summary.byPrompt.bbbb1111?.judged, 3);
  assert.equal(summary.byPrompt.bbbb1111?.typed, 1);
  assert.deepEqual(summary.tokens, { input: 600, output: 60, cacheRead: 300 });
  assert.equal(summary.averageLatencyMs, 1000);
  assert.equal(summary.from, "2026-10-09");
  assert.match(report(summary), /3 shown, 2 taken \(67%\)/);
});

test("summarize reports an empty history without dividing by zero", () => {
  const summary = summarize("install-1", []);

  assert.equal(summary.averageLatencyMs, 0);
  assert.equal(summary.from, null);
  assert.equal(report(summary), "Skill Nudge has not judged a turn yet.");
});

test("parseEvents round-trips stored events and drops malformed rows", () => {
  const events: NudgeEvent[] = [
    judged("nudge", "ravn-core:pr"),
    { type: "dismissed", at: DAY, prompt: "aaaa0000", skill: "ravn-core:pr" },
  ];

  const stored = JSON.stringify([
    ...events,
    { type: "used", at: DAY, prompt: "aaaa0000" },
    { type: "judged", at: "today", prompt: "aaaa0000", outcome: "none" },
    { ...judged("none"), outcome: "maybe" },
    "junk",
    null,
  ]);

  assert.deepEqual(parseEvents(stored), events);
  assert.deepEqual(parseEvents("not json"), []);
  assert.deepEqual(parseEvents('{"type":"used"}'), []);
});

test("promptVersion is stable and changes with the prompt", async () => {
  assert.equal(await promptVersion("a"), await promptVersion("a"));
  assert.notEqual(await promptVersion("a"), await promptVersion("b"));
  assert.match(await promptVersion("a"), /^[0-9a-f]{8}$/);
});
