#!/usr/bin/env node
// Validate the resolved Jest settings or the explicit Bun/Node command options.
// Usage: check-runner.ts jest|bun|node [runner options]
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";

const [runner, ...options] = process.argv.slice(2);

let failures = 0;

function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);

  if (!ok) failures += 1;
}

const filters = [
  "--only",
  "--test-only",
  "--test-name-pattern",
  "--test-skip-pattern",
  "--test-rerun-failures",
  "--retry",
  "--onlyFailures",
  "--onlyChanged",
  "--testNamePattern",
  "--findRelatedTests",
  "--changedSince",
  "--lastCommit",
  "-t",
  "-o",
  "-f",
];

check(
  "Command runs the full suite on its first attempt",
  !options.some(
    (option) =>
      filters.some(
        (filter) => option === filter || option.startsWith(`${filter}=`),
      ) && option !== "--retry=0",
  ),
);

if (runner === "jest") {
  let entry: string;

  try {
    entry = createRequire(join(process.cwd(), "package.json")).resolve(
      "jest/bin/jest",
    );
  } catch {
    console.error(
      "Jest does not resolve from this package. Install it before checking its configuration.",
    );
    process.exit(2);
  }

  const run = spawnSync(process.execPath, [entry, ...options, "--showConfig"], {
    encoding: "utf8",
  });

  if (run.status !== 0) {
    console.error(run.stderr || run.error?.message);
    process.exit(2);
  }

  type Config = {
    globalConfig: {
      randomize?: boolean;
      showSeed?: boolean;
      passWithNoTests?: boolean;
    };
    configs: {
      restoreMocks?: boolean;
      clearMocks?: boolean;
      resetMocks?: boolean;
    }[];
  };

  const config: Config = JSON.parse(run.stdout);
  check("Jest randomizes test order", config.globalConfig.randomize === true);
  check("Jest prints its shuffle seed", config.globalConfig.showSeed === true);
  check(
    "Jest fails an empty run",
    config.globalConfig.passWithNoTests === false,
  );
  check(
    "Every Jest project restores mocks",
    config.configs.length > 0 &&
      config.configs.every((project) => project.restoreMocks === true),
  );
  check(
    "Every Jest project clears mock state",
    config.configs.length > 0 &&
      config.configs.every(
        (project) => project.clearMocks === true || project.resetMocks === true,
      ),
  );
  console.log(
    "Focus, skip, and retry APIs are enforced by the lint self-check.",
  );
} else if (runner === "bun" || runner === "node") {
  const executable = runner === "bun" ? "bun" : process.execPath;

  const help = spawnSync(
    executable,
    runner === "bun" ? ["test", "--help"] : ["--help"],
    { encoding: "utf8" },
  );

  if (help.status !== 0) {
    console.error(help.error?.message || help.stderr);
    process.exit(2);
  }

  const randomize = runner === "bun" ? "--randomize" : "--test-randomize";

  if (help.stdout.includes(randomize)) {
    check(
      `${runner} command enables ${randomize}`,
      options.includes(randomize) &&
        !options.some(
          (option) =>
            option === randomize.replace("--", "--no-") ||
            option === `${randomize}=false`,
        ),
    );
  } else {
    console.log(
      `${runner}: this version has no ${randomize}; repeats run in fresh processes with declaration order.`,
    );
  }

  if (runner === "bun") {
    check(
      "Bun supports an explicit zero retry count",
      help.stdout.includes("--retry"),
    );
    check("Bun command sets --retry=0", options.includes("--retry=0"));
    check(
      "Bun command fails when no tests are discovered",
      !options.some((option) => option.startsWith("--pass-with-no-tests")),
    );
    console.log(
      "Bun focus and skip APIs are enforced by lint. Restore mocks and globals in afterEach hooks.",
    );
  } else {
    console.log(
      "Node focus and skip APIs are enforced by lint. Node permits empty runs; verify discovery in the suite output. Test-context mocks restore automatically; restore environment changes in afterEach hooks.",
    );
  }

  console.log(
    `Checked options: ${executable} ${runner === "bun" ? "test" : "--test"} ${options.join(" ")}`,
  );
} else {
  console.error("Usage: check-runner.ts jest|bun|node [runner options]");
  process.exit(2);
}

process.exit(failures === 0 ? 0 : 1);
