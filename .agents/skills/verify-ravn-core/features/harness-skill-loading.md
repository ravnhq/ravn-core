# Harness skill loading

Each harness discovers an installed skill and follows it. The smoke skill `greet` makes the agent greet and offer help.

## Sub-features

- `load.claude`: Claude Code loads the skill.
- `load.codex`: Codex loads the skill.
- `load.pi`: Pi loads the skill.
- `load.cursor`: Cursor loads the skill.

## How to get to it (user POV)

- An engineer asks the agent to "use the greet skill" in a repo where the skill is installed.

## Driving it with evals/run.ts

Preconditions: doctor prints `ok codex login`, `ok pi login`, and `ok cursor login`.

- Run smoke on one model per harness: `node scripts/collect.ts harness-skill-loading pnpm eval:smoke --runners claude-code/claude-sonnet-5-5,codex/gpt-6-luna,pi/gpt-6-luna,cursor/composer-2.5`. Expect exit 0.
- Check results: `results/smoke-*.json` has one file per runner, each with `"successes": 1`.

## Gotchas

- `--runners` takes `runnerName` values from `evals/skill-eval.ts`; an unknown name throws before any run.
- Codex may refresh the copied login and stale your real one. Fix with `codex login`.
- Omitting `--runners` also runs the Opus, Sol, Cursor, and OpenRouter runners. Codex OpenRouter runners throw at config load without `OPENROUTER_API_KEY`; Claude Code OpenRouter runners start and then fail at auth. A Cursor runner throws at config load without `CURSOR_API_KEY`.
- `evals/run.ts` reads `~/.codex/auth.json` even when `--runners` names no Codex runner, so a run without a Codex login crashes.
