import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { TestCase } from "promptfoo";
import { z } from "zod";
import { applyEdits, resetWorkspaceRepo } from "./workspace-repo.ts";

const setupSchema = z.object({
  fixture: z.string(),
  edits: z.array(
    z.object({ path: z.string(), find: z.string(), replace: z.string() }),
  ),
});

export function extensionHook(hookName: string, context: { test?: TestCase }) {
  const workspacesDir = process.env.RAVN_EVALS_WORKSPACES;

  if (hookName !== "beforeEach" || workspacesDir === undefined) {
    return;
  }

  for (const fixture of readdirSync(workspacesDir)) {
    for (const arm of readdirSync(join(workspacesDir, fixture))) {
      resetWorkspaceRepo(join(workspacesDir, fixture, arm), fixture);
    }
  }

  const setup = setupSchema.safeParse(context.test?.metadata);

  if (!setup.success) {
    return;
  }

  const { fixture, edits } = setup.data;

  for (const arm of readdirSync(join(workspacesDir, fixture))) {
    applyEdits(join(workspacesDir, fixture, arm), edits);
  }
}
