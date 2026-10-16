# backoff

## Sub-features

- `backoff.curve`: the delay starts at 250 ms and doubles with each attempt.
- `backoff.cap`: no delay exceeds 30 seconds.

## How to get to it (user POV)

A caller retrying a request waits `backoffMs(attempt)` milliseconds before attempt `attempt`.

## Driving it with scripts/drive.ts

From the root of a checkout or worktree, run `node .agents/skills/verify-retry/scripts/drive.ts`. It prints the delay for attempts 0 to 11, then `PASS` when the curve and the cap hold. It appends each run, with the head and `origin/main` commits, to `verify-retry-runs.jsonl` in the git directory, as evidence.

## Gotchas

- It reads `src/retry.ts` from the checkout it runs in, so check out the commit you mean to prove first.
