import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type {
  GradingResult,
  PromptFunction,
  TestCase,
  UnifiedConfig,
} from "promptfoo";
import { parse as parseYaml } from "yaml";

import {
  MAX_TOKENS,
  SYSTEM,
  catalog,
  listing,
  parse,
  transcript,
  usedSkills,
} from "../../plugins/mods/skill-nudge/lib/nudge.ts";
import type {
  Command,
  Message,
} from "../../plugins/mods/skill-nudge/lib/nudge.ts";
import { cases } from "./cases.ts";

const skillsDir = join(
  import.meta.dirname,
  "..",
  "..",
  "plugins",
  "agent",
  "ravn-core",
  "skills",
);

// ravn-core's skills as `$.command.list()` lists them from the installed plugin.
const commands: Command[] = readdirSync(skillsDir).map((skill) => {
  const text = readFileSync(join(skillsDir, skill, "SKILL.md"), "utf8");
  const meta = parseYaml(/^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "");

  return {
    name: `ravn-core:${skill}`,
    description: String(meta.description ?? "").trim(),
    source: "plugin",
    plugin: "ravn-core",
  };
});

const byId = new Map(cases.map((one) => [one.id, one]));

function messagesOf(id: string): Message[] {
  return (byId.get(id)?.messages ?? []).map(([role, text, tools = []]) => ({
    role,
    text,
    toolUses: tools.map((tool) =>
      tool.startsWith("Skill:")
        ? { tool: "Skill", input: { skill: tool.slice("Skill:".length) } }
        : { tool, input: {} },
    ),
  }));
}

function skillsFor(id: string) {
  return catalog(commands, usedSkills(messagesOf(id)));
}

// The mod's request: its system prompt goes on the provider, this is the user turn.
const prompt: PromptFunction = async ({ vars }) => {
  const id = String(vars.id);

  return listing(skillsFor(id)) + transcript(messagesOf(id));
};

// The mod caps Haiku's reply at MAX_TOKENS. The provider cannot: under
// CLAUDE_CODE_MAX_OUTPUT_TOKENS, Claude Code tells the model it hit the limit and
// lets it continue, which the mod never does. So cut an over-long reply here
// instead, keeping the share of its text that the first MAX_TOKENS tokens cover.
function capped(output: string, completionTokens: number | undefined): string {
  if (completionTokens === undefined || completionTokens <= MAX_TOKENS)
    return output;

  return output.slice(
    0,
    Math.floor((output.length * MAX_TOKENS) / completionTokens),
  );
}

function grade(output: string, id: string): GradingResult {
  const expected = (byId.get(id)?.expect ?? []).map(
    (skill) => `ravn-core:${skill}`,
  );

  const found = parse(output, skillsFor(id));
  const got = found?.skill ?? "nothing";

  const pass =
    expected.length === 0 ? found === undefined : expected.includes(got);

  return {
    pass,
    score: pass ? 1 : 0,
    reason: `expected ${expected.join(" or ") || "nothing"}, got ${got}${
      found ? ` (${found.reason})` : ""
    }`,
  };
}

const tests: TestCase[] = cases.map((one) => ({
  description: `${one.kind}: ${one.id}`,
  vars: { id: one.id },
  metadata: { kind: one.kind, heldOut: one.heldOut === true },
  assert: [
    {
      type: "javascript",
      metric: one.kind,
      value: (output: string, context) =>
        grade(
          capped(output, context.providerResponse?.tokenUsage?.completion),
          one.id,
        ),
    },
  ],
}));

const config: UnifiedConfig = {
  description: "skill-nudge: does Haiku suggest the right ravn-core skill?",
  prompts: [{ label: "skill-nudge", raw: "skill-nudge", function: prompt }],
  providers: [
    {
      id: "anthropic:claude-agent-sdk",
      label: "skill-nudge/haiku",
      config: {
        model: "haiku",
        apiKeyRequired: false,
        custom_system_prompt: SYSTEM,
        tools: [],
        max_turns: 1,
        // `$.model.complete` sends no thinking, so the eval must not either.
        thinking: { type: "disabled" },
      },
    },
  ],
  tests,
  evaluateOptions: { maxConcurrency: 4 },
  outputPath: join(import.meta.dirname, "..", "results", "skill-nudge.json"),
};

export default config;
