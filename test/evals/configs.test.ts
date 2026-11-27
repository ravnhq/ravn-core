import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import { z } from "zod";
import {
  fixtureNames,
  missingFixtures,
  privateDir,
} from "../../evals/workspace-repo.ts";
import { agentPluginDirs } from "../../scripts/plugins.ts";

const repoDir = join(import.meta.dirname, "..", "..");

const pluginsDir = join(repoDir, "plugins");

process.env.RAVN_EVALS_WORKSPACES ??= "/workspaces";

process.env.RAVN_EVALS_HOME ??= "/home";

process.env.OPENROUTER_API_KEY ??= "openrouter-key";

process.env.RAVN_EVALS_RUNNER ??= "claude-code/claude-sonnet-5-5";

const evalModuleSchema = z.object({
  default: z.object({
    tests: z.array(
      z.object({
        metadata: z.object({
          kind: z.string(),
          fixture: z.string(),
          invoked: z.boolean(),
          references: z.array(z.string()),
        }),
        vars: z.object({ request: z.string() }),
        assert: z.array(
          z.object({
            type: z.string(),
            metric: z.string().optional(),
            value: z.unknown(),
          }),
        ),
      }),
    ),
  }),
});

const fixtures = fixtureNames;

const skip = missingFixtures;

const skills = agentPluginDirs(pluginsDir).flatMap((dir) =>
  readdirSync(join(dir, "skills")).map((skill) => ({
    name: `${basename(dir)}/${skill}`,
    configPath: join(privateDir, basename(dir), skill, "promptfooconfig.ts"),
  })),
);

const skillNames = new Set(skills.map(({ name }) => name.split("/")[1]));

const caseKinds = ["quality", "trigger", "route", "stay-out"];

const requiredDisclosures = [
  "verification-skill/references/create.md",
  "verification-skill/references/maintain.md",
  "formal-verification-skill/references/create.md",
  "formal-verification-skill/references/maintain.md",
  "design/references/boundary-discipline.md",
  "design/references/type-system-discipline.md",
  "migrate/references/internal-callers.md",
  "migrate/references/build-the-lever.md",
  "ship/references/guard-the-context-window.md",
  "test/references/install.md",
  "test/references/prune.md",
  "statechart/references/view-model.md",
  "statechart/references/read-tlc-report.md",
];

test("private eval configs match the shipped catalog", { skip }, () => {
  const configs = agentPluginDirs(pluginsDir).flatMap((dir) => {
    const plugin = basename(dir);
    const cases = join(privateDir, plugin);

    return readdirSync(cases)
      .filter((skill) => existsSync(join(cases, skill, "promptfooconfig.ts")))
      .map((skill) => `${plugin}/${skill}`);
  });

  assert.deepEqual(configs.sort(), skills.map(({ name }) => name).sort());
});

const frontmatterSchema = z.object({
  "disable-model-invocation": z.boolean().default(false),
});

function parseInvocationPolicy(document: string) {
  const match = document.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);

  assert.ok(match, "missing skill frontmatter");

  return frontmatterSchema.parse(parse(match[1] ?? ""));
}

function invocationPolicy(skillPath: string) {
  return parseInvocationPolicy(readFileSync(skillPath, "utf8"));
}

test("invocation policy follows YAML boolean semantics", () => {
  for (const frontmatter of [
    "disable-model-invocation: true",
    '"disable-model-invocation": true',
    "disable-model-invocation: TRUE # explicit invocation only",
  ]) {
    assert.equal(
      parseInvocationPolicy(`---\n${frontmatter}\n---\n`)[
        "disable-model-invocation"
      ],
      true,
    );
  }

  for (const frontmatter of [
    "disable-model-invocation: false",
    "description: 'disable-model-invocation: true'",
    "name: example",
  ]) {
    assert.equal(
      parseInvocationPolicy(`---\n${frontmatter}\n---\n`)[
        "disable-model-invocation"
      ],
      false,
    );
  }

  assert.throws(() =>
    parseInvocationPolicy('---\ndisable-model-invocation: "true"\n---\n'),
  );
});

type EvalTest = z.infer<typeof evalModuleSchema>["default"]["tests"][number];

function nativeQuality(skill: string, tests: EvalTest[]) {
  return tests.some(
    ({ metadata, assert: assertions }) =>
      metadata.kind === "quality" &&
      !metadata.invoked &&
      assertions.some(({ type, value }) => {
        if (type === "skill-used") return value === skill;

        if (type !== "trajectory:step-count") return false;

        const trace = z
          .object({ pattern: z.string(), min: z.number() })
          .safeParse(value);

        return (
          trace.success &&
          trace.data.min === 1 &&
          trace.data.pattern === `*${skill}/SKILL.md*`
        );
      }),
  );
}

// Skills a case asserts stay unused: `not-skill-used`, or on Codex a traced
// SKILL.md read capped at zero.
function unusedSkills(testCase: EvalTest) {
  return testCase.assert.flatMap((assertion) => {
    if (assertion.type === "not-skill-used") {
      return z.union([z.string(), z.array(z.string())]).parse(assertion.value);
    }

    if (assertion.type !== "trajectory:step-count") {
      return [];
    }

    const trace = z
      .object({ pattern: z.string(), max: z.number().optional() })
      .parse(assertion.value);

    const skill = trace.pattern.match(/^\*(.+)\/SKILL\.md\*$/)?.[1];

    return trace.max === 0 && skill !== undefined ? [skill] : [];
  });
}

function staysOutOfItself(skill: string, tests: EvalTest[]) {
  return tests.some(
    (testCase) =>
      testCase.metadata.kind === "stay-out" &&
      unusedSkills(testCase).includes(skill),
  );
}

test("a stay-out case must assert the skill under test stays unused", () => {
  const stayOut = (assertion: EvalTest["assert"][number]): EvalTest => ({
    metadata: {
      kind: "stay-out",
      fixture: "repo-a",
      invoked: false,
      references: [],
    },
    vars: { request: "list the recent commits" },
    assert: [assertion],
  });

  assert.ok(
    staysOutOfItself("why", [
      stayOut({ type: "not-skill-used", value: ["why", "how"] }),
    ]),
  );
  assert.ok(
    staysOutOfItself("why", [
      stayOut({
        type: "trajectory:step-count",
        value: { type: "command", pattern: "*why/SKILL.md*", max: 0 },
      }),
    ]),
  );
  assert.ok(
    !staysOutOfItself("why", [
      stayOut({ type: "not-skill-used", value: ["how"] }),
    ]),
  );
  assert.ok(
    !staysOutOfItself("why", [
      stayOut({
        type: "trajectory:step-count",
        value: { type: "command", pattern: "*why/SKILL.md*", min: 1 },
      }),
    ]),
  );
});

async function loadTests(configPath: string) {
  return evalModuleSchema.parse(await import(configPath)).default.tests;
}

test("every required disclosed file has both trigger and quality coverage", {
  skip,
}, async () => {
  const covered = new Map<string, Set<string>>();

  for (const { name, configPath } of skills) {
    const [plugin] = name.split("/");

    for (const { metadata, assert: assertions } of await loadTests(
      configPath,
    )) {
      for (const path of metadata.references) {
        assert.match(
          path,
          /^[\w-]+\/(?:SKILL\.md|references\/(?:[\w-]+\/)*[\w.-]+\.md)$/,
          `${name}: invalid disclosed path`,
        );
        const file = join(pluginsDir, "agent", plugin ?? "", "skills", path);

        assert.ok(
          existsSync(file) && statSync(file).isFile(),
          `${name}: missing ${path}`,
        );
        const declaration = covered.get(path) ?? new Set<string>();
        declaration.add(metadata.kind);
        covered.set(path, declaration);

        const measured = assertions.filter(
          ({ type, metric }) =>
            type === "javascript" && metric === "reference-read",
        );

        assert.ok(
          measured.length >= metadata.references.length,
          `${name}: references need execution assertions`,
        );
      }
    }
  }

  for (const path of requiredDisclosures) {
    for (const kind of ["quality", "trigger"]) {
      assert.ok(
        covered.get(path)?.has(kind),
        `${path} lacks a ${kind} disclosure case`,
      );
    }
  }
});

for (const { name, configPath } of skills) {
  test(`${name} has an eval config`, { skip }, () => {
    assert.ok(existsSync(configPath), `missing ${configPath}`);
  });

  test(`${name} grades at least one case on every arm`, { skip }, async () => {
    const tests = await loadTests(configPath);

    assert.ok(tests.some((testCase) => testCase.metadata.kind === "quality"));
  });

  test(`${name} has native quality coverage if model-invocable`, {
    skip,
  }, async () => {
    const [plugin, skill] = name.split("/");

    const policy = invocationPolicy(
      join(
        pluginsDir,
        "agent",
        plugin ?? "",
        "skills",
        skill ?? "",
        "SKILL.md",
      ),
    );

    if (policy["disable-model-invocation"]) return;

    const tests = await loadTests(configPath);
    assert.ok(
      nativeQuality(skill ?? "", tests),
      `${name} needs an uninvoked quality case that asserts entry selection`,
    );
  });

  test(`${name} covers every case kind and routes to a sibling`, {
    skip,
  }, async () => {
    const tests = await loadTests(configPath);

    for (const kind of caseKinds) {
      assert.ok(
        tests.some((testCase) => testCase.metadata.kind === kind),
        `${name} lacks a ${kind} case`,
      );
    }

    assert.ok(
      staysOutOfItself(name.split("/")[1] ?? "", tests),
      `${name} needs a stay-out case that asserts it stays unused`,
    );

    for (const route of tests.filter(
      (testCase) => testCase.metadata.kind === "route",
    )) {
      const targets = route.assert.flatMap((assertion) => {
        if (assertion.type === "skill-used") {
          return [z.string().parse(assertion.value)];
        }

        if (assertion.type !== "trajectory:step-count") {
          return [];
        }

        const trace = z
          .object({ pattern: z.string(), min: z.number().optional() })
          .parse(assertion.value);

        return trace.min === 1
          ? [trace.pattern.match(/^\*(.+)\/SKILL\.md\*$/)?.[1]]
          : [];
      });

      assert.equal(targets.length, 1, `${name} route needs one target`);
      const target = z.string().parse(targets[0]);

      assert.ok(skillNames.has(target));
      assert.notEqual(target, name.split("/")[1]);

      const plugin = name.split("/")[0];

      const policy = invocationPolicy(
        join(pluginsDir, "agent", plugin ?? "", "skills", target, "SKILL.md"),
      );

      assert.ok(
        !policy["disable-model-invocation"],
        `${name} must route to a model-invocable sibling; skill-used cannot trace explicit commands`,
      );
    }
  });

  test(`${name} covers its invocation policy`, { skip }, async () => {
    const [plugin, skill] = name.split("/");

    const policy = invocationPolicy(
      join(
        pluginsDir,
        "agent",
        plugin ?? "",
        "skills",
        skill ?? "",
        "SKILL.md",
      ),
    );

    const userOnly = policy["disable-model-invocation"];

    const tests = await loadTests(configPath);

    const triggers = tests.filter(
      (testCase) => testCase.metadata.kind === "trigger",
    );

    assert.ok(
      triggers.some(({ metadata }) => metadata.invoked === userOnly),
      `${name} needs a ${userOnly ? "user-only" : "native"} trigger`,
    );

    for (const trigger of triggers) {
      const invoked = [`/${skill} `, `$${skill} `, `/skill:${skill} `].some(
        (prefix) => trigger.vars.request.startsWith(prefix),
      );

      assert.equal(
        invoked,
        trigger.metadata.invoked,
        `${name} trigger prompt must match its invocation metadata`,
      );

      if (userOnly) assert.ok(invoked, `${name} cannot have a native trigger`);
    }
  });

  test(`${name} requests never name the fixture repo`, { skip }, async () => {
    for (const testCase of await loadTests(configPath)) {
      for (const fixture of fixtures) {
        assert.doesNotMatch(
          testCase.vars.request,
          new RegExp(`\\b${fixture.replaceAll("-", "[- ]?")}\\b`, "i"),
          `request mentions "${fixture}": ${testCase.vars.request}`,
        );
      }
    }
  });
}
