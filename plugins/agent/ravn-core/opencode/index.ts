import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Plugin, Skill } from "@opencode/plugin";
import { parse } from "yaml";
import { z } from "zod";
import { runtimeSkillsDirectory } from "./skill-directory.ts";

const bundledSkills = fileURLToPath(new URL("../skills/", import.meta.url));

const skillFrontmatter = z.object({
  description: z.string().min(1),
  "disable-model-invocation": z.boolean().optional(),
});

async function readSkill(directory: string, name: string): Promise<Skill.Info> {
  const path = join(directory, name, "SKILL.md");

  const text = await readFile(path, "utf8");

  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);

  if (frontmatter === null) throw new Error(`Missing frontmatter: ${path}`);

  const metadata = skillFrontmatter.safeParse(parse(frontmatter[1]));

  if (!metadata.success) {
    throw new Error(`Invalid skill frontmatter: ${path}`, {
      cause: metadata.error,
    });
  }

  return Skill.Info.make({
    id: Skill.ID.make(name),
    name: Skill.Name.make(name),
    description: metadata.data.description,
    autoinvoke: metadata.data["disable-model-invocation"] !== true,
    path: Skill.Info.fields.path.make(path),
    content: text.slice(frontmatter[0].length),
  });
}

export default Plugin.define({
  id: "ravn-core",
  async setup(ctx) {
    const directory = await runtimeSkillsDirectory(bundledSkills);

    const entries = await readdir(directory, { withFileTypes: true });

    const skills = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(({ name }) => readSkill(directory, name)),
    );

    await ctx.skill.transform((editor) => {
      for (const skill of skills) {
        if (!editor.get(skill.id)) editor.add(skill);
      }
    });

    await ctx.command.transform((editor) => {
      for (const skill of skills) {
        editor.add({
          name: skill.id,
          description: skill.description,
          async execute({ sessionID, prompt, delivery }) {
            const attached = prompt.skills ?? [];

            await ctx.session.prompt({
              ...prompt,
              sessionID,
              delivery,
              text: prompt.text || `Use the ${skill.id} skill.`,
              skills: attached.some(({ id }) => id === skill.id)
                ? attached
                : [...attached, { id: skill.id }],
            });
          },
        });
      }
    });
  },
});
