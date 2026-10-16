# bug-fix workflow

`/ravn-core:bug-fix` reproduces a reported bug on the surface it was reported on, finds the cause with runtime evidence, commits a failing test before the smallest fix on its own branch, and opens a PR only when delivery is authorized.

## Sub-features

- `bug-fix.repro`: the reply shows a red repro (command and output) before the fix and the same repro green after it.
- `bug-fix.cause`: the root cause names the refactor commit that divides by milliseconds per hour, with runtime evidence.
- `bug-fix.history`: a new branch holds a test-only commit, then a fix commit that changes `src/cache.ts`; `main` is untouched and nothing is pushed.
- `bug-fix.dirty`: with uncommitted changes in the tree, they stay untouched, and the work happens in a new worktree whose path the reply gives.

## How to get to it (user POV)

- An engineer types `/ravn-core:bug-fix <symptom>` in Claude Code, `$bug-fix <symptom>` in Codex, or `/skill:bug-fix <symptom>` in Pi.

## Driving it with scripts/scratch.ts

Preconditions: doctor exits 0 with `ok codex login` and `ok pi login`.

- Build a scratch repo per harness: `node scripts/scratch.ts bug-fix /tmp/ravn-verify/$RUN_ID/bug-fix-<harness>/work`. Its latest commit, `refactor: inline staleness age math`, makes `isStale` read hours as days; its two tests pass on the bug.
- For `bug-fix.dirty`, build a second repo and leave changes in it: append a comment line to `src/cache.ts` and add an untracked `NOTES.md`.
- Load the working-tree skills as [ship](./ship.md) does, and send one turn: `entries we fetched yesterday get refetched as if they were stale. fix it, but don't push anything`.
- Check:
  - `bug-fix.history`: `git log --all --oneline --decorate` shows a branch off `main` with the test commit before the fix commit; `git show --stat` on each shows the test file only, then `src/cache.ts`; `node --test` passes on the branch.
  - `bug-fix.dirty`: `git worktree list` shows a second worktree holding the commits; in the original checkout, `git status --short` still shows ` M src/cache.ts` and `?? NOTES.md`, and `git diff` shows only the comment line.

## Gotchas

- The repo has no app surface, so a test that calls `isStale` is the surface; a reply that skips the red run fails `bug-fix.repro`.
