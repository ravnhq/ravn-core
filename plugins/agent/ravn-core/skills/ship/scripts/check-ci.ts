import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

type Check = { name: string; state: string; bucket: string; link: string };

// SAFETY: these literal keys belong to every validated Check.
const checkFields = ["name", "state", "bucket", "link"] as const;

type Run = (args: string[]) => {
  status: number | null;
  stdout: string;
  stderr: string;
};

function head(pr: string, run: Run): string {
  const result = run(["pr", "view", pr, "--json", "headRefOid"]);

  if (result.status !== 0)
    throw new Error(result.stderr || "Cannot read PR head.");
  const payload: { headRefOid: string } = JSON.parse(result.stdout);
  assert.match(payload.headRefOid, /^[a-f0-9]{40}$/, "Invalid PR head SHA.");
  const value = payload.headRefOid;

  return value;
}

export function inspectCI(
  pr: string,
  expected: string[],
  allowedSkipped: string[],
  run: Run,
) {
  if (expected.length === 0)
    throw new Error(
      "Provide at least one --expect check name from the CI workflows.",
    );
  const initialHead = head(pr, run);
  const result = run(["pr", "checks", pr, "--json", "name,state,bucket,link"]);

  // gh uses 8 for pending checks. Other nonzero exits are inspection errors.
  if (result.status !== 0 && result.status !== 8) {
    throw new Error(result.stderr || "Cannot inspect PR checks.");
  }

  const checks: Check[] = JSON.parse(result.stdout);
  assert.ok(Array.isArray(checks), "Invalid check list.");

  for (const check of checks) {
    assert.ok(check !== null, "Invalid check object.");

    for (const key of checkFields) {
      assert.equal(
        Object.prototype.toString.call(check[key]),
        "[object String]",
        "Invalid check field: " + key + ".",
      );
    }
  }

  const blockers: string[] = [];

  if (checks.length === 0) blockers.push("No checks reported.");

  for (const name of expected) {
    if (!checks.some((check) => check.name === name))
      blockers.push("Missing check: " + name);
  }

  for (const check of checks) {
    const passed = check.bucket === "pass" && check.state === "SUCCESS";

    const skipped =
      check.bucket === "skipping" &&
      check.state === "SKIPPED" &&
      allowedSkipped.includes(check.name);

    if (!passed && !skipped)
      blockers.push(
        check.name + ": " + check.state + " (" + check.bucket + ")",
      );
  }

  const finalHead = head(pr, run);

  if (initialHead !== finalHead)
    blockers.push("PR head changed during inspection; run the gate again.");

  return {
    pr,
    head: initialHead,
    currentHead: finalHead,
    checks,
    blockers,
    passed: blockers.length === 0,
  };
}

function main() {
  try {
    const { positionals, values } = parseArgs({
      allowPositionals: true,
      options: {
        expect: { type: "string", multiple: true },
        "allow-skipped": { type: "string", multiple: true },
      },
    });

    const [pr] = positionals;

    if (pr === undefined || positionals.length !== 1 || pr.startsWith("-")) {
      throw new Error(
        "Usage: node check-ci.ts <PR-url|number> --expect <check-name> [--allow-skipped <check-name>]",
      );
    }

    const report = inspectCI(
      pr,
      values.expect ?? [],
      values["allow-skipped"] ?? [],
      (args) => {
        const result = spawnSync("gh", args, {
          encoding: "utf8",
          timeout: 60_000,
        });

        if (result.error !== undefined) throw result.error;

        return result;
      },
    );

    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.passed ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
)
  main();
