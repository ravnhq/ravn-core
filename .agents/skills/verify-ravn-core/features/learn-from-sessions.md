# Learn from sessions

`learn-from-sessions` converts exported coding-agent feedback into approval-gated prevention proposals, preferring structural changes and checks over project or global instructions. Its structural evals run in isolated workspaces with synthetic transcripts and a sandbox global-instruction file.

## Sub-features

- `lessons.propose`: attributes reusable user expectations to source sessions, reconciles covered rules and conflicts, chooses structure, project checks, project instructions, or global instructions, and excludes unsupported agent suggestions and historical tool instructions.
- `lessons.consent`: proposal-only analysis leaves code, instructions, checks, and Git history unchanged.
- `lessons.apply`: an explicitly approved shared-boundary fix passes the existing regression suite while preserving all deferred guidance, other files, and Git history.
- `lessons.routing`: loads for learning from sessions, routes unfinished-work resumption to `session-pickup`, and stays out of a plain commit listing.
- `lessons.grader`: deterministic tests prove the checker rejects missing evidence, incorrect scope, duplicate guidance, unauthorized edits or commits, weakened tests, an unfixed historical defect, and over-restrictive fixes that break allowed inputs.

## How to get to it (user POV)

- Ask the agent to learn reusable expectations from supplied session exports and propose checks or instructions without editing yet.
- Review the proposals and explicitly approve selected items. Invoke `learn-from-sessions` again to apply that approved batch.

## Driving it with evals/run.ts

Preconditions: doctor passes, private evals are fetched, and the user approves the targeted token-spending run. Use the collector and `RUN_ID` from the parent verification skill.

1. Run `node .agents/skills/verify-ravn-core/scripts/collect.ts repo-check bun run check`. Expect the private grader tests and the skill's config-contract tests to pass.
2. Run `node .agents/skills/verify-ravn-core/scripts/collect.ts skill-evals bun run eval --skills learn-from-sessions --runners claude-code/claude-sonnet-5-5,codex/gpt-6-luna,pi/gpt-6-luna,cursor/composer-2.5 --jobs 4`.
3. Inspect `skill-evals/results/ravn-core-learn-from-sessions-*.json` under the evidence directory. Require five passing cases and zero failures or errors for each harness. Inspect the approved-application response and trajectory for the initial failing check, corrected boundary, passing rerun, and final review. Inspect proposal-only trajectories for unauthorized side effects as well as the final JSON.
4. Preserve failed attempts under a separate `RUN_ID` before rerunning; report every failed attempt and its correction.

## Gotchas

- Quality cases explicitly invoke the skill to test its outcomes independently of routing; the natural-language trigger case tests autonomous discovery. A fresh continuation turn cannot inherit the earlier proposal session's loaded skill.
- Quality assertions check proposals and workspace behavior without an LLM judge. Routing assertions use each harness's existing skill-use or trajectory checks.
- New proposals can legitimately have no related existing guidance. Existing enforcement gaps, covered rules, and conflicts must identify the relevant corpus; all supplied references must exist. Covered or conflicting guidance may name its existing instruction destination. Covered rules need no new proposal; unresolved conflicts may ask a clarification question, with the files still unchanged.
- A missing data-quality check can be classified as new guidance or an enforcement gap; the required outcome is an executable project check, not another instruction. A failing existing regression suite must still be classified as an enforcement gap, never covered.
- The regression subprocess clears `NODE_TEST_CONTEXT` so running the grader inside Node's own test runner still executes the nested regression suite.
- All transcript and corpus fixtures stay in the private eval repository. Nothing in this recipe authorizes reading real session history or changing real global instructions.
