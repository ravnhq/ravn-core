# explain-change mod

The explain-change mod drops control characters from every text field of a lesson before its pane shows it, and keeps tabs, newlines, and other Unicode, so a lesson cannot inject terminal escape sequences into the pane.

## Sub-features

- `explain-change-control-chars`: `claude plugin test plugins/mods/explain-change` passes the test `text fields drop control characters and keep tabs, newlines, and other unicode`.
- `explain-change-absent-on-base`: that test exists in `plugins/mods/explain-change/tests/explanation.test.ts` on the PR head, and does not exist on `main`.

## How to get to it (user POV)

- A reviewer runs the mod's own test suite, which `pnpm validate:plugins` also runs for every mod. The test feeds a lesson with C0 and C1 control characters through `parseExplanation` and checks the title.
- This is the only proof the mod offers for this change. The pane is not driven live, because the behavior sits in the parser the tests call.

## Driving it with claude plugin test

Preconditions: the Claude Code rollout switch for hooks modules is on. See Gotchas before running it.

- `explain-change-control-chars`: `node .agents/skills/verify-ravn-core/scripts/collect.ts explain-change claude plugin test plugins/mods/explain-change`. Expect exit 0 in `run.json`, and quote the output line that shows the control-character test passing. Its exact output format is not yet recorded; take the line from `stdout.txt`.
- `explain-change-absent-on-base`: `node .agents/skills/verify-ravn-core/scripts/collect.ts explain-change-absent grep -n "drop control characters" plugins/mods/explain-change/tests/explanation.test.ts`. Expect exit 0 on the PR head and exit 1 on `main`.

## Gotchas

- On this machine (Claude Code 2.1.316, 2026-11-02), `claude plugin test plugins/mods/explain-change` exits 1 with `claude plugin test: hooks modules are turned off in this process: the rollout switch was saved off by an earlier session and is not refreshed yet`. That is a blocked run, not a pass or a fail of the change. Report the feature as unverified until a run passes.
- The rollout switch must be on for this recipe to run. Its CLI message says to start `claude` once with network access and run the tests again. Do not edit Claude Code settings, state files, or environment variables to force the switch. If the message appears, the switch is off, so ask the person who owns the Claude Code install to turn it on.
- The mod's test imports `claude-code/testing`, so it runs only through `claude plugin test`, not with plain `node --test`.
