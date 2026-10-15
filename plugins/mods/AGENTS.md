# Mods tier

A mod runs only in the Claude Code CLI and the Desktop Code tab, and needs Claude Code v2.1.287 or later. Each mod is its own plugin, because `hooks/hooks.json` names exactly one hooks module. Mods from a GitHub marketplace count as user-installed, so an org policy of `allowManagedModsOnly` stops them from loading.

- Test a mod with `claude plugin test plugins/mods/<name>`; `pnpm validate:plugins` tests every mod.
- Typecheck it locally with `tsc -p plugins/mods/<name>` once Claude Code has loaded it, because Claude Code writes the types into `.claude-plugin/types/` only on load. CI does not typecheck mods.
- See `biome.json` and `.oxlintrc.json` for formatter and lint coverage.
