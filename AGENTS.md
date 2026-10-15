# ravn-core

Ravn's open-source agent plugins: `ravn-core` for Claude Code, Codex, Cursor, and Pi, and the `skill-nudge` Claude Code mod. This file is the repo map. The rules for each plugin live in its tier folder.

## Tiers

Before creating or changing a plugin, identify its tier, place it at `plugins/<tier>/<name>/`, and read that tier's `AGENTS.md`. `test/marketplace.test.ts` fails when a plugin sits in the wrong tier.

- `plugins/agent/`: `ravn-core`, the coding-agent plugin. It has a `plugin.json` at its root. Rules in `plugins/agent/AGENTS.md`, vision in `plugins/agent/VISION.md`.
- `plugins/mods/`: Claude Code mods, the plugins with `hooks/hooks.json`: `skill-nudge`. Rules in `plugins/mods/AGENTS.md`.

## Layout

- `.claude-plugin/marketplace.json`: Claude Code catalog. Lists every plugin.
- `.agents/plugins/marketplace.json`, `.cursor-plugin/marketplace.json`: Codex and Cursor catalogs. Each lists only `ravn-core`. Pi reads no catalog: the root `package.json` field `pi.skills` points a git install of this repo at the `ravn-core` skills.
- `plugins/<tier>/<name>/`: one plugin, holding only what it ships. Skills live at `skills/<skill>/SKILL.md`, with conditional detail in `references/` and helpers in `scripts/` and `assets/`.
- `scripts/`: repo tooling. `plugins.ts` lists plugin directories; `validate-skills.ts` checks the skill rules that `claude plugin validate` does not, and `test/validate-skills.test.ts` proves it rejects defects.
- `test/`: repo tests, plus behavioral tests for the scripts plugins bundle at `test/<plugin>/`. They run each script on fixtures and assert on exit codes, flagged `file:line`, or package contents, never on message wording.
- `evals/`: the promptfoo eval harness for `ravn-core` and `skill-nudge`. The per-skill cases and fixtures are private; `evals/AGENTS.md` says how to fetch them. Read it before you change an eval.
- `tools/oxlint/anti-slop/`: a vendored Oxlint plugin. Fix code its rules flag rather than disabling rules, and record upstream syncs in its `UPSTREAM.md`.
- `docs/authoring/`: how to author a skill, and how to turn a recurring correction into a mechanism.
- `.agents/skills/`: repo-local skills, for Codex directly. `.claude/skills/` and `.pi/skills/` hold only symlinks into it, so each skill has one copy to edit; the validator fails on anything else there. A skill that `ravn-core` ships is itself a symlink into `plugins/agent/ravn-core/skills/`.

## Checks

- Run the `validate` skill before you push.
- It runs `pnpm check`, `pnpm validate:plugins`, and `pnpm prose:check`, the same commands as the `check` job in `.github/workflows/ci.yml`.
- `pnpm check` formats, lints, and typechecks the repo tooling and the plugin code listed in `biome.json`, `.oxlintrc.json`, and `tsconfig.json`, then runs `test/`. `pnpm prose:check` runs Vale on the user-facing docs that `.vale.ini` names, after it checks `.vale/styles` against `.vale/styles.lock.json`.
- A change is done when all three pass.
- Rerun only the steps that cover files you changed after the last passing run.

## Versions and releases

- Bump a plugin's version whenever its shipped content changes. Installed users get updates only on a bump.
- Keep every plugin version declaration synchronized:
  - Every plugin: its manifest (`plugin.json` for `ravn-core`, `.claude-plugin/plugin.json` otherwise) and `.claude-plugin/marketplace.json` entry.
  - `ravn-core`: those declarations plus `plugins/agent/ravn-core/package.json` and `plugins/agent/ravn-core/.cursor-plugin/plugin.json`, all in the same edit.
  - CI fails when these versions differ.
- Route every plugin release through the `release` skill; it owns the bump, full validation, and tag.

## Code

Write scripts in TypeScript that Node runs directly, with erasable syntax only. A script a plugin bundles imports only Node built-ins, because it runs from the installed plugin with no `node_modules`; npm packages are for repo tooling. Each tier's `AGENTS.md` sets the Node version its scripts target.

Commits use conventional commits (`feat:`, `docs:`, ...).
