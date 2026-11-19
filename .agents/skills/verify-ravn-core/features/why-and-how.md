# why and how

`why` answers a rationale question from the commits and PR discussions behind the code, citing what the authors wrote and marking its own inferences. `how` answers an architecture question with a read-only explanation of the code as it is now.

## Sub-features

- `why.record`: the answer cites the commit whose message holds the rationale, by hash or subject, and quotes or paraphrases what its author wrote.
- `why.inference`: anything the record does not state is marked as inference, and the answer says what the record leaves open.
- `how.flow`: the answer walks the real call path across the files in order and names the files and functions involved.
- `how.readonly`: the working tree is unchanged after the run.

## How to get to it (user POV)

- An engineer types the skill's invocation form (README) with a question about the code in front of them.

## Driving it with a scratch repo

- Build a scratch repo per harness in `/tmp/ravn-verify/$RUN_ID/why-and-how-<harness>/work`, with `git init -b main` and a local `user.name` and `user.email`:
  1. Commit `src/client.ts`, where `fetchJson(url)` calls `withRetry(() => fetch(url))` from `src/retry.ts`, and `src/retry.ts`, where `withRetry` makes up to `MAX_ATTEMPTS = 4` attempts with a doubling delay from `BASE_DELAY_MS = 250`. Subject `feat: retry failed fetches`; body `The billing API bans a client for an hour after five failed calls in one minute. Four attempts keep a single request under that ban even when the first call already failed.`
  2. Commit an unrelated change on top, such as a `README.md`, with subject `docs: add readme`.
- Load the working-tree skills as the README's Harness runs say. Send one turn per skill, each in a fresh session:
  - `why`: `why does withRetry stop at four attempts?`
  - `how`: `how does fetchJson end up retrying a failed request?`
- Check:
  - `why.record` and `why.inference`: the final message cites `feat: retry failed fetches` or its hash and ties four attempts to staying under the five-failures ban.
  - `how.flow`: the final message names `fetchJson` in `src/client.ts`, `withRetry` in `src/retry.ts`, the attempt limit, and the doubling delay.
  - `how.readonly`: `git status --short` prints nothing.

## Gotchas

- The rationale lives only in the commit body, not in a code comment, so an answer read off the source alone has no grounds for "five failures" and fails `why.record`.
- `how` must return the walkthrough in the same turn. A progress message waiting for another agent does not pass `how.flow`.
