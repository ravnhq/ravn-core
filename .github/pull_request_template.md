## Summary

<diagram, diff-sketch, or tree>

## Changes

- <what changed, and why>

## Evidence

- **Before:** <output or failing eval run>
  **After:** <live check output before v1; `pnpm eval` output from v1>

## Merge Danger

**Door:** <one-way or two-way>

**Blast Radius:** <one word>

## Checks

- [ ] CI passes; the `validate` skill passes locally
- [ ] Title is a conventional commit

### ravn-core changes only

- [ ] `pnpm check` and the SkillSpector static scan pass
- [ ] Before v1, or for a subjective skill: a live check confirms the skill's observable behavior in Claude Code, Codex, and Pi. From v1, for a structural skill: `pnpm eval` passes on all three
- [ ] From v1: every new or changed structural skill has a config at `evals/private/<plugin>/<skill>/promptfooconfig.ts` with quality, trigger, route, and stay-out cases
- [ ] SKILL.md stays thin; deterministic logic lives in `scripts/` and imports only Node built-ins
- [ ] Uses only agent-plugins.org features, with no harness-specific behavior
- [ ] No credentials; scripts rely on existing CLI logins
- [ ] `plugins/` holds only runtime files; tests, evals, and tooling live outside it
- [ ] Human-authored, generic workflow, not client-, project-, or person-specific
