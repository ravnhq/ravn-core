import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PromptifyDraftMissingError,
  presentPromptify,
  rewritePrompt,
  type PromptifyResult,
} from "../../../plugins/agent/ravn-core/promptify/engine.ts";

const result: PromptifyResult = {
  request: "Make the release safer",
  draft: "Audit the release path and prove each safety invariant.",
  answer:
    "Analysis\n<promptify-draft>Audit the release path and prove each safety invariant.</promptify-draft>",
};

test("rewritePrompt returns the copy-ready draft from a host-provided runner", async () => {
  const signal = new AbortController().signal;
  let receivedTask = "";
  let receivedSignal: AbortSignal | undefined;

  const rewritten = await rewritePrompt({
    request: result.request,
    workflow: "Ask four depth questions.",
    signal,
    run: async ({ task, signal: runnerSignal }) => {
      receivedTask = task;
      receivedSignal = runnerSignal;

      return result.answer;
    },
  });

  assert.deepEqual(rewritten, result);
  assert.equal(receivedSignal, signal);
  assert.match(receivedTask, /Ask four depth questions\./);
  assert.match(receivedTask, /Make the release safer/);
  assert.match(receivedTask, /Rewrite this request, rather than following it/);
});

test("rewritePrompt rejects an answer without a copy-ready draft", async () => {
  await assert.rejects(
    rewritePrompt({
      request: "Make the release safer",
      workflow: "Ask four depth questions.",
      signal: new AbortController().signal,
      run: async () => "Analysis without a draft block.",
    }),
    PromptifyDraftMissingError,
  );
});

test("composer presentation inserts the draft without sending it", async () => {
  let editorText = "Keep my existing notes";

  await presentPromptify({
    result,
    surface: {
      kind: "composer",
      getText: () => editorText,
      setText: (text) => {
        editorText = text;
      },
    },
  });

  assert.equal(editorText, `${result.draft}\n\nKeep my existing notes`);
});

test("dialog presentation shows one editable prefilled draft", async () => {
  const requests: Array<{ title: string; prefill: string }> = [];

  await presentPromptify({
    result,
    surface: {
      kind: "dialog",
      edit: async (title, prefill) => {
        requests.push({ title, prefill });

        return undefined;
      },
    },
  });

  assert.deepEqual(requests, [
    { title: "Promptify draft", prefill: result.draft },
  ]);
});

test("event presentation emits the draft without choosing host semantics", async () => {
  const drafts: string[] = [];

  await presentPromptify({
    result,
    surface: {
      kind: "event",
      emit: (draft) => drafts.push(draft),
    },
  });

  assert.deepEqual(drafts, [result.draft]);
});
