import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { findPackageJSON } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

test("Codex SDK reads JSONL search results with Unicode line separators", {
  skip: process.platform === "win32",
}, async (t) => {
  const root = mkdtempSync(join(tmpdir(), "ravn-codex-jsonl-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const executable = join(root, "codex");
  const results = join(root, "events.jsonl");

  const event = {
    type: "item.completed",
    item: {
      id: "item_0",
      type: "web_search",
      query: "One\u2028Two\u2029Three",
    },
  };

  writeFileSync(
    executable,
    '#!/bin/sh\ncat >/dev/null\ncat "$CODEX_TEST_EVENTS"\n',
    {
      mode: 0o700,
    },
  );

  const message = {
    type: "item.completed",
    item: { type: "agent_message", text: "Done." },
  };

  writeFileSync(
    results,
    `${JSON.stringify(event)}\r\n${JSON.stringify(message)}`,
  );

  const manifest = findPackageJSON(
    "@openai/codex-sdk",
    import.meta.resolve("promptfoo"),
  );

  assert.ok(manifest);
  const sdk = pathToFileURL(join(dirname(manifest), "dist/index.js")).href;
  const { Codex } = await import(sdk);

  const { events } = await new Codex({
    codexPathOverride: executable,
    env: { PATH: process.env.PATH, CODEX_TEST_EVENTS: results },
  })
    .startThread()
    .runStreamed("Read the search result.");

  const observed = [];

  for await (const item of events) observed.push(item);
  assert.deepEqual(observed, [event, message]);
});
