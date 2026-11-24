import assert from "node:assert/strict";
import { test } from "node:test";

import { presentPromptify } from "../../../plugins/agent/ravn-core/promptify/engine.ts";
import { createPiPromptifySurface } from "../../../plugins/agent/ravn-core/pi/promptify-surface.ts";

const result = {
  request: "original",
  draft: "rewritten",
  answer: "<promptify-draft>rewritten</promptify-draft>",
};

function host() {
  let editorText = "existing";
  let idle = true;
  const dialogs: Array<{ title: string; prefill?: string }> = [];
  const settled: Array<() => void> = [];

  const messages: Array<{
    customType: string;
    content: string;
    display: true;
  }> = [];

  const ui = {
    getEditorText: () => editorText,
    setEditorText: (text: string) => {
      editorText = text;
    },
    editor: async (title: string, prefill?: string) => {
      dialogs.push({ title, prefill });

      return undefined;
    },
  };

  const pi = {
    sendMessage: (message: {
      customType: string;
      content: string;
      display: true;
    }) => {
      messages.push(message);
    },
  };

  return {
    ui,
    pi,
    dialogs,
    messages,
    isIdle: () => idle,
    setIdle: (value: boolean) => {
      idle = value;
    },
    onAgentSettled: (task: () => void) => {
      settled.push(task);

      return () => {
        const index = settled.indexOf(task);

        if (index !== -1) settled.splice(index, 1);
      };
    },
    settle: () => {
      idle = true;
      settled.slice().forEach((task) => task());
    },
    editorText: () => editorText,
  };
}

test("Pi TUI maps Promptify to the composer", async () => {
  const target = host();
  await presentPromptify({
    result,
    surface: createPiPromptifySurface({
      mode: "tui",
      hasUI: true,
      ui: target.ui,
      pi: target.pi,
      customType: "promptify",
      isIdle: target.isIdle,
      onAgentSettled: target.onAgentSettled,
    }),
  });
  assert.equal(target.editorText(), "rewritten\n\nexisting");
  assert.deepEqual(target.dialogs, []);
  assert.deepEqual(target.messages, []);
});

test("Pi RPC maps Promptify to one editable dialog", async () => {
  const target = host();
  await presentPromptify({
    result,
    surface: createPiPromptifySurface({
      mode: "rpc",
      hasUI: true,
      ui: target.ui,
      pi: target.pi,
      customType: "promptify",
      isIdle: target.isIdle,
      onAgentSettled: target.onAgentSettled,
    }),
  });
  assert.equal(target.editorText(), "existing");
  assert.deepEqual(target.dialogs, [
    { title: "Promptify draft", prefill: "rewritten" },
  ]);
  assert.deepEqual(target.messages, []);
});

test("Pi without host UI emits only after the handled command settles", async () => {
  for (const mode of ["rpc", "json", "print"] as const) {
    const target = host();
    target.setIdle(false);
    await presentPromptify({
      result,
      surface: createPiPromptifySurface({
        mode,
        hasUI: false,
        ui: target.ui,
        pi: target.pi,
        customType: "promptify",
        isIdle: target.isIdle,
        onAgentSettled: target.onAgentSettled,
      }),
    });
    assert.deepEqual(target.messages, []);

    target.settle();

    assert.deepEqual(target.messages, [
      {
        customType: "promptify",
        content: "rewritten",
        display: true,
      },
    ]);
    assert.deepEqual(target.dialogs, []);
    assert.equal(target.editorText(), "existing");
  }
});

test("Pi without host UI emits immediately when no command turn is active", async () => {
  const target = host();
  await presentPromptify({
    result,
    surface: createPiPromptifySurface({
      mode: "rpc",
      hasUI: false,
      ui: target.ui,
      pi: target.pi,
      customType: "promptify",
      isIdle: target.isIdle,
      onAgentSettled: target.onAgentSettled,
    }),
  });
  assert.deepEqual(target.messages, [
    {
      customType: "promptify",
      content: "rewritten",
      display: true,
    },
  ]);
});
