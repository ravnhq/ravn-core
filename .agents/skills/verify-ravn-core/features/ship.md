# ship idea-to-PR workflow

`/ravn-core:ship` takes a loose idea through planning, a verification skill, the build, and a ready-to-push check to a ready PR with passing CI on its latest commit. It chains `research`, `grilling`, `create-verification-skill` or `maintain-verification-skill`, `principle-prove-it-works`, and `pr`, so one run exercises all of them.

## Sub-features

- `ship.shape`: turn 1 offers approaches, restates the goal with an observable done condition, asks for confirmation, and writes no files.
- `ship.grill`: grilling runs in rounds, and each round ends the turn on its questions.
- `ship.plan`: the plan has a Delivery section and stops for approval.
- `ship.verify`: the branch is created first; a missing verification skill is bootstrapped where the repo keeps its project skills and committed on its own.
- `ship.ready`: the run stops before pushing and shows the branch, changes, differences from the plan, and checks.
- `ship.pr`: after delivery authorization, it pushes and opens a draft PR whose body follows the `pr` template.
- `ship.ci`: the plan identifies applicable CI gates; a failing check causes a repair, verification, commit, push, and fresh gate run before readiness. Readiness triggers a final gate with the full expected list.
- `ship.blocked`: missing, pending, cancelled, neutral, or unapproved skipped checks and changed heads prevent success; external blockers leave delivery explicitly incomplete.
- Conditional engineering principles and their decision/check pairs use the focused recipe in [Engineering principles in ship](engineering-principles.md).

## How to get to it (user POV)

- An engineer types `/ravn-core:ship <idea>` in Claude Code, `$ship <idea>` in Codex, or `/skill:ship <idea>` in Pi, then answers each turn.

## Driving it with a multi-turn driver

Preconditions: doctor exits 0 with `ok codex login`, `ok pi login`, and `ok gh auth`. The user names a target repo they accept PRs on; every harness opens a real PR there.

- Clone the target once per harness into `/tmp/ravn-verify/$RUN_ID/ship-<harness>/work`.
- Load the working-tree skills, not an installed copy:
  - Claude Code: copy `plugins/agent/ravn-core/skills/*` into the clone's project skills directory and list each in `.git/info/exclude`. A managed `ravn-core` install shadows `--plugin-dir`, so that flag tests the installed version.
  - Codex: use an isolated `HOME` with `~/.codex/auth.json` copied in, the skills under `$HOME/.agents/skills/`, `~/.gitconfig` copied in, and `GH_TOKEN=$(gh auth token)`.
  - Pi: pass `--no-skills --no-extensions --no-prompt-templates`, plus `--skill` for every `ravn-core` skill and every skill in the clone. Keep context files on so the agent sees the repo's own instructions.
- Run one turn per call and resume the same session:
  - Claude Code: `claude -p --setting-sources project --output-format stream-json --verbose --allowedTools "Bash Read Write Edit Glob Grep Skill Agent WebFetch WebSearch" [--resume <id>]`.
  - Codex: `codex exec --json --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check`, then `codex exec resume <id>`.
  - Pi: `pi -p --mode json --session-dir <dir> --session-id <uuid>`.
- Answer as the user: confirm the goal, accept grilling recommendations, approve the plan, and say yes at the ready-to-push check.
- Keep each turn's prompt, transcript, final message, tool calls, and `git status`/`log` under `.verify/$RUN_ID/ship-<harness>/turn-<n>/`.
- Check in the transcripts:
  - `ship.shape`: no file writes on turn 1.
  - `ship.grill`: a `Skill` call to `grilling` in Claude Code; numbered questions ending the turn in every harness.
  - `ship.verify`: `git switch -c` comes before the first commit, and `git log` shows the verification skill as its own commit.
  - `ship.ready`: no `git push` before the user's yes.
  - `ship.pr`: `gh pr view <N>` shows the `Summary`, `Evidence`, and `Merge Danger` sections.
  - `ship.ci`: introduce a failing architecture check in the test repo. Confirm the run reads its logs, fixes the source without weakening the gate, and waits for the new head to pass before reporting success. Include a ready-only check and confirm a second inspection after `gh pr ready`.
  - `ship.blocked`: repeat with a missing expected check or an external approval requirement. Confirm the PR stays draft and the result names incomplete delivery and its blocker.

For a focused local check of Step 13 in all three harnesses, use a scratch Git repo with a local bare remote and a synthetic `gh` on `PATH`. The adapter records calls and serves checks for the pushed head: fail on a source defect, succeed after repair, and add a new check when marked ready. Explicitly approve delivery and skip Steps 1–12. Keep the adapter outside the agent's editable source; inspect the call log and final pushed commit independently. Report this as simulated GitHub behavior, alongside a read-only gate run on a real PR. Run `node --test test/ravn-core/ship/check-ci.test.ts` for the deterministic failure cases.

## Gotchas

- Codex in `codex exec` asks grilling questions as mid-turn progress messages and carries on unless step 3 tells it that each round ends the turn. With "Keep going until the frontier is empty", it skipped grilling in 3 of 3 runs. With "Each round ends your turn", it stopped in 2 of 2. `grilling` on its own stopped correctly in 4 of 4.
- An agent bootstrapping a verification skill may kill processes it did not start, such as a broad `pkill -f`. Check `tool-calls.txt` for `pkill` or `killall`.
- Copy a refreshed Codex login back only if your own `~/.codex/auth.json` did not change during the run.
- Close the test PRs afterwards; the target repo keeps them otherwise.
