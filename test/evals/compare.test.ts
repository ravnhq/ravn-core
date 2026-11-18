import assert from "node:assert/strict";
import { test } from "node:test";
import { skillEval, skillRequest } from "../../evals/skill-eval.ts";

test("compare renders the command each arm can handle and scores outcomes only", async () => {
  process.env.RAVN_EVALS_WORKSPACES = "/workspaces";
  process.env.RAVN_EVALS_HOME = "/home";
  process.env.RAVN_EVALS_RUNNER = "claude-code/claude-sonnet-5-5";

  const config = () =>
    skillEval("verification-skill", [
      {
        kind: "quality",
        fixture: "example",
        description: "creates a verification guide",
        invoked: true,
        request: "create a guide for the CLI",
        baselineInvocation: {
          skill: "create-verification-skill",
          request: "write a guide for the CLI",
        },
        references: ["verification-skill/references/create.md"],
        metric: "guide",
        rubric: "The guide drives the real CLI.",
      },
    ]);

  process.env.RAVN_EVALS_COMPARE = "0";
  const current = config().tests?.[0];
  assert.ok(current);
  assert.deepEqual(
    current.assert?.map(({ type }) => type),
    ["javascript", "llm-rubric"],
  );

  process.env.RAVN_EVALS_COMPARE = "1";
  const compare = config().tests?.[0];
  assert.ok(compare);
  assert.deepEqual(
    compare.assert?.map(({ type }) => type),
    ["llm-rubric"],
  );

  for (const [arm, expected] of [
    ["current", "/verification-skill create a guide for the CLI"],
    ["baseline", "/create-verification-skill write a guide for the CLI"],
    ["without-skill", "write a guide for the CLI"],
  ]) {
    const provider = {
      id: () => "test",
      callApi: async () => ({}),
      label: `example/${arm}/claude-code/model`,
    };

    assert.equal(
      await skillRequest({ provider, vars: compare.vars ?? {} }),
      expected,
    );
  }
});
