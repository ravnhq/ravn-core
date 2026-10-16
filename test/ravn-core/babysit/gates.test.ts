import assert from "node:assert/strict";
import { test } from "node:test";
import { discoverGates } from "../../../plugins/agent/ravn-core/skills/babysit/scripts/gates.ts";
import type { Run } from "../../../plugins/agent/ravn-core/skills/babysit/scripts/watch-pr.ts";

function fakeGh(
  rules: object[][],
  mergeQueue = false,
  moreChecks = false,
): Run {
  return (args) => {
    const ok = (stdout: string) => ({ status: 0, stderr: "", stdout });

    if (args[0] === "pr")
      return ok(JSON.stringify({ url: "https://github.com/acme/app/pull/7" }));

    if (args[1] === "graphql")
      return ok(
        JSON.stringify({
          data: {
            repository: {
              mergeCommitAllowed: false,
              squashMergeAllowed: true,
              rebaseMergeAllowed: true,
              viewerDefaultMergeMethod: "SQUASH",
              pullRequest: {
                number: 7,
                headRefOid: "a".repeat(40),
                baseRefName: "release/1.x",
                reviewDecision: "REVIEW_REQUIRED",
                isMergeQueueEnabled: mergeQueue,
                commits: {
                  nodes: [
                    {
                      commit: {
                        statusCheckRollup: {
                          contexts: {
                            pageInfo: { hasNextPage: moreChecks },
                            nodes: [
                              { name: "build", isRequired: true },
                              { name: "lint", isRequired: false },
                              { context: "ci/legacy", isRequired: true },
                            ],
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      );

    assert.deepEqual(args.slice(1, 3), ["--paginate", "--slurp"]);
    assert.equal(args[3], "repos/acme/app/rules/branches/release%2F1.x");

    return ok(JSON.stringify(rules));
  };
}

const tracked = [
  "src/index.ts",
  "CONTRIBUTING.md",
  ".github/CODEOWNERS",
  ".github/workflows/ci.yml",
  ".github/workflows/nested/skip.yml",
  ".github/workflows/README.md",
  ".agents/skills/verify-app/SKILL.md",
  ".agents/skills/verify-app/features/README.md",
  ".claude/skills/verify-docs/SKILL.md",
  "skills/verify-old/SKILL.md",
];

test("required checks combine check flags and ruleset contexts across pages", () => {
  const gates = discoverGates(
    "7",
    tracked,
    fakeGh([
      [{ type: "deletion" }],
      [
        {
          type: "required_status_checks",
          parameters: {
            required_status_checks: [{ context: "build" }, { context: "e2e" }],
          },
        },
      ],
    ]),
  );

  assert.deepEqual(gates.requiredChecks.toSorted(), [
    "build",
    "ci/legacy",
    "e2e",
  ]);
});

test("review rules, merge queue, and every rule come from the repository", () => {
  const gates = discoverGates(
    "7",
    tracked,
    fakeGh([
      [
        {
          type: "pull_request",
          parameters: {
            required_approving_review_count: 2,
            require_code_owner_review: true,
            require_last_push_approval: true,
            required_review_thread_resolution: false,
          },
        },
        { type: "merge_queue" },
        { type: "required_linear_history" },
        { type: "code_scanning", parameters: { code_scanning_tools: [] } },
      ],
    ]),
  );

  assert.equal(gates.mergeQueue, true);
  assert.equal(gates.reviews.lastPushApproval, true);
  assert.equal(gates.reviews.requiredApprovals, 2);
  assert.equal(gates.reviews.codeOwnerReview, true);
  assert.equal(gates.reviews.threadResolution, false);
  assert.deepEqual(
    gates.rules.map((rule) => rule.type),
    ["pull_request", "merge_queue", "required_linear_history", "code_scanning"],
  );
  assert.deepEqual(gates.rules[3]?.parameters, { code_scanning_tools: [] });
});

test("no rulesets means no ruleset gates, not an error", () => {
  const gates = discoverGates("7", tracked, fakeGh([[]]));

  assert.equal(gates.mergeQueue, false);
  assert.equal(gates.requiredChecksComplete, true);
  assert.equal(gates.reviews.requiredApprovals, null);
  assert.deepEqual(gates.requiredChecks.toSorted(), ["build", "ci/legacy"]);
});

test("over 100 checks marks the required check list incomplete", () => {
  const gates = discoverGates("7", tracked, fakeGh([[]], false, true));

  assert.equal(gates.requiredChecksComplete, false);
});

test("gate files and top-level workflows come from tracked files", () => {
  const gates = discoverGates("7", tracked, fakeGh([[]]));

  assert.deepEqual(gates.files, ["CONTRIBUTING.md", ".github/CODEOWNERS"]);
  assert.deepEqual(gates.workflows, [".github/workflows/ci.yml"]);
});

test("verification skills are committed verify skills with a feature map", () => {
  const gates = discoverGates("7", tracked, fakeGh([[]]));

  assert.deepEqual(gates.verificationSkills, [".agents/skills/verify-app"]);
});

test("merge methods are the repository's, narrowed by every ruleset", () => {
  const open = discoverGates("7", tracked, fakeGh([[]]));

  assert.deepEqual(open.mergeMethods, ["squash", "rebase"]);
  assert.equal(open.defaultMergeMethod, "squash");

  const rebaseOnly = discoverGates(
    "7",
    tracked,
    fakeGh([
      [
        {
          type: "pull_request",
          parameters: { allowed_merge_methods: ["rebase", "merge"] },
        },
      ],
    ]),
  );

  assert.deepEqual(rebaseOnly.mergeMethods, ["rebase"]);
  assert.equal(rebaseOnly.defaultMergeMethod, "rebase");
});
