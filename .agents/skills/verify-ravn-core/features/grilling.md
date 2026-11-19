# Grilling

The explicit `grilling` command and a natural-language stress-test request reach the same interview. Each round presents open decisions with recommendations and waits.

## Sub-features

- `grilling.explicit`: the canonical command opens the interview.
- `grilling.native`: “grill me” selects `grilling` without a command.
- `grilling.frontier`: ask independent decisions together with recommendations. Defer decisions that depend on unanswered ones and make no edits.

## How to get to it (user POV)

Ask for a stress test of planned overdue-review reminders whose timing, channel, and retry ownership are undecided. Start once with the command and once without it in a fresh session.

## Driving it with a scratch repo

Use the [harness setup](README.md#harness-runs). Collect both turns with `scripts/collect.ts`. Find selection in the trace; require the first round to leave decisions with the user. Answer one dependency in a resumed session and check that the next frontier changes without re-asking questions already settled. Compare `git status` before and after.

## Gotchas

- This interview is intentionally interactive: a first turn that stops on questions is the expected outcome. Building at that point fails the check.
