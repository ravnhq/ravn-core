import { expect, test } from "claude-code/testing";
import type { Engine } from "claude-code/testing";

import { MAX_TOKENS } from "../lib/nudge.ts";
import { band, sessionStart, turn, world } from "./support.ts";

const stats = {
  command: "skill-nudge",
  args: "stats",
  origin: { kind: "composer" as const },
  presentation: { layout: "main" as const, isFullscreen: false, columns: 80 },
};

function reply(skill: string) {
  return JSON.stringify({
    skill,
    reason: "Now is a good time.",
    evidence: "U1",
  });
}

async function nudgeWith($: Engine, settle: () => Promise<void>, turns = 1) {
  for (let index = 0; index < turns; index += 1) await $.turn.complete(turn());
  await settle();
  await $.ui.render(band);
}

function submit(text: string) {
  return { text, wait: false, origin: { kind: "composer" as const } };
}

test("stats counts each tip's fate: used, typed, dismissed, ignored", async ($, on) => {
  const { clock, judged, setReply } = world(on);
  await $.session.start(sessionStart);

  setReply(reply("ravn-core:research"));
  await nudgeWith($, () => judged(1), 1);
  await $.ui.press({ plugin: "skill-nudge", key: "use" });

  setReply(reply("ravn-core:grilling"));
  await nudgeWith($, () => judged(2), 2);
  await $.ui.press({ plugin: "skill-nudge", key: "dismiss" });

  setReply(reply("deploy"));
  await nudgeWith($, () => judged(3), 2);
  await $.prompt.submit(submit("/deploy staging"));

  // Every test skill has now been offered, so no further judgment runs.
  await nudgeWith($, () => clock.settle(), 2);

  const result = await $.command.run(stats);
  const text = "text" in result ? String(result.text) : "";
  expect(text).toContain("Judgments: 3 (3 tips, 0 abstained");
  expect(text).toContain(
    "Tips: 3 shown, 2 taken (67%), 1 dismissed, 0 ignored",
  );
  expect(text).toContain("/ravn-core:research: shown 1, taken 1");
  expect(text).toContain("Copied the JSON summary");
});

test("a tip the user talks past counts as ignored", async ($, on) => {
  const { judged } = world(on, { reply: reply("ravn-core:research") });
  await $.session.start(sessionStart);
  await nudgeWith($, () => judged(1));
  await $.prompt.submit(submit("never mind, just fix the typo"));

  const result = await $.command.run(stats);
  expect("text" in result ? String(result.text) : "").toContain(
    "Tips: 1 shown, 0 taken (0%), 0 dismissed, 1 ignored",
  );
});

test("the copied summary carries outcomes and no conversation text", async ($, on) => {
  const { judged, copies } = world(on, {
    reply: JSON.stringify({
      skill: "ravn-core:research",
      reason: "Look into the acme-billing retry design.",
      evidence: "U1",
    }),
    messages: [
      { role: "user", text: "acme-billing secret roadmap", toolUses: [] },
      { role: "assistant", text: "I haven't checked it yet.", toolUses: [] },
    ],
  });

  await $.session.start(sessionStart);
  await nudgeWith($, () => judged(1));
  await $.command.run(stats);

  expect(copies.length).toBe(1);
  const copied = copies[0] ?? "";
  expect(copied).toContain('"installId"');
  expect(copied).toContain('"ravn-core:research"');
  expect(copied).not.toContain("acme-billing");
});

test("stats separates deliberate silence, invalid, ungrounded, truncated and late replies", async ($, on) => {
  const { judged, setReply, holdModel, clock, copies } = world(on);
  await $.session.start(sessionStart);
  await nudgeWith($, () => judged(1));

  setReply("not JSON");
  await nudgeWith($, () => judged(2));

  setReply(
    JSON.stringify({
      skill: "ravn-core:research",
      reason: "Run the check.",
      evidence: "A99",
    }),
  );
  await nudgeWith($, () => judged(3));

  setReply('{"skill": "ravn-core:', MAX_TOKENS);
  await nudgeWith($, () => judged(4));

  setReply(reply("ravn-core:research"));
  const release = holdModel();

  await $.turn.complete(turn());
  await clock.settle();
  await $.prompt.submit(submit("already moved on"));
  release();
  await judged(5);

  await $.command.run(stats);
  const summary = JSON.parse(copies[0] ?? "{}");
  expect(summary.judgments).toMatchObject({
    total: 5,
    abstained: 1,
    invalid: 1,
    ungrounded: 1,
    truncated: 1,
    stale: 1,
    nudge: 0,
  });
});
