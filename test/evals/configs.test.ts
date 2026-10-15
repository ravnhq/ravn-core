import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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
        metadata: z.object({ kind: z.string(), fixture: z.string() }),
        vars: z.object({ request: z.string() }),
        assert: z.array(z.object({ type: z.string(), value: z.unknown() })),
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

async function loadTests(configPath: string) {
  return evalModuleSchema.parse(await import(configPath)).default.tests;
}

for (const { name, configPath } of skills) {
  test(`${name} has an eval config`, { skip }, () => {
    assert.ok(existsSync(configPath), `missing ${configPath}`);
  });

  test(`${name} grades at least one case on every arm`, { skip }, async () => {
    const tests = await loadTests(configPath);

    assert.ok(tests.some((testCase) => testCase.metadata.kind === "quality"));
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

  test(`${name} invokes user-only trigger commands`, { skip }, async () => {
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

    for (const trigger of triggers) {
      const invoked = [`/${skill} `, `$${skill} `, `/skill:${skill} `].some(
        (prefix) => trigger.vars.request.startsWith(prefix),
      );

      assert.equal(
        invoked,
        userOnly,
        `${name} trigger must match its invocation policy`,
      );
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
