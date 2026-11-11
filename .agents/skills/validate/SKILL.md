---
name: validate
description: Run the CI checks locally before pushing. Use before opening a PR or pushing to main, or when the user asks to validate the marketplace or plugins.
---

Mirror CI's `check` job from the repo root. Reuse passing steps unless covered files or the environment changed.

## Steps

1. **Repo checks.**
   ```bash
   pnpm install --frozen-lockfile
   GIT_TERMINAL_PROMPT=0 pnpm eval:fetch
   pnpm check
   ```
   `eval:fetch` clones the private eval configs. Without access, continue and report the eval-config tests as skipped (the `skipped` count in `pnpm check`), as CI does on forks.

2. **Plugin checks.** Needs the Claude Code CLI on `PATH`.
   ```bash
   pnpm validate:plugins
   ```

3. **Prose checks.** Needs Vale on `PATH`; CI pins 3.21.0. Keep the vendored `write-good` 0.4.1 styles as committed: `.vale/styles.lock.json` rejects what `vale sync` generates.
   ```bash
   pnpm prose:check
   ```

For CI's SkillSpector scan on `plugins/agent/ravn-core/skills/*/`, follow its `skillspector` job.

## Reporting

Diagnose failures, fix those within authorized scope, and rerun affected steps; continue independent checks, reporting missing access or protected changes as blockers. Lead with green or blocked, then each step's result and evidence; green requires all three steps to pass.
