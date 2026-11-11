# Background mode

Start with a Step 3 watcher run using `--since-last --status-only` to establish the checkpoint before the other work. Keep `--since-last` on every watcher run for the whole session, so every result lists only what changed. Pick the first way of watching your harness supports:

- **The harness can run a command in the background and tell you when it ends** (Claude Code background tasks, Codex background terminals): start the watcher without `--status-only` in the background and continue your work. When it ends, triage its `changes`, then start it again. It ends on a change, or after 9 minutes with an empty `changes` list; restart it either way.
- **Otherwise:** at each boundary in your other work (a finished step, a commit, before you report), run it with `--status-only` and triage its `changes`.

Act on the `changes` list; the exit code repeats the current verdict even when nothing is new. Triage with Steps 4 to 7, and finish your current step before you start a PR fix batch. Keep the other task local: adding or committing its changes does not authorize pushing them. Only a PR-fix batch may be pushed under [Authority](../SKILL.md#authority); inspect every outgoing commit first. When the other work ends before the PRs reach an end state, keep going as in drive mode until they do; then report.
