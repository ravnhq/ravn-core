import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { inspectCI } from "../../../plugins/agent/ravn-core/skills/ship/scripts/check-ci.ts";

const sha = "a".repeat(40);

const green = {
  name: "build",
  state: "SUCCESS",
  bucket: "pass",
  link: "https://example.com/build",
};

function inspect(
  checks: (typeof green)[],
  options: {
    response?: string;
    changed?: boolean;
    status?: number;
    expected?: string[];
    skipped?: string[];
  } = {},
) {
  let reads = 0;

  return inspectCI(
    "42",
    options.expected ?? ["build"],
    options.skipped ?? [],
    (args) => {
      if (args[1] === "view") {
        reads += 1;

        return {
          status: 0,
          stdout: JSON.stringify({
            headRefOid: reads > 1 && options.changed ? "b".repeat(40) : sha,
          }),
          stderr: "",
        };
      }

      return {
        status: options.status ?? 0,
        stdout: options.response ?? JSON.stringify(checks),
        stderr: "API unavailable",
      };
    },
  );
}

test("green checks produce evidence pinned to a stable PR head", () => {
  const result = inspect([green]);
  assert.equal(result.passed, true);
  assert.equal(result.head, sha);
  assert.deepEqual(result.checks, [green]);
});

test("failures outside the expected list also block delivery", () => {
  const result = inspect([
    green,
    { ...green, name: "ratchet", state: "FAILURE", bucket: "fail" },
  ]);

  assert.equal(result.passed, false);
  assert.match(result.blockers.join("\n"), /ratchet: FAILURE/);
});

test("pending, cancelled, skipped, neutral, and unknown results are incomplete", () => {
  for (const [state, bucket] of [
    ["PENDING", "pending"],
    ["CANCELLED", "cancel"],
    ["SKIPPED", "skipping"],
    ["NEUTRAL", "pass"],
    ["UNKNOWN", "pass"],
  ]) {
    assert.equal(
      inspect([{ ...green, state, bucket }], {
        status: state === "PENDING" ? 8 : 0,
      }).passed,
      false,
      state,
    );
  }
});

test("absent expected checks and empty check lists cannot pass", () => {
  assert.equal(inspect([]).passed, false);
  assert.equal(
    inspect([green], { expected: ["build", "security"] }).passed,
    false,
  );
  assert.throws(() => inspect([green], { expected: [] }), /--expect/);
});

test("a changed head invalidates green evidence", () => {
  const result = inspect([green], { changed: true });
  assert.equal(result.passed, false);
  assert.match(result.blockers.join("\n"), /head changed/);
});

test("only explicitly allowed skips pass, and approval never excuses failures", () => {
  const skipped = {
    ...green,
    name: "docs",
    state: "SKIPPED",
    bucket: "skipping",
  };

  assert.equal(inspect([green, skipped], { skipped: ["docs"] }).passed, true);
  assert.equal(
    inspect([green, { ...skipped, state: "FAILURE", bucket: "fail" }], {
      skipped: ["docs"],
    }).passed,
    false,
  );
});

test("inspection errors and malformed responses fail closed", () => {
  assert.throws(() => inspect([green], { status: 1 }), /API unavailable/);
  assert.throws(() => inspect([], { response: "{}" }), /Invalid check list/);
  assert.throws(
    () => inspect([], { response: '[{"name":"build"}]' }),
    /Invalid check field/,
  );
  assert.throws(
    () =>
      inspectCI("42", ["build"], [], () => ({
        status: 0,
        stdout: "{}",
        stderr: "",
      })),
    /Invalid PR head/,
  );
});

test("the CLI executes through an installed skill directory link", () => {
  const root = mkdtempSync(join(tmpdir(), "ship-ci-link-"));

  try {
    symlinkSync(
      join(
        import.meta.dirname,
        "../../../plugins/agent/ravn-core/skills/ship/scripts",
      ),
      join(root, "linked"),
      "junction",
    );

    const result = spawnSync(
      process.execPath,
      [join(root, "linked/check-ci.ts")],
      {
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Usage/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
