import { expect, test } from "claude-code/testing";
import type { Engine } from "claude-code/testing";

import {
  ACTIVE_MESSAGES,
  STOCK_TEXT,
  band,
  describe,
  sessionStart,
  textOf,
  turn,
  world,
} from "./support.ts";

const RESEARCH = JSON.stringify({
  skill: "ravn-core:research",
  reason: "You are weighing approaches; research what others did first.",
  evidence: "U1",
});

const toggle = {
  command: "skill-nudge",
  args: "",
  origin: { kind: "composer" as const },
  presentation: { layout: "main" as const, isFullscreen: false, columns: 80 },
};

async function finishTurns($: Engine, count: number) {
  for (let index = 0; index < count; index += 1) await $.turn.complete(turn());
}

test("asks Haiku on turn 1, shows the card above the prompt, and cools down for two turns after showing", async ($, on) => {
  const { clock, judged, requests } = world(on, { reply: RESEARCH });
  await $.session.start(sessionStart);

  await $.turn.complete(turn());
  await judged(1);
  expect(requests.length).toBe(1);
  expect(requests[0]!.model).toBe("haiku");

  const listed = requests[0]!.prompt;
  expect(listed).toContain("ravn-core:research");
  expect(listed).toContain("deploy");
  expect(listed).not.toContain("- clear:");
  expect(listed).not.toContain("linear:issue");
  expect(listed).not.toContain("- skill-nudge:");

  const drawn = textOf(await $.ui.render(band));
  expect(drawn).toContain("/research");
  expect(drawn).toContain("research what others did first");

  // Cooldown: one turn after showing a tip does not judge again yet.
  await $.turn.complete(turn());
  await clock.settle();
  expect(requests.length).toBe(1);
});

test("draws nothing of its own when Haiku suggests no skill or an unlisted one, and keeps judging on the next turn", async ($, on) => {
  const { judged, requests, reviews, setReply } = world(on);
  await $.session.start(sessionStart);
  await $.turn.complete(turn());
  await judged(1);
  expect(requests.length).toBe(1);
  expect(textOf(await $.ui.render(band))).toContain(STOCK_TEXT);

  setReply('{"skill": "made-up", "reason": "nope"}');
  await $.turn.complete(turn());
  await judged(2);
  expect(requests.length).toBe(2);
  expect(reviews.length).toBe(0);
  expect(textOf(await $.ui.render(band))).toContain(STOCK_TEXT);
});

test("a proposed tip is checked against the whole answer before it can show", async ($, on) => {
  const { judged, reviews, setReview } = world(on, {
    reply: RESEARCH,
    messages: [
      ...ACTIVE_MESSAGES.slice(0, 1),
      {
        role: "assistant",
        text: `There were two options. ${"Comparison detail. ".repeat(100)}I compared both against three primary sources. A gateway limit fits this app.`,
        toolUses: [],
      },
    ],
  });

  await $.session.start(sessionStart);
  setReview('{"verdict":"already-done"}');
  await $.turn.complete(turn());
  await judged(1);
  expect(reviews.length).toBe(1);
  expect(reviews[0]!.prompt).toContain(
    "I compared both against three primary sources.",
  );
  expect(reviews[0]!.prompt).not.toContain("Deploy the app");
  expect(textOf(await $.ui.render(band))).toContain(STOCK_TEXT);

  // A rejected tip wasn't shown, so it isn't marked as offered and doesn't trigger cooldown.
  setReview('{"verdict":"keep"}');
  await $.turn.complete(turn());
  await judged(2);
  expect(textOf(await $.ui.render(band))).toContain("/research");
});

test("stays quiet in a non-interactive session", async ($, on) => {
  const { clock, requests } = world(on, { reply: RESEARCH });
  await $.session.start({ ...sessionStart, isInteractive: false });
  await finishTurns($, 3);
  await clock.settle();
  expect(requests.length).toBe(0);
});

test("ignores subagent and interrupted turns", async ($, on) => {
  const { clock, requests } = world(on, { reply: RESEARCH });
  await $.session.start(sessionStart);
  await $.turn.complete(turn({ agentId: "agent-1" }));
  await $.turn.complete(turn({ reason: "aborted" }));
  await $.turn.complete(turn({ agentId: "agent-2" }));
  await clock.settle();
  expect(requests.length).toBe(0);
});

test("Use prefills suggested args when the prompt is empty and preserves a draft otherwise", async ($, on) => {
  const withArgs = JSON.stringify({
    skill: "ravn-core:research",
    reason: "Compare rate-limiting approaches before building.",
    args: "rate limiting approaches for public APIs",
    evidence: "U1",
  });

  const { judged, fills } = world(on, { reply: withArgs });
  await $.session.start(sessionStart);
  await $.turn.complete(turn());
  await judged(1);
  await $.ui.render(band);

  await $.ui.press({ plugin: "skill-nudge", key: "use" });
  expect(fills).toEqual([
    "/ravn-core:research rate limiting approaches for public APIs",
  ]);
  expect(textOf(await $.ui.render(band))).toContain(STOCK_TEXT);
});

test("Use puts the skill ahead of the draft and clears the tip", async ($, on) => {
  const { judged, fills } = world(on, {
    reply: JSON.stringify({
      skill: "ravn-core:research",
      reason: "Compare approaches first.",
      args: "ignored because user typed a draft",
      evidence: "U1",
    }),
    draft: "auth options",
  });

  await $.session.start(sessionStart);
  await $.turn.complete(turn());
  await judged(1);
  await $.ui.render(band);

  await $.ui.press({ plugin: "skill-nudge", key: "use" });
  expect(fills).toEqual(["/ravn-core:research auth options"]);
  expect(textOf(await $.ui.render(band))).toContain(STOCK_TEXT);
});

test("the tip answers bare digits from the empty prompt, including Mute skill", async ($, on) => {
  const { judged } = world(on, { reply: RESEARCH });
  await $.session.start(sessionStart);
  await $.turn.complete(turn());
  await judged(1);

  const ui = await $.ui.mount({ plugin: "skill-nudge", ...band });
  expect((await ui.find({ key: "use" }))?.props).toMatchObject({
    hotkey: "1",
    label: "Use /research",
    plain: true,
  });
  expect((await ui.find({ key: "dismiss" }))?.props).toMatchObject({
    hotkey: "2",
    plain: true,
  });
  expect((await ui.find({ key: "mute" }))?.props).toMatchObject({
    hotkey: "3",
    plain: true,
  });
  await ui.unmount();
});

test("Mute persists across sessions and /skill-nudge unmute restores muted skills", async ($, on) => {
  const { judged, requests } = world(on, { reply: RESEARCH });
  await $.session.start(sessionStart);
  await $.turn.complete(turn());
  await judged(1);
  await $.ui.render(band);
  await $.ui.press({ plugin: "skill-nudge", key: "mute" });

  // Wait out cooldown; research is now muted so Haiku's catalog excludes it.
  await finishTurns($, 2);
  await judged(2);
  expect(requests[1]!.prompt).not.toContain("ravn-core:research:");

  const unmuted = await $.command.run({ ...toggle, args: "unmute" });
  expect(unmuted).toEqual({ text: "Unmuted 1 skill." });
  const again = await $.command.run({ ...toggle, args: "unmute" });
  expect(again).toEqual({ text: "No muted skills." });
});

test("falls back to a toast on surfaces where AbovePrompt does not draw", async ($, on) => {
  const { judged, toasts } = world(on, { reply: RESEARCH });
  await $.session.start({ ...sessionStart, surface: "vscode" });
  await $.turn.complete(turn());
  await judged(1);
  expect(toasts.length).toBe(1);
  expect(toasts[0]).toContain("/research");
});

test("a new prompt drops a judgment still in flight", async ($, on) => {
  const { clock, holdModel, judged } = world(on, { reply: RESEARCH });
  await $.session.start(sessionStart);
  const release = holdModel();
  await $.turn.complete(turn());
  await clock.settle();

  await $.prompt.submit({
    text: "something else",
    wait: false,
    origin: { kind: "composer" },
  });
  release();
  await judged(1);
  expect(textOf(await $.ui.render(band))).toContain(STOCK_TEXT);
});

test("never offers the same skill twice, nor one the session already ran", async ($, on) => {
  const { clock, judged, requests } = world(on, {
    reply: RESEARCH,
    messages: [
      {
        role: "assistant",
        text: "",
        toolUses: [
          {
            tool_use_id: "toolu_1",
            tool: "Skill",
            input: { skill: "ravn-core:grilling" },
          },
        ],
      },
      { role: "user", text: "/deploy staging", toolUses: [] },
      ...ACTIVE_MESSAGES,
    ],
  });

  await $.session.start(sessionStart);
  await $.turn.complete(turn());
  await judged(1);
  expect(requests[0]!.prompt).not.toContain("ravn-core:grilling:");
  expect(requests[0]!.prompt).not.toContain("- deploy:");

  await $.ui.render(band);
  await $.ui.press({ plugin: "skill-nudge", key: "dismiss" });
  expect(textOf(await $.ui.render(band))).toContain(STOCK_TEXT);
  await finishTurns($, 2);
  await clock.settle();
  // research was offered; nothing else is left, so Haiku is not asked again.
  expect(requests.length).toBe(1);
});

test("a reply that drops the plugin prefix still names the one listed skill", async ($, on) => {
  const { judged, fills } = world(on, {
    reply: JSON.stringify({
      skill: "research",
      reason: "You are weighing approaches.",
      evidence: "U1",
    }),
  });

  await $.session.start(sessionStart);
  await $.turn.complete(turn());
  await judged(1);
  await $.ui.render(band);
  await $.ui.press({ plugin: "skill-nudge", key: "use" });
  expect(fills).toEqual(["/ravn-core:research "]);
});

test("a tip must name an evidence ID supplied for the latest exchange", async ($, on) => {
  const { judged, setReply } = world(on, {
    reply: JSON.stringify({
      skill: "research",
      reason: "Check what other teams did.",
      evidence: "What do other teams do about rate limiting?",
    }),
    messages: [
      ...ACTIVE_MESSAGES,
      {
        role: "user",
        text: "Can you reproduce the failure now?",
        toolUses: [],
      },
      {
        role: "assistant",
        text: "I can check, but haven't run the endpoint.",
        toolUses: [],
      },
    ],
  });

  await $.session.start(sessionStart);
  await $.turn.complete(turn());
  await judged(1);
  expect(textOf(await $.ui.render(band))).toContain(STOCK_TEXT);

  setReply(
    JSON.stringify({
      skill: "research",
      reason: "Check the endpoint before drawing a conclusion.",
      evidence: "A1",
    }),
  );
  await $.turn.complete(turn());
  await judged(2);
  expect(textOf(await $.ui.render(band))).toContain("Check the endpoint");
});

test("Use asks Claude to run a skill hidden from the / menu, as a user-invocable: false skill is", async ($, on) => {
  const { judged, fills } = world(on, { reply: RESEARCH, draft: "on auth" });
  await $.session.start(sessionStart);
  await $.command.describe(describe("ravn-core:research", true));
  await $.turn.complete(turn());
  await judged(1);

  const drawn = textOf(await $.ui.render(band));
  expect(drawn).toContain("research");
  expect(drawn).not.toContain("/research");

  await $.ui.press({ plugin: "skill-nudge", key: "use" });
  expect(fills).toEqual(["Use the ravn-core:research skill. on auth"]);
});

test("/skill-nudge turns judging off and back on, saved in the store", async ($, on) => {
  const { clock, judged, requests } = world(on, { reply: RESEARCH });
  await $.session.start(sessionStart);
  const off = await $.command.run(toggle);
  expect(off).toEqual({ text: "Skill nudges off." });

  await finishTurns($, 3);
  await clock.settle();
  expect(requests.length).toBe(0);

  const back = await $.command.run(toggle);
  expect(back).toEqual({ text: "Skill nudges on." });
  await $.turn.complete(turn());
  await judged(1);
  expect(requests.length).toBe(1);
});
