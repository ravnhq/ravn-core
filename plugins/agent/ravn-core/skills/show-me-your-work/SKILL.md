---
name: show-me-your-work
description: >-
  Keep a reviewable decision trail for long-running or unattended work: a TSV
  log with one row per decision (what, why, evidence, result). Use for
  autonomous or multi-phase runs, or work a human reviews after stepping away.
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Show me your work

Adapted from pstack `show-me-your-work`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Keep one canonical decision log per piece of work.

## The format

A single TSV file, one row per decision. Cells stay single-line. Evidence is a pointer, not prose. Columns:

- **ts.** ISO 8601 timestamp.
- **phase.** The phase or workstream.
- **decision.** What was chosen or done, one line.
- **why.** The reason in plain words. If a principle drove it, say what it made you do, not just its name.
- **evidence.** A link or path that proves it: commit SHA, PR number, `file:line`, or an artifact, trace, or screenshot path. Never a paragraph.
- **result.** The outcome or predicate state: `tests green`, `reverted`, `pixel-diff 0`, `INCONCLUSIVE`, `open`.

An example, plain-spoken so a reviewer reads it at a glance:

```
ts	phase	decision	why	evidence	result
2026-05-24T09:02:00Z	frame	counted the work first, about 100 components and roughly 75 hours	wanted to know the size before starting a long run	commit 3a9f1c2	found 5 things to sort out before starting
2026-05-24T09:40:00Z	harness	took screenshots of the old version before changing anything	so we can compare old against new and catch any visual change	scripts/snapshot.ts, baseline/	saved 120 reference screenshots
2026-05-24T11:15:00Z	widget	moved the widget styles over without changing how it looks	keep the change small and the result identical	commit 7c21e0a, pixel-diff 0	looks identical, tests pass
2026-05-24T12:30:00Z	widget	threw out a helper's work because its screenshots were blank	checked the real files instead of trusting its summary	worktree reset	reverted, tightened the instructions for next time
```

## Logging a row

Write each entry the way you'd tell a teammate what you did: plain words, concrete actions.

Append rows with the bundled script:

```bash
node <this-skill-dir>/scripts/log.ts <logfile> <phase> <decision> <why> <evidence> <result>
```

It stamps `ts`, writes the header on first use, flattens tabs and newlines, and prefixes any cell starting with `=`, `+`, `-`, or `@` with a single quote so a spreadsheet won't run it as a formula.

Log decision points and checkpoints: a fork chosen, a unit completed with its verification result, a pivot or revert with its trigger, a blocker surfaced, a gate fixed. For loop runs, one row per iteration. Leave out the trivial and self-evident.

A run is one agent conversation, including its later turns and any summary of it. A pickup, a replacement agent, or a new chat starts a new run. When a run adds to a log that already has rows, its first row has phase `start`, and so does its first row after another run's `start` row. So a run that comes back to a log in a later turn first reads the log's last rows to see whether another run wrote since. A `start` row names the `ts` range of the rows before it that this run did not write, and its evidence names this run, such as its session or agent ID. Use phase `start` for nothing else.

## Where it lives

By default the log is a working artifact, kept out of git: `decisions.tsv` in the work dir, or `.audit/<task-slug>.tsv` when several efforts run at once.

Commit it only when the work is ambitious enough that a reviewer needs the trail to trust the result.

## Rules

- Append-only. A wrong call gets a new row that supersedes it; history stays as written.
- Prefer evidence produced by committed scripts over hand-made one-offs.

## Audit the log against the run

At the end of the run, before handing back, check that the log told the truth. Walk this run's rows against what actually happened, using this run's transcript if your harness exposes one, otherwise the conversation in your context. Read only this run's transcript, never other sessions'. This run's rows are each stretch that begins at one of its `start` rows, or at the first row if this run created the log, and ends at the next `start` row of another run.

- Every row maps to a real decision or action.
- Each row's evidence resolves and shows what the row claims.
- A fork, pivot, or abandoned approach that shaped the work but isn't logged is a gap. Add it.

Correct the log, not the story: the audit only appends. When a row records neither a real decision nor a real action, or its claim or evidence is wrong, add a row that supersedes it with what actually happened and a pointer that resolves. Rows outside this run's stretches are out of scope, unless this run's own work shows one is wrong; supersede it like any wrong call.

## Independent review of the trail

Before handing back, have a reviewer that did not do the work read the trail and the run's transcript: a subagent on a different model family if your harness offers one, otherwise a fresh subagent. Your own review does not count. The reviewer flags what the user should pay attention to; it does not redo the work:

- Decisions logged with weak or absent evidence.
- Verification steps skipped, or claimed without proof in the transcript.
- Choices that look risky in hindsight: premature, scope-creeping, papering over a symptom.
- Gaps the user would otherwise miss on a casual skim.

Every reply for a run that produced a trail ends with an **Attention** section. Its first line is `reviewed by <model>`, then each flag, pointing to specific rows or moments. "No flags" is a valid list; the model line is always there.

## Reviewing the trail

Read top to bottom, follow the evidence pointers, spot-check. GitHub renders a committed TSV as a table. In a terminal, `column -s$'\t' -t decisions.tsv` aligns it.

## Composing this skill

Other skills route their audit trail here instead of inventing one. Reference it by name and let it own the format.
