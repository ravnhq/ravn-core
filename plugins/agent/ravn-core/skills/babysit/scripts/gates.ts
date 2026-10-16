import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import type { Run } from "./watch-pr.ts";

// The ruleset parameters this script summarizes. The output also carries
// every rule whole, so parameters it does not summarize still reach the agent.
type Rule = {
  type: string;
  ruleset_id?: number;
  parameters?: {
    required_approving_review_count?: number;
    require_code_owner_review?: boolean;
    require_last_push_approval?: boolean;
    allowed_merge_methods?: string[];
    required_review_thread_resolution?: boolean;
    required_status_checks?: { context: string }[];
  };
};

type PullRequestRule = Exclude<Rule["parameters"], undefined>;

type GateQuery = {
  data: {
    repository: {
      mergeCommitAllowed: boolean;
      squashMergeAllowed: boolean;
      rebaseMergeAllowed: boolean;
      viewerDefaultMergeMethod: string;
      pullRequest: {
        number: number;
        headRefOid: string;
        baseRefName: string;
        reviewDecision: string | null;
        isMergeQueueEnabled: boolean;
        commits: {
          nodes: {
            commit: {
              statusCheckRollup: {
                contexts: {
                  pageInfo: { hasNextPage: boolean };
                  nodes: {
                    name?: string;
                    context?: string;
                    isRequired: boolean;
                  }[];
                };
              } | null;
            };
          }[];
        };
      };
    };
  };
};

const query = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    mergeCommitAllowed squashMergeAllowed rebaseMergeAllowed
    viewerDefaultMergeMethod
    pullRequest(number: $number) {
      number headRefOid baseRefName reviewDecision isMergeQueueEnabled
      commits(last: 1) { nodes { commit { statusCheckRollup {
        contexts(first: 100) { pageInfo { hasNextPage } nodes {
          ... on CheckRun { name isRequired(pullRequestNumber: $number) }
          ... on StatusContext { context isRequired(pullRequestNumber: $number) }
        } }
      } } } }
    }
  }
}`;

// Files where repositories state merge rules that no API exposes.
const gateFiles = [
  "CONTRIBUTING.md",
  ".github/CONTRIBUTING.md",
  "docs/CONTRIBUTING.md",
  ".github/pull_request_template.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  "PULL_REQUEST_TEMPLATE.md",
  "CODEOWNERS",
  ".github/CODEOWNERS",
  "docs/CODEOWNERS",
  "AGENTS.md",
  "CLAUDE.md",
];

function gh(run: Run, args: string[]): string {
  const result = run(args);

  if (result.status !== 0)
    throw new Error(
      "gh " + args.slice(0, 2).join(" ") + " failed: " + result.stderr.trim(),
    );

  return result.stdout;
}

function pullRequestRules(branchRules: Rule[]): PullRequestRule[] {
  return branchRules.flatMap((rule) =>
    rule.type === "pull_request" && rule.parameters !== undefined
      ? [rule.parameters]
      : [],
  );
}

function rulesetChecks(branchRules: Rule[]): string[] {
  return branchRules.flatMap((rule) =>
    rule.type === "required_status_checks"
      ? (rule.parameters?.required_status_checks ?? []).map(
          (check) => check.context,
        )
      : [],
  );
}

// A method must be enabled on the repository and allowed by every ruleset
// that restricts methods.
function allowedMethods(
  repository: GateQuery["data"]["repository"],
  reviewRules: PullRequestRule[],
): string[] {
  const enabled = [
    ...(repository.squashMergeAllowed ? ["squash"] : []),
    ...(repository.mergeCommitAllowed ? ["merge"] : []),
    ...(repository.rebaseMergeAllowed ? ["rebase"] : []),
  ];

  return enabled.filter((method) =>
    reviewRules.every(
      (rule) =>
        rule.allowed_merge_methods === undefined ||
        rule.allowed_merge_methods.includes(method),
    ),
  );
}

export function discoverGates(pr: string, tracked: string[], run: Run) {
  const view: { url: string } = JSON.parse(
    gh(run, ["pr", "view", pr, "--json", "url"]),
  );

  const [owner = "", repo = ""] = new URL(view.url).pathname
    .split("/")
    .slice(1, 3);

  const facts: GateQuery = JSON.parse(
    gh(run, [
      "api",
      "graphql",
      "-f",
      "query=" + query,
      "-F",
      "owner=" + owner,
      "-F",
      "repo=" + repo,
      "-F",
      "number=" + new URL(view.url).pathname.split("/")[4],
    ]),
  );

  const repository = facts.data.repository;
  const pull = repository.pullRequest;

  // --slurp wraps every page in one array, so no rule past the first page is lost.
  const pages: Rule[][] = JSON.parse(
    gh(run, [
      "api",
      "--paginate",
      "--slurp",
      "repos/" +
        owner +
        "/" +
        repo +
        "/rules/branches/" +
        encodeURIComponent(pull.baseRefName),
    ]),
  );

  const branchRules = pages.flat();

  const rollup = pull.commits.nodes[0]?.commit.statusCheckRollup?.contexts;
  const contexts = rollup?.nodes ?? [];

  const requiredChecks = [
    ...new Set([
      ...contexts.flatMap((check) =>
        check.isRequired ? [check.name ?? check.context ?? ""] : [],
      ),
      ...rulesetChecks(branchRules),
    ]),
  ].filter((name) => name !== "");

  const reviewRules = pullRequestRules(branchRules);

  const approvals = reviewRules.map(
    (rule) => rule.required_approving_review_count ?? 0,
  );

  const mergeMethods = allowedMethods(repository, reviewRules);
  const viewerDefault = repository.viewerDefaultMergeMethod.toLowerCase();

  return {
    pr: pull.number,
    head: pull.headRefOid,
    base: pull.baseRefName,
    mergeMethods,
    // The viewer's usual method, when the gates still allow it.
    defaultMergeMethod: mergeMethods.includes(viewerDefault)
      ? viewerDefault
      : (mergeMethods[0] ?? null),
    mergeQueue:
      pull.isMergeQueueEnabled ||
      branchRules.some((rule) => rule.type === "merge_queue"),
    requiredChecks,
    // False when the head has over 100 checks, so the check flags were cut off.
    requiredChecksComplete: rollup?.pageInfo.hasNextPage !== true,
    reviews: {
      decision: pull.reviewDecision,
      requiredApprovals: approvals.length === 0 ? null : Math.max(...approvals),
      codeOwnerReview: reviewRules.some(
        (rule) => rule.require_code_owner_review === true,
      ),
      lastPushApproval: reviewRules.some(
        (rule) => rule.require_last_push_approval === true,
      ),
      threadResolution: reviewRules.some(
        (rule) => rule.required_review_thread_resolution === true,
      ),
    },
    // Every rule that applies to the base, whole, including ones summarized above.
    rules: branchRules,
    // Classic branch protection is readable only by admins; GitHub still
    // enforces it, and the watcher sees it through mergeStateStatus.
    classicProtection: "not readable without admin; enforced at merge",
    files: gateFiles.filter((file) => tracked.includes(file)),
    // Committed verify-<app> skills with a feature map, which a verifier drives
    // before a merge. Hidden directories such as .agents count.
    verificationSkills: tracked.flatMap((file) => {
      const map = /^(.*\bskills\/verify-[^/]+)\/features\/README\.md$/.exec(
        file,
      );

      return map ? [map[1]] : [];
    }),
    workflows: tracked.filter((file) =>
      /^\.github\/workflows\/[^/]+\.ya?ml$/.test(file),
    ),
  };
}

function main() {
  try {
    const { positionals } = parseArgs({ allowPositionals: true });
    const [pr] = positionals;

    if (pr === undefined || positionals.length !== 1)
      throw new Error("Usage: node gates.ts <PR-url|number>");

    const tracked = spawnSync("git", ["ls-files", "--full-name", ":/"], {
      encoding: "utf8",
    });

    if (tracked.status !== 0)
      throw new Error("Run from inside the PR's repository.");

    const run: Run = (args) => {
      const result = spawnSync("gh", args, {
        encoding: "utf8",
        timeout: 60_000,
      });

      if (result.error !== undefined) throw result.error;

      return result;
    };

    console.log(
      JSON.stringify(
        discoverGates(pr, tracked.stdout.split("\n"), run),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
)
  main();
