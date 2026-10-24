# ravn-core verification map

This map is the maintained source for verifying what each plugin does for a user. Read this index first, then use the matching feature file as the recipe.

## Baseline preconditions

- Run from the repo root after `pnpm install`. `scripts/doctor.ts` exits 0.
- `claude` is logged in. Runs spend real API budget.
- `RUN_ID` is exported once per verification pass, so every feature lands in `.verify/$RUN_ID/<feature-id>/`.
- `ravn-core`, bundled scripts, and repo commands run through `scripts/collect.ts <feature-id> <command> [args...]` from the repo root.

## Driving conventions

- Invoke the skill the way a user does: its slash command plus the same kind of input a user gives (a file path, pasted text, a short request).
- Judge the output against the source and the skill's contract, not against memory of an earlier run.
- Name the runner (`claude-code/...`, `codex/...`, `pi/...`) for every `ravn-core` harness result.

## Proof and skip reporting

- `collect.ts` keeps `run.json`, `stdout.txt`, `stderr.txt`, and `results/` when evals ran.
- Evidence paths in feature files are relative to `.verify/$RUN_ID/<feature-id>/`; `<evidence>` means that directory.
- Quote the exact lines from an output file or `stdout.txt` that prove each sub-feature.
- A feature that needs a tool doctor skipped (codex, pi, cursor-agent, gh, tmux) is reported as unverified, with the missing tool named. Do not count another harness instead.
- A run that exits non-zero or hits the budget is a failed attempt. Report it; do not retry silently.

## Feature entry contract

Each feature file has an H1 title and one paragraph of user-visible behavior, then four H2 sections in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with <driver>`, and `Gotchas`.

## Features

Claude Code mods:

- [Skill Nudge tip band](./skill-nudge.md) covers the tip's layout and styling, answering it with `1` or `2`, and the `/skill-nudge` toggle, driven in a live terminal through tmux.

`ravn-core` and the repo:

- [Harness skill loading](./harness-skill-loading.md) covers Claude Code, Codex, Cursor, and Pi loading a skill.
- [Plugin skill evals](./skill-evals.md) covers one `ravn-core` skill's promptfoo cases.
- [why anchor script](./why-anchor-script.md) covers the `why` skill's anchor script.
- [Repo check](./repo-check.md) covers `pnpm check`.
- [Marketplace install](./marketplace-install.md) covers installing `ravn-core` from the marketplace.
- [ship idea-to-PR workflow](./ship.md) covers `ship` and the skills it chains: `grilling`, `create-verification-skill`, and `pr`. `research` and `maintain-verification-skill` run only when the change needs outside docs or the repo already has a verification skill.
- [babysit merge-readiness workflow](./babysit.md) covers gate discovery, thread triage, merge-ready reporting, proof before merging, merging on request, merge-queue drops, and background watching, against a simulated GitHub.
- [bug-fix workflow](./bug-fix.md) covers the repro, the root cause, red-then-green history on a new branch, and isolating a dirty tree in a worktree.
- [Learn from sessions](./learn-from-sessions.md) covers evidence-backed prevention proposals, structure-first destination choices, approval boundaries, approved application, and routing across all four harnesses.
- [TypeScript best practices](./typescript-best-practices.md) covers loading the skill unprompted for a TypeScript change, applying its rules, and staying out of other languages.
- [Engineering principles in ship](./engineering-principles.md) covers conditional dispatch, decisions paired with checks, root-cause fixes, retry safety, write ownership, type and boundary discipline, measured-result validation, and the newly disclosed references in existing skills.

## Not covered

These have no dedicated complete live recipe yet. Report them as unverified when a change touches them. Skills exercised only as a link in another recipe are not thereby fully verified.

- `ravn-core` skills without a complete live recipe: `agent-readiness`, `ask-ravn`, `blast-radius`, `codebase-design`, `create-verification-skill` beyond its use in `ship`, `domain-modeling`, `grill-me`, `grilling` beyond its use in `ship`, `improve-codebase-architecture`, `maintain-verification-skill`, `pause-safely`, `pr` beyond its use in `ship`, `principle-boundary-discipline`, `principle-explain-the-number`, `principle-fix-root-causes`, `principle-guard-the-context-window`, `principle-make-operations-idempotent`, `principle-prove-it-works` beyond the focused engineering-principles cases, `principle-separate-before-serializing-shared-state`, `principle-type-system-discipline`, `research` beyond its use in `ship`, `session-pickup`, `show-me-your-work`, and `writing-for-agents` beyond its use in `ship`.
