# Upstream

- Source repository: https://github.com/pro-vi/cc-stretch (MIT, see `LICENSE`)
- Source snapshot: tag `v0.5.4`, commit `e8f08cb2240281ed7d375138850f6cd496e90cce`, copied 2026-10-28.
- Copied paths: `.claude-plugin/plugin.json`, `LICENSE`, `README.md`, `bench/`, `commands/`, `hooks/`, `tests/`, `types/`. Left out: the upstream marketplace manifest, `docs/`, `film/`, `package.json`, and repo files such as `AGENTS.md` and `CHANGELOG.md`.
- Lint: excluded from oxlint in `.oxlintrc.json` until it is brought up to the repo's anti-slop rules. Biome reformatted the copy like any other mod, so diff a re-sync after running `pnpm format`.
- Intentional deviations:
  - `README.md`: installs from the `ravn` marketplace, points the demo GIF at the upstream commit, and names this file.
  - `README.md`, `bench/README.md`: small wording changes for the repo's Vale prose check.
  - `.claude-plugin/plugin.json`: adds `author`, `license`, and `homepage`, naming the upstream author, to clear `claude plugin validate` warnings.
