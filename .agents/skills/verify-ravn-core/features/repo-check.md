# Repo check

`pnpm check` runs biome format, oxlint (with anti-slop rules), tsc, `node --test`, and `pnpm sync:versions:check`.

## Sub-features

- `check.all`: the full gate passes.

## How to get to it (user POV)

- A contributor runs `pnpm check` before committing. CI runs `pnpm check`, then `pnpm validate:plugins` and `pnpm prose:check`.

## Driving it with pnpm

Preconditions: `pnpm install` done.

- Run: `node .agents/skills/verify-ravn-core/scripts/collect.ts repo-check pnpm check`. Expect exit 0 in `run.json`.

## Gotchas

- tsc and oxlint cover this skill's scripts; Biome formats them.
- CI also runs SkillSpector; see `.github/workflows/ci.yml`.
