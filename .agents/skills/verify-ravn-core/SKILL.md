---
name: verify-ravn-core
description: Run real user workflows for a plugin in its supported harnesses and keep the evidence. Use after any plugin skill or bundled-script change, before release, or when asked to verify or dogfood. Structural checks belong to the validate skill.
argument-hint: "[feature-id|plugin|all]"
---

Drive each plugin as a user and keep behavioral proof; `validate` owns structural checks.

Feature recipes live in `features/`. Read `features/README.md`, then the file for each feature in scope. With no argument, verify the features whose plugin differs from `origin/main`, counting uncommitted changes. `all` runs every feature.

Paths in feature files are relative to this skill's directory. Run every command from the repo root after `pnpm install`.

## Launch

Use one run ID per pass:

```bash
export RUN_ID=$(date +%Y%m%d-%H%M%S)
```

Run `ravn-core` features, bundled scripts, and repo commands through the collector:

```bash
node .agents/skills/verify-ravn-core/scripts/collect.ts <feature-id> <command> [args...]
```

`evals/run.ts` creates and deletes its temp workspace and isolated Codex `HOME`. Run bare `pnpm eval` or `pnpm eval:compare` within the user's authorization for that run; both spend tokens on every runner. Read-only inspection and local checks need no extra approval.

Mods act only in an interactive terminal, so the collector cannot show them. Drive a live `claude` session in tmux instead, as `features/skill-nudge.md` does.

## Doctor

```bash
node .agents/skills/verify-ravn-core/scripts/doctor.ts   # read-only
```

Require exit 0. Doctor prints the revision, uncommitted files, and tool versions, checks Node 24 or later, pnpm, and promptfoo, and validates the marketplace and every plugin. It fails when `codex`, `pi`, or `gh` is installed but not logged in, and skips each one that is absent; features that need a skipped tool report as unverified.

Pi checks the `openai` provider by default. For a different authenticated provider, set `RAVN_VERIFY_PI_PROVIDER` when running doctor and pass that same provider with an explicit model to each manual Pi run (`--provider <provider> --model <model>`). Record both names in the evidence. This selection does not change the fixed promptfoo runner matrix.

## Drive

Follow the feature file through the public skill entry with fixtures unedited. For headless recipes, supply the needed decisions; an unexpected question fails the attempt: tighten the prompt and record both attempts. Diagnose failures within scope; report withheld access or protected prerequisites as blockers. Reuse passing paths unless relevant inputs or artifacts changed.

## Evidence

The collector writes to `.verify/$RUN_ID/<feature-id>/`, which is gitignored.

`collect.ts` keeps `run.json` (command, exit code, commit), `stdout.txt`, `stderr.txt`, and a copy of `evals/results/` when the command refreshed it. `evals/run.ts` wipes `evals/results/` on every run, so only the `.verify/` copy counts.

Keep feature proof, such as screenshots and `unzip` output, there. Lead the report with the result and evidence path; for each sub-feature ID, give pass or fail and the supporting line or command output. Check transcript side effects too: a forbidden command fails verification even if the files look right.

## Cleanup

```bash
node .agents/skills/verify-ravn-core/scripts/cleanup.ts $RUN_ID
```

It deletes `/tmp/ravn-verify/$RUN_ID`, keeping `.verify/$RUN_ID`, and refuses paths outside `/tmp/ravn-verify`. Clean failed attempts too. Done means every scoped sub-feature has a verdict or evidenced blocker and cleanup has preserved proof.

## Scratch repos

`scripts/scratch.ts` builds a scratch repo in a known state: `babysit <dir> [thread|approved|late|queue|no-skill|uncovered]` (a simulated PR, with `github-sim.ts` as `gh`), `bug-fix <dir>`, or `review-and-simplify <dir>`.

Keep the map current with the `maintain-verification-skill` skill when skills or features change.
