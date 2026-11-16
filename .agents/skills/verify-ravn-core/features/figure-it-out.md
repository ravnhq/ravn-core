# Figure it out

`figure-it-out` takes ambitious, multi-part work that no narrower playbook fits. Before any code, it writes a phase plan with a falsifiable done predicate and a rigor level, with the verification harness and baseline first. It then runs each unit as a hypothesis it keeps or reverts on measurement and commits a decision trail with a verdict for each unit.

## Sub-features

- `figure.plan`: a committed plan file states the done predicate, the rigor level, and the phase list, and the commit that adds it touches no `packages/*/src` file and comes before every commit that does.
- `figure.baseline`: before the first loader change, the transcript runs a check in the repo that records each old loader's output for the same inputs, such as a script or test comparing old and new values.
- `figure.trail`: a committed decision log (`show-me-your-work` TSV) has a row for each unit, and each row's result names a verdict (VERIFIED, NOT VERIFIED, or INCONCLUSIVE) and whether the change was kept or reverted.
- `figure.result`: all three packages load their settings through one shared loader, `npm test` passes, and `TIMEOUT_MS=30s` makes that loader throw an error naming `TIMEOUT_MS`.
- `figure.reply`: the reply names the playbook it designed, the rigor level and why, the trail's path, what is verified against the predicate, and what is still open, including how it settled the variables the old loaders read differently.

## How to get to it (user POV)

An engineer types the skill's invocation form and describes a change that spans several packages and fits neither `ship`, `bug-fix`, nor `deprecate-and-migrate`. The skill is user-invoked; without the invocation form it does not load.

## Driving it with scripts/scratch.ts

- Build one scratch repo per harness: `node .agents/skills/verify-ravn-core/scripts/scratch.ts figure-it-out /tmp/ravn-verify/$RUN_ID/figure-<harness>/work`. It holds `packages/api`, `packages/worker`, and `packages/cli`, each with a hand-rolled config loader; `npm test` passes.
- Load the working-tree skills as the README's Harness runs say, and send one turn: `<invocation> Replace the hand-rolled config loaders in packages/api, packages/worker and packages/cli with one shared, validated loader that fails fast on bad values. Keep every valid setup working. Commit when done. Do not ask me questions.`
- Check `figure.plan` with `git log --stat --reverse`: quote the plan commit and the predicate and phase list in it. Check `figure.baseline` from the transcript, giving its order against the first `packages/*/src` edit.
- Check `figure.trail`: quote `git log --oneline` and the trail's rows.
- Check `figure.result`: quote `git grep -n loadConfig packages`, `npm test`, and the error from loading the shared loader with `TIMEOUT_MS=30s`.
- Check `figure.reply` from the final message.

## Gotchas

- The old loaders disagree on purpose: `DEBUG` is truthy in `api`, `"true"` in `worker`, and `"1"` in `cli`; `TIMEOUT_MS=30s` reads as 30 in `api` and `cli` but 5000 in `worker`; a missing `DATABASE_URL` is a local URL in `api` and `""` in `worker`. Any explicit, logged choice passes. A run that changes one of them silently fails `figure.reply`.
- With the plan only stated in prose, Claude Code ran baseline, loader, and migration in one shell command and wrote no plan before code, while its harness stayed in `/tmp`. The committed plan file and the in-repo harness make both orders visible in history.
- A baseline of "5 tests pass" records no values. Codex and Pi runs that used one changed `DEBUG` in `worker` and `api` and reported every valid setup unchanged. Check `figure.result` and `figure.reply` against the old loaders yourself: `DEBUG=1` in `worker` and `DEBUG=false` in `api` are the quickest probes.
- A trail kept out of git fails `figure.trail`: the skill commits it because the work is ambitious enough for a reviewer to need it.
- Pi runs without subagents, so its units run one after another in the designed order. That is the expected fallback, not a failure.
