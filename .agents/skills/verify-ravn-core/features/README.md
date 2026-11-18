# ravn-core verification map

This map is the maintained source for verifying what each plugin does for a user. Read this index first, then use the matching feature file as the recipe.

## Baseline preconditions

- Run from the repo root after `pnpm install`. `node .agents/skills/verify-ravn-core/scripts/doctor.ts` exits 0.
- `claude` is logged in. Runs spend real API budget.
- A feature driven in Codex, Pi, or against GitHub needs doctor's `ok codex login`, `ok pi login`, or `ok gh auth`; feature files list only extra preconditions.

## Driving conventions

- Invoke the skill the way a user does: its invocation form plus the same kind of input a user gives (a file path, pasted text, a short request). The forms are `/ravn-core:<skill>` in Claude Code (also `/<skill>` when no other skill has that name), `$<skill>` in Codex, and `/skill:<skill>` in Pi.
- Judge the output against the source and the skill's contract, not against memory of an earlier run.
- Name the runner (`claude-code/...`, `codex/...`, `pi/...`) for every `ravn-core` harness result.

## Proof and skip reporting

- Evidence paths in feature files are relative to `.verify/$RUN_ID/<feature-id>/`; `<evidence>` means that directory.
- Quote the exact lines from an output file or `stdout.txt` that prove each sub-feature.
- A feature that needs a tool doctor skipped (codex, pi, gh, tmux) is reported as unverified, with the missing tool named. Do not count another harness instead.
- A run that exits non-zero or hits the budget is a failed attempt. Report it; do not retry silently.

## Harness runs

Features that drive Claude Code, Codex, and Pi headless share this setup. Per harness, work in a scratch repo at `/tmp/ravn-verify/$RUN_ID/<feature>-<harness>/work`.

- Load the working-tree skills, not an installed copy:
  - Claude Code: copy `plugins/agent/ravn-core/skills/*` into the clone's project skills directory and list each in `.git/info/exclude`. A managed `ravn-core` install shadows `--plugin-dir`, so that flag tests the installed version.
  - Codex: an isolated `HOME` with `~/.codex/auth.json` and `~/.gitconfig` copied in, the skills under `$HOME/.agents/skills/`, and `GH_TOKEN=$(gh auth token)` when the run needs `gh`.
  - Pi: `--no-skills --no-extensions --no-prompt-templates`, plus `--skill` for every `ravn-core` skill and every skill in the clone. Keep context files on so the agent sees the repo's own instructions.
- Run one turn per call, resuming the same session for multi-turn features:
  - Claude Code: `claude -p --setting-sources project --output-format stream-json --verbose --allowedTools "Bash Read Write Edit Glob Grep Skill Agent WebFetch WebSearch" [--resume <id>]`. Pipe the prompt on stdin: `--allowedTools` is variadic and swallows a trailing prompt argument ("Input must be provided").
  - Codex: `codex exec --json --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check "<prompt>"`, then `codex exec resume <id>`.
  - Pi: `pi -p --mode json --session-dir <dir> --session-id <uuid> "<prompt>"`. Use the same `RAVN_VERIFY_PI_PROVIDER` and `RAVN_VERIFY_PI_MODEL` as doctor and evals: add `--provider "$RAVN_VERIFY_PI_PROVIDER" --model "$RAVN_VERIFY_PI_MODEL"` and record both names.
- Keep each turn's prompt, transcript, final message, and tool calls under the feature's evidence directory.

## Feature entry contract

Each feature file has an H1 title and one paragraph of user-visible behavior, then four H2 sections in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with <driver>`, and `Gotchas`.

## Features

Claude Code mods:

- [Skill Nudge tip band](./skill-nudge.md) covers the tip's layout and styling, answering it with `1` or `2`, and the `/skill-nudge` toggle, driven in a live terminal through tmux.
- [explain-change mod](./explain-change.md) covers the control-character stripping in its lesson parser, driven through `claude plugin test`.

`ravn-core` and the repo:

- [Harness skill loading](./harness-skill-loading.md) covers Claude Code, Codex, and Pi loading a skill.
- [Plugin skill evals](./skill-evals.md) covers one `ravn-core` skill's promptfoo cases.
- [review-and-simplify](./review-and-simplify.md) covers the tier, the specialist fan-out in each harness, the seeded findings, and the applied simplification.
- [why and how](./why-and-how.md) covers `why` citing the commit that records a rationale and `how` walking a call path read-only, in all three harnesses.
- [Repo check](./repo-check.md) covers `pnpm check`.
- [Repo gates without private evals](./repo-gates.md) covers the eval-config skip reason, `evals/run.ts` stopping before it spends tokens, and the `validate` skill's eval fetch step.
- [Dependency overrides](./dependency-overrides.md) covers the frozen install, the resolved versions of the overridden packages, and each open Dependabot alert's first patched version.
- [Marketplace install](./marketplace-install.md) covers installing `ravn-core` from the marketplace.
- [ship idea-to-PR workflow](./ship.md) covers `ship`, including the applicable create or maintain branch of `verification-skill` and passing CI on the final head.
- [babysit merge-readiness workflow](./babysit.md) covers gate discovery, thread triage, merge-ready reporting, proof before merging, merging on request, merge-queue drops, and background watching, against a simulated GitHub.
- [bug-fix workflow](./bug-fix.md) covers the repro, the root cause, red-then-green history on a new branch, and isolating a dirty tree in a worktree.
- [Formal verification skill](./formal-verification.md) covers a seeded race and a rerunnable proof guide, then resyncing verification after the code changes.
- [Deprecate and migrate](./deprecate-and-migrate.md) covers inventorying a deprecated function's callers with the bundled script, moving them to the replacement, keeping the public old export, and planning expand, migrate, contract.
- [Web QA and PR screenshots](./web-qa.md) covers `web-qa` reporting a seeded invisible button label with a screenshot and repro steps, and `pr` laying out before/after screenshots of its fix.
- [Statechart](./statechart.md) covers `statechart` running TLC through its bundled script on a seeded checkout model, the shortest path to the broken rule in the report and the reply, the labeled Mermaid chart, and the spec left unchanged.
- [Figure it out](./figure-it-out.md) covers the phase plan and done predicate written before code, the baseline captured before the first change, a committed decision trail with a keep-or-revert verdict per unit, and one validated config loader replacing three hand-rolled ones.
- [Learn from sessions](./learn-from-sessions.md) covers evidence-backed prevention proposals, structure-first destination choices, approval boundaries, approved application, and routing across all three harnesses.
- [TypeScript best practices](./typescript-best-practices.md) covers loading the skill unprompted for a TypeScript change, applying its rules, and staying out of other languages.
- [Engineering principles in ship](./engineering-principles.md) covers conditional dispatch, decisions paired with checks, root-cause fixes, retry safety, write ownership, type and boundary discipline, measured-result validation, and the newly disclosed references in existing skills.
- [Attack the Premise and Build the Lever](./principles-premise-lever.md) covers naming and testing the premise two failed fixes shared, reverting the refuted fixes, and doing a 30-file caller migration with a rerunnable codemod.
- [Bad test terminator](./bad-test-terminator.md) covers the vendored plugin with its provenance record, exact matching pins, the guards block, the seven Vitest settings with a repeat run, findings settled on the request's route, and the self-check proving the renamed rules bite, in all three harnesses.
- [Verification skill lifecycle](./verification-skill.md) covers the create and maintain modes on a real CLI.
- [Grilling](./grilling.md) covers explicit invocation, discovery, and the decision frontier.
- [Ask Ravn](./ask-ravn.md) covers mapping without executing work.
- [Codebase design](./codebase-design.md) covers the design-versus-current-code boundary and branch references.
- [Architecture survey](./improve-codebase-architecture.md) covers the HTML shortlist before a design choice.
- [Writing for agents](./writing-for-agents.md) covers writing a runnable common contract and a reachable branch reference.
- [Shared state ownership](./shared-state-ownership.md) covers the retained standalone principle on independent and truly shared writes.

## Not covered

These have no dedicated complete live recipe yet. Report them as unverified when a change touches them. Skills exercised only as a link in another recipe are not thereby fully verified.

- `ravn-core` skills without a complete live recipe: `agent-readiness`, `blast-radius`, `domain-modeling`, `explain-change` (the `explain-change` feature covers only the mod's parser), `pause-safely`, `pr` beyond its use in `ship`, `principle-explain-the-number`, `principle-fix-root-causes`, `principle-make-operations-idempotent`, `principle-prove-it-works` beyond the focused engineering-principles cases, `research` beyond its use in `ship`, `session-pickup`, and `show-me-your-work`.
