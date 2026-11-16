# Web QA and PR screenshots

`web-qa` explores a running web app in a real browser and reports each issue with screenshots and repro steps. For a visual change, `pr` loads `references/screenshots.md` and lays out before/after screenshots of the real build as **Changed** and **Unchanged** tables.

## Sub-features

- `webqa.bug`: the report under `web-qa-output/` has an issue whose title or description says the "Place order" button's label is invisible or unreadable, with numbered repro steps (open the cart, look at the button) and a screenshot path that exists and shows the blank button. The reply names that issue. `git status --short` is empty: the output directory ignores itself.
- `webqa.driver`: with `agent-browser` off `PATH`, the reply says the agent-browser CLI is missing and gives its install command, and no report is written.
- `pr.screenshots`: on the `fix` branch, the reply's PR body has a `**Changed**` table with a `Location | Before | After` header, a `›` breadcrumb location such as `Cart`, and alt text naming row and side. Both image files exist, the "before" one shows the blank button and the "after" one its white label, and the transcript shows `agent-browser diff screenshot` reporting a difference for the pair.

## How to get to it (user POV)

- An engineer asks the agent to QA the app; `web-qa` is model-invoked, so the request need not name it.
- On a branch with a visual fix, the engineer asks for a PR body with screenshots; `pr` is model-invoked.

## Driving it with scripts/scratch.ts

- Build one scratch repo per harness: `node .agents/skills/verify-ravn-core/scripts/scratch.ts web-qa /tmp/ravn-verify/$RUN_ID/web-qa-<harness>/work`. It is a one-page cart served by `npm start` on `$PORT` (default 4173); the "Place order" label is painted in the button's own background color.
- Give each harness its own port. Load the working-tree skills as the README's Harness runs say, with `agent-browser` on `PATH`, and send one turn: `Start the app on port <port> and QA it. Do not ask me questions; use the defaults.`
- Check `webqa.bug`: quote the reply, the issue block from the report, and open its screenshot.
- Check `webqa.driver` in one harness with a `PATH` that lacks `agent-browser`, using the same prompt.
- Drift to the fix: `node .agents/skills/verify-ravn-core/scripts/scratch.ts web-qa <same dir> fix` commits the white label on `fix/place-order-label`. Send: `Write the PR body for this branch with before and after screenshots; main is the base. There is no remote, so show me the markdown instead of uploading. Do not ask me questions.`
- Check `pr.screenshots`: quote the tables and the diff line, and open both images.

## Gotchas

- `agent-browser` is the prerequisite: `npm install -g agent-browser`, then `agent-browser install` if no Chrome is found. Recording video needs `ffmpeg`; the seeded bug is static, so the run needs no video.
- Headless Claude Code refuses edits to `.git/info/exclude` as a sensitive file, so the skill ignores its output with a `.gitignore` inside it.
- Under Codex's `workspace-write` sandbox, Chrome cannot write its profile or crash dir and exits at launch; the agent recovers with `--args --no-sandbox` and a socket dir under `/tmp`. The README's bypass flag avoids it.
- The accessibility snapshot lists the button as `Place order`, so an agent that never looks at its screenshots reports no bug. That miss fails `webqa.bug`.
- The scratch repo has no remote, so the PR turn shows markdown with relative image paths instead of uploading. To check `--attach`, push the branch to a throwaway fork and attach there, never to a shared repo.
- After each harness, stop the app server and close the sessions the run opened (`agent-browser session list`, then `agent-browser --session <name> close`); a leftover server holds its port.
