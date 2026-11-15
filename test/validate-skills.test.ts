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
import {
  skillBytesBudget,
  validateSkills,
} from "../scripts/validate-skills.ts";

const repoDir = join(import.meta.dirname, "..");

const copyDir = mkdtempSync(join(tmpdir(), "validate-skills-"));

const repoProbe = ".agents/skills/probe-fixture";

const shippedProbe = "plugins/agent/ravn-core/skills/probe-fixture";

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

const skill = (frontmatter: string, body = "# Probe\n") =>
  `---\n${frontmatter}\n---\n\n${body}`;

const probeMeta =
  "name: probe-fixture\ndescription: A throwaway validator probe.";

// Two bytes per character: under the budget in characters, over it in bytes.
const oversizedBody = "é".repeat(skillBytesBudget / 2);

test("the repository's skills pass validation", () => {
  assert.deepEqual(validateSkills(repoDir), []);
});

const accepted: [string, string, string][] = [
  [
    "a repo-local skill with a single-line description",
    repoProbe,
    skill("name: probe-fixture\ndescription: A throwaway validator probe."),
  ],
  [
    "a shipped skill with every allowed frontmatter field",
    shippedProbe,
    skill(
      `${probeMeta}\nlicense: See LICENSE.txt\ncompatibility: Requires git\ndisable-model-invocation: true\nmetadata:\n  proof: subjective`,
    ),
  ],
  [
    "a repo-local skill with a harness-specific field",
    repoProbe,
    skill(`${probeMeta}\nargument-hint: "[version]"`),
  ],
  [
    "a skill exactly at the size budget",
    shippedProbe,
    skill(
      probeMeta,
      "x".repeat(skillBytesBudget - skill(probeMeta, "").length),
    ),
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
  [
    "a shipped skill with a field outside the allowlist",
    shippedProbe,
    skill(`${probeMeta}\nargument-hint: "[version]"`),
    "frontmatter field `argument-hint` is not allowed",
  ],
  [
    "a shipped skill with the experimental allowed-tools field",
    shippedProbe,
    skill(`${probeMeta}\nallowed-tools: Read`),
    "frontmatter field `allowed-tools` is not allowed",
  ],
  [
    "a shipped skill with an unknown metadata key",
    shippedProbe,
    skill(`${probeMeta}\nmetadata:\n  owner: someone`),
    "frontmatter field `metadata.owner` is not allowed",
  ],
  [
    "a shipped skill whose frontmatter is not valid YAML",
    shippedProbe,
    skill(`${probeMeta}\nlicense: [unclosed`),
    "frontmatter must be valid YAML",
  ],
  [
    "a shipped skill over the size budget in bytes",
    shippedProbe,
    skill(probeMeta, oversizedBody),
    `SKILL.md is ${Buffer.byteLength(skill(probeMeta, oversizedBody))} bytes, over the ${skillBytesBudget}-byte budget`,
  ],
  [
    "a repo-local skill over the size budget",
    repoProbe,
    skill(probeMeta, "x".repeat(skillBytesBudget)),
    `SKILL.md is ${skillBytesBudget + skill(probeMeta, "").length} bytes, over the ${skillBytesBudget}-byte budget`,
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
