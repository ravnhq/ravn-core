import { join } from "node:path";
import type { TestCase } from "promptfoo";
import { z } from "zod";
import { arms } from "./skill-eval.ts";
import {
  applyEdits,
  fixtureNames,
  resetWorkspaceRepo,
} from "./workspace-repo.ts";

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

  for (const fixture of fixtureNames) {
    for (const arm of arms) {
      resetWorkspaceRepo(join(workspacesDir, fixture, arm), fixture);
    }
  }

  const setup = setupSchema.safeParse(context.test?.metadata);

  if (!setup.success) {
    return;
  }

  const { fixture, edits } = setup.data;

  for (const arm of arms) {
    applyEdits(join(workspacesDir, fixture, arm), edits);
  }
}
