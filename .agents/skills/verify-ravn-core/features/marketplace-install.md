# Marketplace install

Claude Code installs `ravn-core` from `.claude-plugin/marketplace.json`.

## Sub-features

- `install.claude`: `/plugin install ravn-core@ravn` succeeds.

## How to get to it (user POV)

- `/plugin marketplace add ravnhq/ravn-core`, then `/plugin install ravn-core@ravn` in Claude Code.

## Driving it with Claude Code

Preconditions: GitHub access to `ravnhq/ravn-core`.

- Not automated. Run the two commands interactively and record the output by hand; otherwise report `install.claude` as unverified.
- `test/marketplace.test.ts` checks that every `plugins/` directory is listed, that agent-plugin fields and versions match each `plugin.json`. It does not install anything.

## Gotchas

- Installs from GitHub, not the working tree; unpushed changes are not tested.
