import {
  existsSync,
  globSync,
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { parse } from "yaml";

// After a compaction, Claude Code re-attaches each invoked skill cut short:
// its docs give 5,000 tokens, and current releases cut at 20,000 characters.
// Text past the cut is gone for the session. Bytes never undercount
// characters, and the 10% margin absorbs a tighter cut or added header text.
export const skillBytesBudget = 18_000;

// Fields of the Agent Skills spec (agentskills.io/specification) that behave
// the same in every harness, plus the ones ravn-core uses deliberately.
// `allowed-tools` is in the spec but experimental, and harnesses differ on it.
const shippedFields = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "disable-model-invocation",
]);

const shippedMetadataFields = new Set(["proof"]);

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

export const shippedSkills = (root: string) =>
  sortedGlob(root, "plugins/agent/*/skills/*/SKILL.md");

const fieldErrors = (relative: string, meta: string, errors: string[]) => {
  let fields: unknown;

  try {
    fields = parse(meta);
  } catch {
    errors.push(`${relative}: frontmatter must be valid YAML`);

    return;
  }

  const entries = Object.entries(fields ?? {});

  for (const [field, value] of entries) {
    if (!shippedFields.has(field)) {
      errors.push(`${relative}: frontmatter field \`${field}\` is not allowed`);
    } else if (field === "metadata") {
      for (const key of Object.keys(value ?? {})) {
        if (!shippedMetadataFields.has(key)) {
          errors.push(
            `${relative}: frontmatter field \`metadata.${key}\` is not allowed`,
          );
        }
      }
    }
  }
};

const shippedSkillErrors = (root: string, errors: string[]) => {
  for (const relative of shippedSkills(root)) {
    const meta = frontmatter(read(root, relative));

    if (meta !== undefined) {
      fieldErrors(relative, meta, errors);
    }
  }
};

const sizeErrors = (root: string, errors: string[]) => {
  const seen = new Set<string>();

  for (const relative of [...shippedSkills(root), ...repoSkills(root)]) {
    const real = realpathSync(join(root, relative));

    if (seen.has(real)) {
      continue;
    }

    seen.add(real);

    const bytes = statSync(real).size;

    if (bytes > skillBytesBudget) {
      errors.push(
        `${relative}: SKILL.md is ${bytes} bytes, over the ${skillBytesBudget}-byte budget`,
      );
    }
  }
};

export const validateSkills = (root: string) => {
  const errors: string[] = [];

  repoSkillErrors(root, errors);
  shippedSkillErrors(root, errors);
  sizeErrors(root, errors);

  return errors;
};
