---
name: verify-ravn-core
description: After every plugin skill or bundled-script change, run real user workflows in its supported harnesses and preserve the evidence; also use before release or when asked to verify, smoke-test, or dogfood a plugin. Static checks alone do not verify behavior; use the validate skill for them.
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

It runs the command from the repo root. `evals/run.ts` builds and deletes its own temp workspace and isolated Codex `HOME`, so its teardown is automatic. Never run bare `pnpm eval` or `pnpm eval:compare` without the user's go-ahead; both spend tokens on every runner.

Mods act only in an interactive terminal, so the collector cannot show them. Drive a live `claude` session in tmux instead, as `features/skill-nudge.md` does.

## Doctor

```bash
node .agents/skills/verify-ravn-core/scripts/doctor.ts   # read-only
```

Require exit 0. Doctor prints the revision, any uncommitted files, and the `claude`, `codex`, `pi`, and `cursor-agent` versions. It checks Node 24 or later, pnpm, and promptfoo, and validates the marketplace and every plugin. It fails when `codex`, `pi`, or `gh` is installed but not logged in, and when `cursor-agent` is installed but `CURSOR_API_KEY` is missing or rejected. It skips each tool that is absent; features that need a skipped tool report as unverified. Evals accept only `CURSOR_API_KEY`.

## Drive

Follow the feature file. Invoke the slash command with the same kind of input a user gives. Keep prompts specific enough that a headless run never stops to ask a question. A run that ends on a question is a failed attempt; tighten the prompt and record both attempts. Do not call skill internals or edit fixtures to make a run pass.

## Evidence

The collector writes to `.verify/$RUN_ID/<feature-id>/`, which is gitignored.

- `collect.ts` keeps `run.json` (command, exit code, commit), `stdout.txt`, `stderr.txt`, and a copy of `evals/results/` when the command refreshed it. `evals/run.ts` wipes `evals/results/` on every run, so only the `.verify/` copy counts.

Add feature-specific proof, such as screenshots and `unzip` output, to the same directory. For each sub-feature ID, report pass or fail and quote the line or command output that shows it. Check side effects in the transcript as well as the files: a skill that ran a command it should not have fails even when the file looks right.

## Cleanup

```bash
node .agents/skills/verify-ravn-core/scripts/cleanup.ts $RUN_ID
```

It deletes `/tmp/ravn-verify/$RUN_ID` and keeps `.verify/$RUN_ID`. It refuses paths outside `/tmp/ravn-verify`. Clean up failed attempts the same way.

## Helpers

| Script | Invocation | Purpose |
|---|---|---|
| `scripts/collect.ts` | `<feature-id> <command> [args...]` | Run a command from the repo root and keep its evidence |
| `scripts/doctor.ts` | | Read-only preflight |
| `scripts/cleanup.ts` | `[run-id]` | Remove the run's scratch work dirs, keep evidence |
| `scripts/scratch.ts` | `babysit <dir> [thread\|approved\|late\|queue\|no-skill\|uncovered]` or `bug-fix <dir>` | Build a scratch repo in a known state; for babysit, a simulated PR with `github-sim.ts` as `gh` |

Keep the map current with the `maintain-verification-skill` skill when skills or features change.
