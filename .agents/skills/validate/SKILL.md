---
name: validate
description: Run the CI checks locally before pushing. Use before opening a PR or pushing to main, or when the user asks to validate the marketplace or plugins.
---

Mirror the `check` job in `.github/workflows/ci.yml` locally so failures surface before CI. Run from the repo root.

## Steps

1. **Repo checks.**
   ```bash
   pnpm install --frozen-lockfile
   GIT_TERMINAL_PROMPT=0 pnpm eval:fetch
   pnpm check
   ```
   `eval:fetch` clones the private eval configs that `test/evals/configs.test.ts` checks. Without access it fails; continue and report the eval-config tests as skipped (the `skipped` count in `pnpm check`), as CI does on forks.

2. **Plugin checks.** Needs the Claude Code CLI on `PATH`.
   ```bash
   pnpm validate:plugins
   ```

3. **Prose checks.** Needs Vale on `PATH`; CI pins 3.21.0. Keep the vendored `write-good` 0.4.1 styles as committed: `.vale/styles.lock.json` rejects what `vale sync` generates.
   ```bash
   pnpm prose:check
   ```

CI also runs a SkillSpector scan on `plugins/agent/ravn-core/skills/*/`; reproduce it with the `skillspector` job in `.github/workflows/ci.yml`.

## Reporting

Report each step's result. On a failure, show it and stop. When every step passes, state that the repo, plugin, and prose checks are green.
