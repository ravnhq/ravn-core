import type { JsonAgentSessionEvent } from "@earendil-works/pi-coding-agent";

const stages = [
  "Reading project evidence",
  "Finding what a professional would do",
  "Identifying primary sources",
  "Picking methods and tools",
  "Defining independent checks",
  "Writing the draft",
];

type Tool = { label: string; state: "•" | "✓" | "✗" };

export function progress() {
  const started = Date.now();
  const tools = new Map<string, Tool>();
  let reply = "";

  return {
    update(event: JsonAgentSessionEvent) {
      if (event.type === "tool_execution_start") {
        const { path, pattern } = event.args ?? {};
        const target = path ?? pattern;
        const label = `${event.toolName} ${target ?? ""}`.replace(/\s+/g, " ");
        tools.set(event.toolCallId, { label: label.slice(0, 40), state: "•" });
      }

      if (event.type === "tool_execution_end") {
        const tool = tools.get(event.toolCallId);

        if (tool) tool.state = event.isError ? "✗" : "✓";
      }

      if (event.type === "message_start" && event.message.role === "assistant")
        reply = "";

      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      )
        reply += event.assistantMessageEvent.delta;
    },
    lines(cancel: string) {
      const seconds = Math.floor((Date.now() - started) / 1000);

      const stage = reply.includes("<promptify-draft>")
        ? 5
        : (reply.match(/^\s*[1-4]\./gm)?.length ?? 0);

      const filled = Math.min(stages.length, stage + 1);
      const recent = [...tools.values()].slice(-2);

      return [
        `${"▰".repeat(filled)}${"▱".repeat(stages.length - filled)}  ${stages[filled - 1]} · ${seconds}s · ${cancel}`,
        recent.map(({ label, state }) => `${state} ${label}`).join("  ") ||
          "Waiting for the helper…",
      ];
    },
  };
}
