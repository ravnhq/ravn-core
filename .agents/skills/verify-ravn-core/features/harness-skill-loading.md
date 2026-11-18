# Harness skill loading

Each harness discovers an installed skill and follows it. The smoke skill `greet` makes the agent greet and offer help.

## Sub-features

- `load.claude`: Claude Code loads the skill.
- `load.codex`: Codex loads the skill.
- `load.pi`: Pi loads the skill.
- `load.opencode`: OpenCode v2 lists the installed skills under `@` and their commands under `/`. A selected slash command attaches the skill and forwards the entered arguments to the session.

## How to get to it (user POV)

- An engineer asks the agent to "use the greet skill" in a repo where the skill is installed.

## Driving it with evals/run.ts

- Run smoke on one model per harness: `node .agents/skills/verify-ravn-core/scripts/collect.ts harness-skill-loading pnpm eval:smoke --runners claude-code/claude-sonnet-5-5,codex/gpt-6-luna,pi/gpt-6-luna`. Expect exit 0.
- Check results: `results/smoke-*.json` has one file per runner, each with `"successes": 3` and `"failures": 0`, one success per case in `evals/smoke/promptfooconfig.ts`.
- For OpenCode v2, use a scratch project and an isolated home. Install the GitHub package with `opencode plugin add 'github:ravnhq/ravn-core#main::path:plugins/agent/ravn-core'`; to test an open PR, replace `main` with its branch. Capture the TUI suggesting `@ship`, `/ship`, and `/bad-test-terminator`. Select and submit `/ship` with instructions to stop at goal shaping, then select `/bad-test-terminator` with an explicit prune-only request. Confirm the session received the skill body and request in each case. Check that `opencode api skill.list` reports `autoinvoke: false` for `ship` and that a project skill with the same ID takes precedence. Run the installed Bad Test Terminator helper in a scratch package to verify that the skill's scripts and assets are reachable.

## Gotchas

- `--runners` takes `runnerName` values from `evals/skill-eval.ts`; an unknown name throws before any run.
- Codex may refresh the copied login and stale your real one. Fix with `codex login`.
- Omitting `--runners` also runs the Opus, Sol, and OpenRouter runners. Codex OpenRouter runners throw at config load without `OPENROUTER_API_KEY`; Claude Code OpenRouter runners start and then fail at auth.
- `evals/run.ts` reads `~/.codex/auth.json` even when `--runners` names no Codex runner, so a run without a Codex login crashes.
