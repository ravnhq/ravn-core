import { expect, test } from "claude-code/testing";
import type { Engine } from "claude-code/testing";

import {
  STOCK_TEXT,
  band,
  sessionStart,
  textOf,
  turn,
  world,
} from "./support.ts";

const RESEARCH =
  '{"skill": "ravn-core:research", "reason": "You are weighing approaches; research what others did first."}';

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
  const { judged, requests, setReply } = world(on);
  await $.session.start(sessionStart);
  await finishTurns($, 2);
  await judged(1);
  expect(requests.length).toBe(1);
  expect(textOf(await $.ui.render(band))).toContain(STOCK_TEXT);

  setReply('{"skill": "made-up", "reason": "nope"}');
  await finishTurns($, 2);
  await judged(2);
  expect(requests.length).toBe(2);
  expect(textOf(await $.ui.render(band))).toContain(STOCK_TEXT);
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

test("a new prompt clears the tip and drops a judgment still in flight", async ($, on) => {
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
