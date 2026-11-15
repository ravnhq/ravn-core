---
name: web-qa
description: "Explore a running web app like a user and report each bug with screenshots and repro steps. Use to QA, dogfood, or bug-hunt a web app, page, or flow."
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Web QA

Explore a running web app the way a user does, and report every issue with the evidence someone needs to replay it.

Only the target is required: a URL, or the app in this repo. Unless the user says otherwise, the whole app is in scope, the session is named after the host (`localhost-4173`), and evidence goes to `web-qa-output/` at the repo root. Start right away with these defaults; ask the user only for a sign-in you have no credentials for.

## 1. Set up

1. Check the driver with `agent-browser --version`. If the command is missing, end the run at this step with this reply, because installing software, a one-off package download included, is the user's call: "web-qa drives the browser with the agent-browser CLI. Install it with `npm install -g agent-browser` and then `agent-browser install`, or with `brew install agent-browser`." Then read `agent-browser skills get core` once: it documents the commands of the installed version.
2. Reach the app. When the repo has a `verify-<app>` skill, launch, seed, and sign in through it, and take the feature list from its map. Otherwise use the repo's documented start command. Sign in only with credentials the user gave or the repo seeds; ask the user for a one-time code.
3. Create `<out>/screenshots` and `<out>/videos`, write a `.gitignore` holding `*` in `<out>` so git leaves the evidence out, copy [the report template](assets/report-template.md) to `<out>/report.md`, fill in its header, and run `agent-browser --session <session> open <url>`.

Done when the app's first page renders in the session.

## 2. Explore and document

Read [the issue taxonomy](references/issue-taxonomy.md) first: it sets the severities and what to look for.

Work through the app as a user: each top-level section from the main navigation, then the controls, forms, dialogs, and end-to-end flows inside it, with empty, error, and boundary inputs. On each page, take `snapshot -i` and `screenshot --annotate`, and read `errors` and `console`. Look at every screenshot you take: an invisible label, clipped text, or an overlap shows only in the pixels, while the snapshot still lists the element. Judge the app by what the browser shows, never by its source.

When something looks wrong, reproduce it once more, then document it before you explore further, appending it to the report as the next `ISSUE-NNN`:

- **Static**, visible on load (a typo, clipped or invisible text, a misaligned element, a console error on load): one annotated screenshot, and `N/A` for the repro video.
- **Interactive**, needing actions (a dead control, a wrong state, an error on submit): `record start <out>/videos/issue-NNN-repro.webm`, a screenshot after each step at human pace (`sleep 1` between actions, `type` rather than `fill`, `sleep 2` before the result), an annotated screenshot of the broken state, then `record stop`. Recording needs `ffmpeg`; without it, keep the step screenshots and write "no video: ffmpeg missing".

Each issue gets numbered repro steps, each step pointing at its screenshot, and says what was expected and what happened. When the app shows real people's data, redact each capture by [the PR screenshot rules](../pr/references/screenshots.md#3-redact-and-audit).

Done when every section in scope has been visited and every issue found has its report entry. Depth beats count: on a large app, stop at 5 to 10 fully evidenced issues.

## 3. Wrap up

1. Make the summary counts match the `### ISSUE-` blocks.
2. Run `agent-browser --session <session> close`, and stop any app process you started.
3. Reply with the report path, the counts by severity, and each issue's title, severity, and screenshot path.
