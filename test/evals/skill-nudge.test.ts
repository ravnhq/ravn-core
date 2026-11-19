import assert from "node:assert/strict";
import { test } from "node:test";
import { gradeReply } from "../../evals/skill-nudge/promptfooconfig.ts";

test("reasoning tokens cannot erase a complete suggestion within the visible limit", async () => {
  const reply = JSON.stringify({
    skill: "ravn-core:research",
    evidence: "U1",
    reason: "Check what other teams use before choosing.",
  });

  assert.ok(
    (
      await gradeReply(
        reply,
        "open-ended-approach",
        {
          completion: 250,
          completionDetails: { reasoning: 150 },
        },
        async () => '{"verdict":"keep"}',
      )
    ).pass,
  );
  assert.ok(
    !(await gradeReply(reply, "open-ended-approach", { completion: 250 })).pass,
  );
});

test("truncated or ungrounded replies cannot pass a stay-out case as abstentions", async () => {
  const quiet = "research-already-done";

  assert.ok(
    (await gradeReply('{"skill":null}', quiet, { completion: 5 })).pass,
  );
  assert.equal(
    (await gradeReply('{"skill":', quiet, { completion: 200 })).reason,
    "truncated",
  );
  assert.equal(
    (
      await gradeReply(
        JSON.stringify({
          skill: "ravn-core:why",
          reason: "Check the history.",
          evidence: "U99",
        }),
        quiet,
        { completion: 40 },
      )
    ).reason,
    "ungrounded",
  );
});

test("format and API errors from the reviewer aren't counted as correct silence", async () => {
  const reply = JSON.stringify({
    skill: "ravn-core:why",
    evidence: "U1",
    reason: "Check the history.",
  });

  const quiet = "research-already-done";

  assert.ok(
    (
      await gradeReply(
        reply,
        quiet,
        { completion: 30 },
        async () => '{"verdict":"already-done"}',
      )
    ).pass,
  );
  assert.ok(
    !(await gradeReply(reply, quiet, { completion: 30 }, async () => undefined))
      .pass,
  );
  assert.ok(
    !(await gradeReply(reply, quiet, { completion: 30 }, async () => "{}"))
      .pass,
  );
});
