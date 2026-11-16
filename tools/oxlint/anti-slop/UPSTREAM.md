# Upstream

- Source repository: https://github.com/dmmulroy/anti-slop
- Source snapshot: `skills/install-anti-slop` folder at git tree `89044d21c75a367eac1ddbaf208e650b1a7d5820`, installed locally 2026-09-30. The upstream commit containing that tree is unknown.
- Installed by: `install-anti-slop/scripts/install.mjs` from that snapshot.
- Installed paths: `tools/oxlint/anti-slop/` (generic plugin `index.ts`; the `effect/` plugin was copied but is not registered).
- Dependencies: `oxlint` and `@oxlint/plugins`. The installer pinned both at `1.86.0`; `package.json` now pins them, at `1.90.0` since #23.
- Intentional deviations: `vendor/eslint-stylistic/UPSTREAM.md`'s "Updating and verification" section describes this repository instead of the anti-slop repository's tooling, which was not vendored (its `pnpm sync:skill-assets` script and the `require-readable-spacing` RuleTester and CLI tests).
