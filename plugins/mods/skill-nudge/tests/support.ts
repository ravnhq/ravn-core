import type {
  CommandInfo,
  ModelCompleteInput,
  ModelCompleteResult,
  On,
  RenderNode,
  SessionMessage,
} from "claude-code";
import { mock } from "claude-code/testing";

import { parseEvents } from "../lib/telemetry.ts";

export const STOCK_TEXT = "stock band";

export const COMMANDS: CommandInfo[] = [
  { name: "clear", description: "Clear the conversation", source: "builtin" },
  {
    name: "ravn-core:research",
    description: "Investigate a question against primary sources",
    source: "plugin",
    plugin: "ravn-core",
  },
  {
    name: "ravn-core:grilling",
    description: "Grill the user about a plan",
    source: "plugin",
    plugin: "ravn-core",
  },
  { name: "deploy", description: "Deploy the app", source: "user" },
  { name: "linear:issue", description: "Linear issue", source: "mcp" },
  {
    name: "skill-nudge",
    description: "Turn skill nudges on or off",
    source: "plugin",
    plugin: "skill-nudge",
  },
];

export function world(
  on: On,
  options: {
    reply?: string;
    messages?: SessionMessage[];
    draft?: string;
    store?: Record<string, boolean>;
  } = {},
) {
  const clock = mock.clock(on);

  // The plugin store, in memory, so `judged` can count the events judgments record.
  const store = new Map<string, unknown>(Object.entries(options.store ?? {}));
  on("store.get", async (_$, e) => ({
    value: structuredClone(store.get(e.key)),
  }));
  on("store.set", async (_$, e) => {
    store.set(e.key, structuredClone(e.value));

    return { value: undefined };
  });
  on("store.delete", async (_$, e) => {
    store.delete(e.key);

    return { value: undefined };
  });
  on("store.keys", async () => ({ value: [...store.keys()] }));

  const judgments = () =>
    [...store]
      .filter(([key]) => key.startsWith("events:"))
      .flatMap(([, value]) => parseEvents(String(value)))
      .filter((event) => event.type === "judged").length;

  const requests: ModelCompleteInput[] = [];
  const fills: string[] = [];
  const copies: string[] = [];
  let reply = options.reply ?? '{"skill": null}';
  let hold: Promise<void> = Promise.resolve();

  on("session.start", async (_$, e) => ({ cwd: e.cwd }));
  on("command.register", async (_$, e) => ({ value: { command: e.name } }));
  on("command.list", async () => ({ value: COMMANDS }));
  on("session.id", async () => ({ value: "session-1" }));
  on("ui.copy", async (_$, e) => {
    copies.push(e.text);

    return { value: { isCopied: true as const } };
  });
  on("session.messages", async () => ({ value: options.messages ?? [] }));
  on("model.complete", async (_$, e) => {
    requests.push(e);
    await hold;

    const answer: ModelCompleteResult = {
      isAnswered: true,
      text: reply,
      usage: {
        input_tokens: 1,
        output_tokens: 1,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    };

    return { value: answer };
  });
  on("prompt.read", async () => ({
    value: { text: options.draft ?? "", cursor: 0 },
  }));
  on("prompt.fill", async (_$, e) => {
    fills.push(e.text);

    return { isFilled: true, box: { text: e.text, cursor: 0 } };
  });
  on("prompt.submit", async (_$, e) => ({ text: e.text }));
  on("turn.complete", async (_$, e) => ({ text: e.answer }));
  on("ui.render", async () => ({
    type: "Text",
    props: {},
    children: [STOCK_TEXT],
  }));

  return {
    clock,
    // clock.settle() fires the judgment's timer but not the async work it starts,
    // so wait until the session has recorded `count` judgments in all.
    judged: async (count: number) => {
      for (let tick = 0; tick < 1000; tick += 1) {
        await clock.settle();

        if (judgments() >= count) return;

        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      throw new Error(`Expected ${count} judgments, saw ${judgments()}.`);
    },
    requests,
    fills,
    copies,
    setReply: (text: string) => {
      reply = text;
    },
    holdModel: () => {
      let release = () => {};

      hold = new Promise((resolve) => {
        release = resolve;
      });

      return release;
    },
  };
}

export const sessionStart = {
  cwd: "/work",
  surface: "terminal" as const,
  isInteractive: true,
};

export function turn(
  overrides: { agentId?: string; reason?: "answer" | "aborted" } = {},
) {
  const reason = overrides.reason ?? "answer";

  const input = {
    answer: "Done.",
    durationMs: 1000,
    isAborted: reason === "aborted",
    turnId: "turn-1",
    reason,
  };

  if (overrides.agentId === undefined) return input;

  return { ...input, agentId: overrides.agentId };
}

export const band = {
  surface: "terminal" as const,
  component: "AbovePrompt" as const,
  requestId: "above-prompt",
  viewport: { columns: 100, rows: 30 },
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 95,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
};

export function textOf(tree: RenderNode): string {
  return JSON.stringify(tree);
}
