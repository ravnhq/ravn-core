# review-and-simplify review

`/ravn-core:review-and-simplify` reviews a branch or PR with risk-tiered specialists in the session's own harness and model family, judges their findings into one verdict, and applies safe simplifications on the user's own branch without committing.

## Sub-features

- `review.tier`: a branch that touches `src/session.ts` runs the `full` tier, all eight specialists.
- `review.specialists`: Claude Code spawns `review-specialist` agents with `model: "sonnet"` for the step-down specialists when the session runs Opus or Fable; Codex spawns `spawn_agent` subagents; Pi runs each specialist in turn.
- `review.findings`: the final reply reports the seeded off-by-one in `src/page.ts` (`PAGE_SIZE + 1`), the logged session token in `src/session.ts`, and the README that still says 20, with a `request_changes` or `comment` verdict.
- `review.check`: the transcript shows `review.ts check` exiting 0, after correcting any rejected finding.
- `review.simplify`: `src/page.ts` drops `boundPage` for `clamp` from `src/util.ts`, the edit is uncommitted, and `npm test` still passes.

## How to get to it (user POV)

- An engineer on a feature branch types `/ravn-core:review-and-simplify` in Claude Code, `$review-and-simplify` in Codex, or `/skill:review-and-simplify` in Pi.

## Driving it with scripts/scratch.ts

Preconditions: doctor exits 0 with `ok codex login` and `ok pi login`.

- Build one scratch repo per harness: `node scripts/scratch.ts review-and-simplify /tmp/ravn-verify/$RUN_ID/review-<harness>/work`. It is on `feature/page-slices`, one commit ahead of `main`, with four seeded findings; its test passes on them.
- Load the working-tree skill as [ship](./ship.md) does. For Claude Code, also copy `plugins/agent/ravn-core/agents/review-specialist.md` into the clone's `.claude/agents/`.
- Send one turn: `<invocation> Review this branch (feature/page-slices) against main and apply the simplifications that are safe. Do not post anything to GitHub and do not ask me questions; use the defaults.`
- Keep the transcript, the final message, `git status --short`, `git diff`, `git log --oneline`, and `npm test` output under `.verify/$RUN_ID/review-and-simplify-<harness>/`.
- Check:
  - `review.tier`: the `tier` call's output in the transcript has `"tier": "full"` and eight specialists.
  - `review.specialists`: Claude Code's transcript has eight `Agent` calls with `subagent_type` `review-specialist`, five with `model` `sonnet`; Codex's session logs under the isolated `$HOME/.codex/sessions/` (the exec JSON omits them) have eight `spawn_agent` calls with `fork_turns` `none`; Pi's shows the specialist passes in sequence.
  - `review.findings` and `review.check`: quote the lines from the final message and the `check` output.
  - `review.simplify`: `git status --short` shows ` M src/page.ts` only, `git log --oneline` still has two commits, and `npm test` exits 0.

## Gotchas

- The fixture's commit is on the branch, so the tree starts clean and simplify may edit `src/page.ts`. Uncommitted edits there would make simplify report instead.
- A user's `diff.mnemonicPrefix` makes plain `git diff` write `c/` and `w/` prefixes; `review.ts` rejects that diff with `diff_prefix`, and the skill's commands pass `--src-prefix=a/ --dst-prefix=b/`.
- Unit tests live in `test/ravn-core/review-and-simplify/`; they cover the script, not the review.
