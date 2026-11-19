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

test("asks Haiku after two answered turns and shows the skill above the prompt", async ($, on) => {
  const { clock, judged, requests } = world(on, { reply: RESEARCH });
  await $.session.start(sessionStart);

  await $.turn.complete(turn());
  await clock.settle();
  expect(requests.length).toBe(0);

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
  expect(drawn).toContain("ravn-core:research");
  expect(drawn).toContain("research what others did first");
});

test("draws nothing of its own when Haiku suggests no skill or an unlisted one", async ($, on) => {
  const { judged, requests, reviews, setReply } = world(on);
  await $.session.start(sessionStart);
  await finishTurns($, 2);
  await judged(1);
  expect(requests.length).toBe(1);
  expect(textOf(await $.ui.render(band))).toContain(STOCK_TEXT);

  setReply('{"skill": "made-up", "reason": "nope"}');
  await finishTurns($, 2);
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
        text: "There were two options. I compared both against three primary sources. A gateway limit fits this app.",
        toolUses: [],
      },
    ],
  });

  await $.session.start(sessionStart);
  setReview('{"verdict":"already-done"}');
  await finishTurns($, 2);
  await judged(1);
  expect(reviews.length).toBe(1);
  expect(reviews[0]!.prompt).toContain(
    "I compared both against three primary sources.",
  );
  expect(reviews[0]!.prompt).not.toContain("Deploy the app");
  expect(textOf(await $.ui.render(band))).toContain(STOCK_TEXT);

  // A rejected tip wasn't shown, so it isn't marked as offered.
  setReview('{"verdict":"keep"}');
  await finishTurns($, 2);
  await judged(2);
  expect(textOf(await $.ui.render(band))).toContain("ravn-core:research");
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

test("Use puts the skill ahead of the draft and clears the tip", async ($, on) => {
  const { judged, fills } = world(on, {
    reply: RESEARCH,
    draft: "auth options",
  });

  await $.session.start(sessionStart);
  await finishTurns($, 2);
  await judged(1);
  await $.ui.render(band);

  await $.ui.press({ plugin: "skill-nudge", key: "use" });
  expect(fills).toEqual(["/ravn-core:research auth options"]);
  expect(textOf(await $.ui.render(band))).toContain(STOCK_TEXT);
});

test("the tip answers a bare digit from the empty prompt, as a survey does", async ($, on) => {
  const { judged } = world(on, { reply: RESEARCH });
  await $.session.start(sessionStart);
  await finishTurns($, 2);
  await judged(1);

  const ui = await $.ui.mount({ plugin: "skill-nudge", ...band });
  expect((await ui.find({ key: "use" }))?.props).toMatchObject({
    hotkey: "1",
    plain: true,
  });
  expect((await ui.find({ key: "dismiss" }))?.props).toMatchObject({
    hotkey: "2",
    plain: true,
  });
  await ui.unmount();
});

test("a new prompt drops a judgment still in flight", async ($, on) => {
  const { clock, holdModel, judged } = world(on, { reply: RESEARCH });
  await $.session.start(sessionStart);
  const release = holdModel();
  await finishTurns($, 2);
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
  await finishTurns($, 2);
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
  await finishTurns($, 2);
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
  await finishTurns($, 2);
  await judged(1);
  expect(textOf(await $.ui.render(band))).toContain(STOCK_TEXT);

  setReply(
    JSON.stringify({
      skill: "research",
      reason: "Check the endpoint before drawing a conclusion.",
      evidence: "A1",
    }),
  );
  await finishTurns($, 2);
  await judged(2);
  expect(textOf(await $.ui.render(band))).toContain("Check the endpoint");
});

test("Use asks Claude to run a skill hidden from the / menu, as a user-invocable: false skill is", async ($, on) => {
  const { judged, fills } = world(on, { reply: RESEARCH, draft: "on auth" });
  await $.session.start(sessionStart);
  await $.command.describe(describe("ravn-core:research", true));
  await finishTurns($, 2);
  await judged(1);

  const drawn = textOf(await $.ui.render(band));
  expect(drawn).toContain("ravn-core:research");
  expect(drawn).not.toContain("/ravn-core:research");

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
