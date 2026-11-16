import { cpSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { TestCase } from "promptfoo";
import { z } from "zod";
import { arms } from "./skill-eval.ts";
import { applyEdits } from "./workspace-repo.ts";

const setupSchema = z.object({
  fixture: z.string(),
  edits: z.array(
    z.object({ path: z.string(), find: z.string(), replace: z.string() }),
  ),
});

// Agents work in promptfoo's per-step copies (`copy_working_dir`), so only a
// test's own setup ever writes to the workspaces they are copied from. Each
// step starts them over from the pristine set run.ts made, then applies the
// test's edits, so no setup carries into the next test.
export function extensionHook(hookName: string, context: { test?: TestCase }) {
  const workspacesDir = process.env.RAVN_EVALS_WORKSPACES;

  const pristineDir = process.env.RAVN_EVALS_PRISTINE;

  if (
    hookName !== "beforeEach" ||
    workspacesDir === undefined ||
    pristineDir === undefined
  ) {
    return;
  }

  rmSync(workspacesDir, { recursive: true, force: true });

  cpSync(pristineDir, workspacesDir, {
    recursive: true,
    verbatimSymlinks: true,
  });

  const setup = setupSchema.safeParse(context.test?.metadata);

  if (!setup.success) {
    return;
  }

  const { fixture, edits } = setup.data;

  for (const arm of arms) {
    applyEdits(join(workspacesDir, fixture, arm), edits);
  }
}
