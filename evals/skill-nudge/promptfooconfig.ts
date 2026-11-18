import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type {
  GradingResult,
  PromptFunction,
  ProviderResponse,
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

const openRouter = process.env.RAVN_EVALS_NUDGE_ROUTE === "openrouter";

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

  const text = listing(skillsFor(id)) + transcript(messagesOf(id));

  return openRouter
    ? JSON.stringify([
        { role: "system", content: SYSTEM },
        { role: "user", content: text },
      ])
    : text;
};

function grade(
  output: string,
  id: string,
  usage?: ProviderResponse["tokenUsage"],
): GradingResult {
  const { completion = 0, completionDetails } = usage ?? {};
  const visible = completion - (completionDetails?.reasoning ?? 0);

  if (visible > MAX_TOKENS) {
    return {
      pass: false,
      score: 0,
      reason: `Visible output exceeds ${MAX_TOKENS} tokens.`,
    };
  }

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
        grade(output, one.id, context.providerResponse?.tokenUsage),
    },
  ],
}));

const home = process.env.RAVN_NUDGE_HOME;

const isolated = home
  ? { HOME: home, CLAUDE_CONFIG_DIR: join(home, ".claude") }
  : {};

const config: UnifiedConfig = {
  description: "skill-nudge: does Haiku suggest the right ravn-core skill?",
  prompts: [{ label: "skill-nudge", raw: "skill-nudge", function: prompt }],
  providers: [
    openRouter
      ? {
          id: "openrouter:anthropic/claude-haiku-5.5",
          label: "skill-nudge/haiku-or",
          config: {
            max_tokens: MAX_TOKENS,
            omitDefaults: true,
            passthrough: {
              reasoning: { enabled: false },
              provider: {
                order: ["Anthropic"],
                allow_fallbacks: false,
                require_parameters: true,
              },
            },
          },
        }
      : {
          id: "anthropic:claude-agent-sdk",
          label: "skill-nudge/haiku",
          config: {
            model: "haiku",
            apiKeyRequired: false,
            custom_system_prompt: SYSTEM,
            tools: [],
            skills: [],
            persist_session: false,
            env: isolated,
            max_turns: 1,
            thinking: { type: "disabled" },
          },
        },
  ],
  tests,
  evaluateOptions: { maxConcurrency: 4 },
  outputPath: join(import.meta.dirname, "..", "results", "skill-nudge.json"),
};

export default config;
