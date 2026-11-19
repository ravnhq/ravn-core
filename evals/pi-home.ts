import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const modelConfig = z.object({
  providers: z
    .record(
      z.string(),
      z.looseObject({
        models: z.array(z.looseObject({ id: z.string() })).optional(),
      }),
    )
    .default({}),
});

const authConfig = z.record(z.string(), z.json());

function jsonFile(dir: string, file: string) {
  const path = join(dir, file);

  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
}

export function seedPiHome(target: string, provider: string, id: string) {
  const source =
    process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");

  const auth = authConfig.parse(jsonFile(source, "auth.json"))[provider];

  const model = modelConfig.parse(jsonFile(source, "models.json")).providers[
    provider
  ];

  mkdirSync(target, { recursive: true, mode: 0o700 });

  if (auth !== undefined) {
    writeFileSync(
      join(target, "auth.json"),
      JSON.stringify({ [provider]: auth }),
      { mode: 0o600 },
    );
  }

  if (model || auth === undefined) {
    const isolated = { ...model };

    delete isolated.apiKey;

    if (model?.models)
      isolated.models = model.models.filter((entry) => entry.id === id);

    if (auth === undefined) {
      // Resolve the selected provider's credential via Pi with the source
      // config. The isolated copy never runs a host credential command.
      const result = spawnSync(
        "pi",
        ["auth", "print-api-key", "--provider", provider, "--model", id],
        { encoding: "utf8" },
      );

      if (result.status !== 0 || !result.stdout.trim()) {
        throw new Error(
          `Pi API key unavailable for ${provider}/${id}; check its login before running the eval.`,
        );
      }

      isolated.apiKey = result.stdout.trim();
    }

    writeFileSync(
      join(target, "models.json"),
      JSON.stringify({ providers: { [provider]: isolated } }),
      { mode: 0o600 },
    );
  }
}
