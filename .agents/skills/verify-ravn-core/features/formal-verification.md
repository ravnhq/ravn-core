# Formal verification skills

`/ravn-core:create-formal-verification-skill` verifies one promise the code makes with a model checker or prover, reports what the check finds without changing product code, and leaves a project skill that reruns the check. `/ravn-core:maintain-formal-verification-skill` brings that verification back in line after the covered code changes without it.

## Sub-features

- `formal.finding`: the reply says two workers can both acquire one job, as steps in the code's words (both read no lease, then both write one), and names the tool and the bounds. `src/lease.ts` is unchanged.
- `formal.test`: a test beside the verification fails on the real `acquire`, the transcript shows it failing, and `npm test` still passes.
- `formal.skill`: `.agents/skills/` has a new skill with frontmatter that names `src/lease.ts` as covered code and records the scratch repo's `feat: job leases` commit as its sync commit. Its documented command reports the violation when you run it from a fresh clone.
- `formal.updated`: after the fix commit, the maintain reply gives the check the outcome `updated`, cites `fix: claim the lease in one store operation`, and names the break it used to show that the passing check can still fail. The verify skill's sync commit is the fix commit, its command passes, and `src/lease.ts` is unchanged.

## How to get to it (user POV)

- An engineer types the create skill's invocation form (README) and names the code to verify.
- After the code changes without the check, the engineer types the maintain skill's invocation form.

## Driving it with scripts/scratch.ts

- Build one scratch repo per harness: `node .agents/skills/verify-ravn-core/scripts/scratch.ts formal-verification /tmp/ravn-verify/$RUN_ID/formal-<harness>/work`. Its `acquire` reads a job's lease and writes it in two store calls; its one test acquires in sequence and passes on the race.
- Load the working-tree skills as the README's Harness runs say, and send one turn: `<invocation> Verify the job lease in src/lease.ts. Do not ask me questions; use the defaults.`
- Check `formal.finding`, `formal.test`, and `formal.skill`: quote the final message, `git diff HEAD -- src test` (empty), `git status --short`, and `npm test`; then commit the skill, clone the repo, and run the skill's command in the clone yourself and quote the violation.
- Commit what the first turn left, then drift the code: `node .agents/skills/verify-ravn-core/scripts/scratch.ts formal-verification <same dir> fix`. It makes `acquire` one atomic `claim` call and leaves the verification as it was.
- Send the second turn: `<invocation> The lease code changed since the verification was written. Do not ask me questions; use the defaults.` Codex and Pi start a new session for it; pass Pi the generated skill with `--skill`.
- Check `formal.updated`: quote the final message, the sync commit in the verify skill beside `git log --oneline`, `git diff HEAD -- src` (empty), and the output of the skill's command run by you.

## Gotchas

- The agent picks the tool. A model checker needs its runtime: TLC needs Java on `PATH`, and the first run downloads `tla2tools.jar`, so the run needs the network.
- The first turn's check fails on purpose: the race is the finding. A reply that makes the check pass by changing `src/lease.ts` or by loosening the property fails `formal.finding`.
- The second turn starts from a failing check on a stale model. An outcome of `bug` there means the agent judged the old model against the new code; the fix commit removes the race, so the outcome after the update is `updated`.
- The scratch repo's `AGENTS.md` names `.agents/skills/` as the home of project skills. Headless Claude Code refuses writes under `.claude/` (`permission_denials` in the result event), so a verify skill written there never lands.
- Claude Code and Codex read a copy of the working-tree skills. When a skill's text changes between the two turns, copy the skills again before the second turn, so that turn runs the current text.
- Claude Code loads nothing from `.agents/skills/`; the second turn finds the verify skill by reading the repo, as the maintain skill's first step says.
