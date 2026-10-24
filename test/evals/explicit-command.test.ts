import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import {
  grader,
  runnerName,
  runners,
  skillEval,
} from "../../evals/skill-eval.ts";

test("explicit triggers use semantic acceptance grading on every runner", (t) => {
  const names = [
    "RAVN_EVALS_WORKSPACES",
    "RAVN_EVALS_HOME",
    "OPENROUTER_API_KEY",
    "CURSOR_API_KEY",
    "RAVN_EVALS_RUNNER",
  ];

  const previous = names.map((name) => process.env[name]);
  t.after(() => {
    for (const [index, name] of names.entries()) {
      const value = previous[index];

      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  process.env.RAVN_EVALS_WORKSPACES = "/workspaces";
  process.env.RAVN_EVALS_HOME = "/home";
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.CURSOR_API_KEY = "cursor-key";

  const schema = z.object({
    tests: z.array(
      z.object({
        vars: z.object({ request: z.string() }),
        assert: z.array(
          z.object({
            type: z.string(),
            metric: z.string(),
            provider: z.unknown(),
            value: z.string().min(1),
          }),
        ),
      }),
    ),
  });

  for (const runner of runners) {
    process.env.RAVN_EVALS_RUNNER = runnerName(runner);

    const config = schema.parse(
      skillEval("show-me-your-work", [
        {
          kind: "trigger",
          invoked: true,
          fixture: "repo-b",
          description: "explicit invocation",
          request: "record decisions as we work",
        },
      ]),
    );

    const [trigger] = config.tests;
    assert.ok(trigger);
    assert.equal(trigger.assert.length, 1);
    assert.equal(trigger.assert[0]?.type, "llm-rubric");
    assert.equal(trigger.assert[0]?.metric, "explicit-command-accepted");
    assert.deepEqual(trigger.assert[0]?.provider, grader);

    const command = {
      "claude-code": "/show-me-your-work",
      codex: "$show-me-your-work",
      pi: "/skill:show-me-your-work",
      cursor: "/show-me-your-work",
    } satisfies Record<(typeof runners)[number]["harness"], string>;

    assert.equal(
      trigger.vars.request,
      `${command[runner.harness]} record decisions as we work`,
    );
  }
});
