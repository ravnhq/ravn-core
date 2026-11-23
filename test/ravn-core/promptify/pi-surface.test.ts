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
  const dialogs: Array<{ title: string; prefill?: string }> = [];

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

  return { ui, pi, dialogs, messages, editorText: () => editorText };
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
    }),
  });
  assert.equal(target.editorText(), "existing");
  assert.deepEqual(target.dialogs, [
    { title: "Promptify draft", prefill: "rewritten" },
  ]);
  assert.deepEqual(target.messages, []);
});

test("headless Pi modes emit a displayed message without triggering a turn", async () => {
  for (const mode of ["json", "print"] as const) {
    const target = host();
    await presentPromptify({
      result,
      surface: createPiPromptifySurface({
        mode,
        hasUI: false,
        ui: target.ui,
        pi: target.pi,
        customType: "promptify",
      }),
    });
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
