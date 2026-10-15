import {
  existsSync,
  globSync,
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

const read = (root: string, relative: string) =>
  readFileSync(join(root, relative), "utf8");

const sortedGlob = (root: string, pattern: string) =>
  globSync(pattern, { cwd: root }).sort();

const frontmatter = (text: string) =>
  /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text)?.[1];

const hasDescriptionText = (meta: string) =>
  /^description:[ \t]*(?![>|])\S/m.test(meta) ||
  /^description:[ \t]*[>|][-+]?[ \t]*\n[ \t]+\S/m.test(meta);

const skillMeta = (root: string, relative: string, errors: string[]) => {
  const meta = frontmatter(read(root, relative));

  if (meta === undefined) {
    errors.push(`${relative}: missing YAML frontmatter`);

    return undefined;
  }

  const name = /^name:\s*(\S+)\s*$/m.exec(meta)?.[1];

  const directory = basename(dirname(relative));

  if (name === undefined) {
    errors.push(`${relative}: frontmatter must define name`);
  } else if (name !== directory) {
    errors.push(
      `${relative}: frontmatter name must match directory name \`${directory}\``,
    );
  }

  return meta;
};

export const repoSkills = (root: string) => [
  ...sortedGlob(root, ".claude/skills/*/SKILL.md"),
  ...sortedGlob(root, ".agents/skills/*/SKILL.md"),
];

const repoSkillErrors = (root: string, errors: string[]) => {
  for (const relative of repoSkills(root)) {
    const meta = skillMeta(root, relative, errors);

    if (meta !== undefined && !hasDescriptionText(meta)) {
      errors.push(
        `${relative}: frontmatter must define a non-empty description`,
      );
    }
  }

  for (const harnessDir of [".claude/skills", ".pi/skills"]) {
    if (!existsSync(join(root, harnessDir))) {
      continue;
    }

    for (const name of readdirSync(join(root, harnessDir)).sort()) {
      const relative = join(harnessDir, name);

      const source = join(root, ".agents/skills", name);

      if (!lstatSync(join(root, relative)).isSymbolicLink()) {
        errors.push(`${relative}: must be a symlink to .agents/skills/${name}`);
      } else if (
        !existsSync(source) ||
        realpathSync(join(root, relative)) !== realpathSync(source)
      ) {
        errors.push(`${relative}: must resolve to .agents/skills/${name}`);
      }
    }
  }
};

export const validateSkills = (root: string) => {
  const errors: string[] = [];

  repoSkillErrors(root, errors);

  return errors;
};
