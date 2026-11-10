---
name: verify-ravn-core
description: Run real user workflows for a plugin in its supported harnesses and keep the evidence. Use after any plugin skill or bundled-script change, before release, or when asked to verify or dogfood. Structural checks belong to the validate skill.
argument-hint: "[feature-id|plugin|all]"
---

Drive each plugin the way a user does, then keep proof of what it did. `validate` checks structure; this skill checks behavior.

Feature recipes live in `features/`. Read `features/README.md`, then the file for each feature in scope. With no argument, verify the features whose plugin differs from `origin/main`, counting uncommitted changes. `all` runs every feature.

Paths in feature files are relative to this skill's directory. Run every command from the repo root after `pnpm install`.

## Launch

There is no server. Pick one run ID per verification pass so every feature lands in one place:

```bash
export RUN_ID=$(date +%Y%m%d-%H%M%S)
```

Run `ravn-core` features, bundled scripts, and repo commands through the collector:

```bash
node .agents/skills/verify-ravn-core/scripts/collect.ts <feature-id> <command> [args...]
```

`evals/run.ts` builds and deletes its own temp workspace and isolated Codex `HOME`. Get the user's go-ahead before bare `pnpm eval` or `pnpm eval:compare`; both spend tokens on every runner.

Mods act only in an interactive terminal, so the collector cannot show them. Drive a live `claude` session in tmux instead, as `features/skill-nudge.md` does.

## Doctor

```bash
node .agents/skills/verify-ravn-core/scripts/doctor.ts   # read-only
```

Require exit 0. Doctor prints the revision, uncommitted files, and tool versions, checks Node 24 or later, pnpm, and promptfoo, and validates the marketplace and every plugin. It fails when `codex`, `pi`, or `gh` is installed but not logged in, and skips each one that is absent; features that need a skipped tool report as unverified.

## Drive

Follow the feature file. Invoke the skill with the same kind of input a user gives, specific enough that a headless run never stops to ask a question. A run that ends on a question is a failed attempt; tighten the prompt and record both attempts. Drive only the skill's public entry and leave fixtures unedited.

## Evidence

The collector writes to `.verify/$RUN_ID/<feature-id>/`, which is gitignored.

`collect.ts` keeps `run.json` (command, exit code, commit), `stdout.txt`, `stderr.txt`, and a copy of `evals/results/` when the command refreshed it. `evals/run.ts` wipes `evals/results/` on every run, so only the `.verify/` copy counts.

Add feature-specific proof, such as screenshots and `unzip` output, to the same directory. For each sub-feature ID, report pass or fail and quote the line or command output that shows it. Check side effects in the transcript as well as the files: a skill that ran a command it should not have fails even when the file looks right.

## Cleanup

```bash
node .agents/skills/verify-ravn-core/scripts/cleanup.ts $RUN_ID
```

It deletes `/tmp/ravn-verify/$RUN_ID` and keeps `.verify/$RUN_ID`. It refuses paths outside `/tmp/ravn-verify`. Clean up failed attempts the same way.

## Scratch repos

`scripts/scratch.ts` builds a scratch repo in a known state: `babysit <dir> [thread|approved|late|queue|no-skill|uncovered]` (a simulated PR, with `github-sim.ts` as `gh`), `bug-fix <dir>`, or `review-and-simplify <dir>`.

Keep the map current with the `maintain-verification-skill` skill when skills or features change.
