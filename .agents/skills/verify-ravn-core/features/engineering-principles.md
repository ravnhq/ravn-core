# Engineering principles in ship

`ship` conditionally reaches debugging, type and boundary discipline, retry safety, write ownership, and measured-result validation. Existing skills disclose domain representations, reader load, internal API migration, behavioral tests, and verifiable sequencing. Each triggered principle produces a decision and a verification check.

## Sub-features

- `principles.debug`: reproduce the original failure, trace its cause, and verify the corrected behavior.
- `principles.types`: parse external data and represent valid lifecycle states without contradictory fields.
- `principles.retry`: repeated execution and recovery after an interrupted write converge to the same result.
- `principles.ownership`: independent workers use separate mutable state or enforce necessary shared access structurally.
- `principles.measurement`: reject a speedup claim whose timed work did not complete or whose outputs are wrong.
- `principles.references`: apply domain representation, reader load, internal caller migration, behavioral assertions, and verifiable sequencing through their owning skills.
- `principles.ship`: the plan pairs triggered decisions with checks; the run stops at plan approval and again before pushing.
- `principles.skip`: a simple copy change does not reach retry, concurrency, or measurement guidance.

## How to get to it (user POV)

Invoke `/ship` in Claude Code with working-tree skills installed as project skills, `$ship` in Codex, or `/skill:ship` in Pi. Give a synthetic local repo with a reproducible bug, retrying file writes, concurrent workers, a typed state model, internal legacy callers, and a suspect measurement. Confirm the goal and grilling decisions, then inspect the plan before approving the build.

## Driving it with a multi-turn driver

Use the harness isolation and transcript conventions in [ship](ship.md). Use the default model and keep the run local; stop at the ready-to-push check. No remote repo or PR is needed to verify these additions.

1. Create one scratch repo per harness with the same fixtures and an existing project verification skill. Keep the exact initial files and prompt in evidence.
2. Invoke `ship` with a confirmed goal and settled decisions. Explicitly skip Steps 1 and 3, and skip `how`, `why`, and outside research for this self-contained fixture. Request the plan and stop at Step 7.
3. Inspect actual skill reads in the transcript. Require all six added skills, their disclosed references, and the owning skills' changed references. Check that each triggered decision has a concrete verification check.
4. Approve the plan, build, and run the fixture verification. Stop at Step 11. Inspect outputs and rerun the checks yourself. Require the original reproduction, reruns, interrupted-state recovery, and concurrent writes to pass. Require an inconclusive measurement verdict backed by the fixture's error and completed-work evidence. Compare every reported count with the original artifact; aggregate counts without per-trial attribution cannot establish a per-operation rate or a slowdown. Inspect tool calls for helper writes outside the assigned scratch directory. Record a failed attempt before correcting and rerunning it.
5. Run a separate simple copy-change planning case. Require no retry, concurrency, or measurement skill reads.
6. Keep prompts, raw transcripts, final replies, commands, exit statuses, fixture outputs, and independent verification under `.verify/$RUN_ID/engineering-principles-<harness>/`. Name the actual model and dirty revision. Report failed attempts and unavailable harnesses separately.

## Gotchas

- Source rules are preserved. Apply Boundary Discipline to external inputs and Fix Root Causes' no-guards rule to attempts to silence unexplained internal failures.
- The benchmark checklist retains its full-evidence requirements and explicit one-run ballpark exception. A synthetic incomplete run proves rejection of a bad claim, not a real performance improvement.
- These principles have `proof: subjective`; judge the decisions and code as well as running behavioral checks.
- A session-limit response verifies nothing about skill behavior. Keep the failed transcript and report that harness as unverified.
