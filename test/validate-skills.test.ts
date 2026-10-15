import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { validateSkills } from "../scripts/validate-skills.ts";

const repoDir = join(import.meta.dirname, "..");

const copyDir = mkdtempSync(join(tmpdir(), "validate-skills-"));

const repoProbe = ".agents/skills/probe-fixture";

before(() => {
  for (const dir of [
    "plugins",
    ".agents/skills",
    ".claude/skills",
    ".pi/skills",
  ]) {
    cpSync(join(repoDir, dir), join(copyDir, dir), {
      recursive: true,
      verbatimSymlinks: true,
    });
  }
});

after(() => {
  rmSync(copyDir, { recursive: true, force: true });
});

const errorsWithProbe = (dir: string, skill: string) => {
  mkdirSync(join(copyDir, dir), { recursive: true });
  writeFileSync(join(copyDir, dir, "SKILL.md"), skill);

  try {
    return validateSkills(copyDir);
  } finally {
    rmSync(join(copyDir, dir), { recursive: true, force: true });
  }
};

const skill = (frontmatter: string) => `---\n${frontmatter}\n---\n\n# Probe\n`;

test("the repository's skills pass validation", () => {
  assert.deepEqual(validateSkills(repoDir), []);
});

const accepted: [string, string, string][] = [
  [
    "a repo-local skill with a single-line description",
    repoProbe,
    skill("name: probe-fixture\ndescription: A throwaway validator probe."),
  ],
];

for (const [label, dir, text] of accepted) {
  test(`accepts ${label}`, () => {
    assert.deepEqual(errorsWithProbe(dir, text), []);
  });
}

const rejected: [string, string, string, string][] = [
  [
    "a repo-local skill whose name differs from its directory",
    repoProbe,
    skill("name: probe-renamed\ndescription: A throwaway validator probe."),
    "frontmatter name must match directory name `probe-fixture`",
  ],
  [
    "a repo-local skill with an empty description",
    repoProbe,
    skill("name: probe-fixture\ndescription:"),
    "frontmatter must define a non-empty description",
  ],
  [
    "a repo-local skill whose description is a bare block indicator",
    repoProbe,
    skill("name: probe-fixture\ndescription: >-"),
    "frontmatter must define a non-empty description",
  ],
  [
    "a repo-local skill without frontmatter",
    repoProbe,
    "# Probe\n",
    "missing YAML frontmatter",
  ],
];

for (const [label, dir, text, message] of rejected) {
  test(`rejects ${label}`, () => {
    assert.deepEqual(errorsWithProbe(dir, text), [
      `${dir}/SKILL.md: ${message}`,
    ]);
  });
}

test("rejects a .claude repo skill that is a copy instead of a link", () => {
  const link = join(copyDir, ".claude/skills/validate");

  rmSync(link);
  cpSync(join(copyDir, ".agents/skills/validate"), link, { recursive: true });

  try {
    assert.deepEqual(validateSkills(copyDir), [
      ".claude/skills/validate: must be a symlink to .agents/skills/validate",
    ]);
  } finally {
    rmSync(link, { recursive: true });
    symlinkSync("../../.agents/skills/validate", link);
  }
});
