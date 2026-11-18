import { existsSync } from "node:fs";
import { cp, mkdtemp, realpath, rename, rm, writeFile } from "node:fs/promises";
import { join, sep } from "node:path";

export async function runtimeSkillsDirectory(
  directory: string,
): Promise<string> {
  const source = await realpath(directory);

  const modules = source.indexOf(`${sep}node_modules${sep}`);

  if (modules === -1) return source;

  // Node rejects .ts entry points under node_modules. Keep the runnable skills
  // beside it in OpenCode's cache for this installed revision.
  const installRoot = source.slice(0, modules + 1);

  const target = join(installRoot, ".ravn-core-skills");

  if (existsSync(target)) return target;

  const stage = await mkdtemp(join(installRoot, ".ravn-core-skills-stage-"));

  try {
    await cp(source, stage, { recursive: true });
    await writeFile(join(stage, "package.json"), '{"type":"module"}\n');

    try {
      await rename(stage, target);
    } catch (error) {
      // Another OpenCode location may have published the same revision first.
      if (!existsSync(target)) throw error;
    }
  } finally {
    await rm(stage, { recursive: true, force: true });
  }

  return target;
}
