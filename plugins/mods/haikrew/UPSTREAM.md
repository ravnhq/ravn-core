# Upstream

- Source repository: https://github.com/adriancmurray/HaiKrew (MIT, see `LICENSE`)
- Source snapshot: release 0.6.13, commit `868a6ba5cba7de2eab9905618fe41712896fe0b4`, copied 2026-10-28. Upstream has no tags.
- Copied paths: everything under upstream `plugin/`, plus the root `LICENSE`. Left out: the upstream marketplace manifest, `assets/`, `bench/`, `docs/`, `scripts/`, the root `tests/`, and `CHANGELOG.md`.
- Lint: excluded from oxlint in `.oxlintrc.json` until it is brought up to the repo's anti-slop rules. Biome reformatted the copy like any other mod, so diff a re-sync after running `pnpm format`.
- Intentional deviations:
  - `src/mod/update.ts`, `src/mod/ui.ts`, `tests/mod/band-bubble.test.ts`: the update check reads this fork's `plugin.json` and updates `haikrew@ravn`.
  - `src/mod/pane-home.ts`, `tests/mod/band-bubble.test.ts`: the pane's release-notes link opens this file.
  - `README.md`: installs from the `ravn` marketplace, names this file, and has small wording changes for the repo's Vale prose check.
