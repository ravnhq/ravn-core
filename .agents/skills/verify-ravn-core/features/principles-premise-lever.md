# Attack the Premise and Build the Lever

`/ravn-core:principle-attack-the-premise` makes the agent name the belief that earlier failed fixes shared and test it before a new fix, then revert the fixes the evidence refutes. `/ravn-core:principle-build-the-lever` makes the agent do a many-file change with a rerunnable codemod or script instead of hand edits.

## Sub-features

- `premise.named`: before it edits `src/prices.ts`, the transcript states the premise both `fix:` commits shared (a stale cache serves the old price) and runs a check that tests it, such as a read with the cache bypassed or cleared that still returns the old price.
- `premise.fixed`: the new commit makes `setPrice` write the store, `node --test` passes, and the TTL and `cache.clear()` changes are reverted, or the reply gives evidence for keeping each.
- `lever.tool`: the diff holds a codemod or script file, the transcript shows it run, and a second run changes nothing.
- `lever.migrated`: `src/` has no `logEvent`, all 30 handlers call `recordEvent({ name, payload })`, and `node --test` passes.

## How to get to it (user POV)

- An engineer types the skill's invocation form (README) and states the problem: two fixes that did not work, or a change across many callers.

## Driving it with scripts/scratch.ts

- Build one scratch repo per harness and scenario: `node scripts/scratch.ts principles /tmp/ravn-verify/$RUN_ID/<scenario>-<harness>/work <premise|lever>`. `premise` holds a price module whose `setPrice` writes to a copy of the store, under two commits that fix the read cache instead; its test fails. `lever` holds 30 handlers calling `logEvent` in three shapes (one line, multi-line, template name with a computed payload); its test passes.
- Load the working-tree skills as the README's Harness runs say, and send one turn each:
  - `premise`: `<invocation> npm test still fails: after setPrice, getPrice returns the old price. My last two commits tried to fix the price cache and neither worked. Fix it and commit. Do not ask me questions.`
  - `lever`: `<invocation> Replace logEvent(name, payload) in src/log.ts with recordEvent({ name, payload }), migrate every caller, and delete logEvent. Commit when done. Do not ask me questions.`
- Check `premise.*`: quote the transcript lines that state and test the premise and their order against the first edit to `src/prices.ts`, then `git log --oneline`, `git show HEAD -- src/prices.ts`, and `node --test`.
- Check `lever.*`: quote the script's path and the command that ran it, rerun it yourself and quote `git status --short` (empty), then `grep -rn logEvent src` (empty) and `node --test`.

## Gotchas

- Both skills are `proof: subjective`: the code outcome alone does not show the skill worked. A run that fixes `setPrice` without stating and testing the premise fails `premise.named`, and a correct migration done with per-file edits fails `lever.tool`.
- A one-line `sed` or `perl -pi` misses the multi-line calls; the agent may still use one as its lever for the single-line shape, so judge the whole change by `lever.migrated`.
- Rerunning the failing test is not a premise test: it fails the same way whether or not the cache is to blame. `premise.named` needs a check whose result depends on the premise.
- A codemod written outside the repo, such as under `/tmp`, leaves nothing to rerun and fails `lever.tool`, even when the migration is right.
