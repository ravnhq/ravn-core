# Plugin skill evals

A plugin skill's promptfoo cases run against the harnesses in a temp workspace built from `evals/private/fixtures`.

## Sub-features

- `eval.current`: the working-tree skill passes its cases.
- `eval.compare`: current versus `main` baseline and no-skill arms.

## How to get to it (user POV)

- A contributor changes a skill and runs `pnpm eval` before merging.

## Driving it with evals/run.ts

Preconditions: doctor prints `ok codex login` and `ok pi login`; `pnpm eval:fetch` succeeded; skill has `evals/private/ravn-core/<skill>/promptfooconfig.ts` (today: `how`, `pause-safely`, `session-pickup`, `why`).

- Run one skill, current arm: `node scripts/collect.ts skill-evals pnpm eval --skills <skill> --runners claude-code/claude-sonnet-5-5,codex/gpt-6-luna,pi/gpt-6-luna`. Expect exit 0.
- Check results: `results/ravn-core-<skill>-*.json`.

## Gotchas

- `--skills` takes the skill directory name, not `ravn-core-<skill>`.
- `eval:compare` exports `main` with git (override with `--baseline-ref`); uncommitted changes appear only in the current arm. It exits non-zero by design when an arm fails a case, so read the per-arm results instead of the exit code.
- Ask before running: each case spends real tokens per runner.
