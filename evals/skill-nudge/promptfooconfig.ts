import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type {
  ApiProvider,
  GradingResult,
  PromptFunction,
  ProviderResponse,
  TestCase,
  UnifiedConfig,
} from "promptfoo";
import { parse as parseYaml } from "yaml";

import {
  MAX_TOKENS,
  REVIEW_MAX_TOKENS,
  REVIEW_SYSTEM,
  SYSTEM,
  applyReview,
  catalog,
  listing,
  parse,
  reviewPrompt,
  transcript,
  usedSkills,
} from "../../plugins/mods/skill-nudge/lib/nudge.ts";
import type {
  Command,
  Message,
} from "../../plugins/mods/skill-nudge/lib/nudge.ts";
import { cases } from "./cases.ts";

const openRouter = process.env.RAVN_EVALS_NUDGE_ROUTE === "openrouter";

const home = process.env.RAVN_NUDGE_HOME;

function modelPrompt(system: string, text: string): string {
  return openRouter
    ? JSON.stringify([
        { role: "system", content: system },
        { role: "user", content: text },
      ])
    : text;
}

function provider(system: string, maxTokens: number) {
  return openRouter
    ? {
        id: "openrouter:anthropic/claude-haiku-5.5",
        config: {
          max_tokens: maxTokens,
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
        config: {
          model: "haiku",
          apiKeyRequired: false,
          custom_system_prompt: system,
          tools: [],
          skills: [],
          persist_session: false,
          env: home
            ? { HOME: home, CLAUDE_CONFIG_DIR: join(home, ".claude") }
            : {},
          max_turns: 1,
          thinking: { type: "disabled" },
        },
      };
}

function visibleTokens(usage: ProviderResponse["tokenUsage"]) {
  return usage?.completion === undefined
    ? undefined
    : usage.completion - (usage.completionDetails?.reasoning ?? 0);
}

let reviewer: Promise<ApiProvider> | undefined;

async function askReviewer(text: string) {
  const route = provider(REVIEW_SYSTEM, REVIEW_MAX_TOKENS);

  reviewer ??= import("promptfoo").then(({ loadApiProvider }) =>
    loadApiProvider(route.id, { options: route }),
  );

  const raw = modelPrompt(REVIEW_SYSTEM, text);

  const response = await (await reviewer).callApi(raw, {
    prompt: { raw, label: "nudge-review" },
    vars: {},
    bustCache: true,
  });

  const tokens = visibleTokens(response.tokenUsage);

  if (response.error || (tokens !== undefined && tokens > REVIEW_MAX_TOKENS))
    return undefined;

  return String(response.output ?? "");
}

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

  return modelPrompt(SYSTEM, text);
};

export async function gradeReply(
  output: string,
  id: string,
  usage?: ProviderResponse["tokenUsage"],
  review: (prompt: string) => Promise<string | undefined> = askReviewer,
): Promise<GradingResult> {
  // The SDK may continue beyond its limit. Grade what it actually returned
  // and fail visible over-budget replies; never slice JSON using reasoning.
  const tokens = visibleTokens(usage);

  if (tokens !== undefined && tokens > MAX_TOKENS) {
    return {
      pass: false,
      score: 0,
      reason: `over-budget: ${tokens} visible tokens; limit ${MAX_TOKENS}`,
    };
  }

  const expected = (byId.get(id)?.expect ?? []).map(
    (skill) => `ravn-core:${skill}`,
  );

  const messages = messagesOf(id);

  const candidate = parse(
    output,
    skillsFor(id),
    messages,
    tokens === MAX_TOKENS,
  );

  const decision =
    candidate.kind === "nudge"
      ? applyReview(
          candidate,
          await review(reviewPrompt(messages, candidate.suggestion)),
        )
      : candidate;

  if (
    decision.kind !== "abstained" &&
    decision.kind !== "vetoed" &&
    decision.kind !== "nudge"
  ) {
    return { pass: false, score: 0, reason: decision.kind };
  }

  const got = decision.kind === "nudge" ? decision.suggestion.skill : "nothing";

  const pass =
    expected.length === 0 ? decision.kind !== "nudge" : expected.includes(got);

  return {
    pass,
    score: pass ? 1 : 0,
    reason: `expected ${expected.join(" or ") || "nothing"}, got ${got}${decision.kind === "vetoed" ? ` (vetoed: ${decision.verdict})` : ""}`,
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
        gradeReply(output, one.id, context.providerResponse?.tokenUsage),
    },
  ],
}));

const config: UnifiedConfig = {
  description: "skill-nudge: does Haiku suggest the right ravn-core skill?",
  prompts: [{ label: "skill-nudge", raw: "skill-nudge", function: prompt }],
  providers: [
    {
      ...provider(SYSTEM, MAX_TOKENS),
      label: openRouter ? "skill-nudge/haiku-or" : "skill-nudge/haiku",
    },
  ],
  tests,
  evaluateOptions: { maxConcurrency: 4 },
  outputPath: join(import.meta.dirname, "..", "results", "skill-nudge.json"),
};

export default config;
