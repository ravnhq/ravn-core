import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { seedPiHome } from "../../evals/pi-home.ts";

test("an isolated Pi profile carries only the selected provider, model, and login", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ravn-pi-profile-"));
  const source = join(root, "source");
  const target = join(root, "isolated");

  mkdirSync(source);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const credential = { type: "api_key", key: "fixture-only" };
  writeFileSync(
    join(source, "auth.json"),
    JSON.stringify({ proxy: credential, unrelated: { key: "unrelated" } }),
  );
  writeFileSync(
    join(source, "models.json"),
    JSON.stringify({
      providers: {
        proxy: {
          apiKey: "!host-command",
          models: [{ id: "codex/selected" }, { id: "other" }],
        },
        unrelated: {},
      },
    }),
  );
  writeFileSync(
    join(source, "settings.json"),
    '{"packages":["user-settings"]}',
  );
  writeFileSync(join(source, "AGENTS.md"), "User guidance outside the eval.\n");
  const old = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = source;

  try {
    seedPiHome(target, "proxy", "codex/selected");
  } finally {
    if (old === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = old;
  }

  assert.deepEqual(readdirSync(target).sort(), ["auth.json", "models.json"]);
  assert.deepEqual(
    JSON.parse(readFileSync(join(target, "auth.json"), "utf8")),
    { proxy: credential },
  );
  assert.deepEqual(
    JSON.parse(readFileSync(join(target, "models.json"), "utf8")),
    { providers: { proxy: { models: [{ id: "codex/selected" }] } } },
  );
});
