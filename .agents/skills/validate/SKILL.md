---
name: validate
description: Run the same checks CI runs, locally, before pushing. Covers format, lint, typecheck, and tests (skill contracts, version consistency, bundled scripts), then marketplace and plugin validation and mod tests. Use before opening a PR or pushing to main, or when the user asks to validate the marketplace/plugins.
---

Mirror the `check` job in `.github/workflows/ci.yml` locally so failures surface before CI. Run from the repo root.

## Steps

1. **Repo checks** (format, lint, typecheck, and tests, including skill contracts, plugin version consistency, and every script a plugin bundles):
   ```bash
   pnpm install --frozen-lockfile
   pnpm check
   ```

2. **Plugin checks** (`claude plugin validate` on the marketplace and every plugin, and `claude plugin test` on every mod, which is any plugin with `hooks/hooks.json`). This step needs the Claude Code CLI on `PATH`:
   ```bash
   pnpm validate:plugins
   ```

3. **Prose checks** (Vale on the user-facing docs: `README.md` and each plugin's `README.md`; `.vale.ini` scopes the house style to those files). Run this step when you touched them, `.vale.ini`, or `.vale/`. It needs Vale on `PATH`; CI pins 3.21.0. The command first checks every committed style against `.vale/styles.lock.json`. Never run `vale sync`, because `write-good` 0.4.1 is vendored and the lock rejects generated styles:
   ```bash
   pnpm prose:check
   ```

CI also runs a SkillSpector scan on `plugins/agent/ravn-core/skills/*/`; reproduce it with the `skillspector` job in `.github/workflows/ci.yml`.

## Reporting

Report each step's result. If anything fails, show the concrete failure and stop. If every step passes, state that the repo, plugin, and prose checks are green.
