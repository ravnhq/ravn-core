---
name: show-me-your-work
description: >-
  Keep a reviewable decision trail for unattended or multi-phase work: a TSV
  log with one row per decision (what, why, evidence, result).
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Show me your work

Adapted from pstack `show-me-your-work`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Keep one canonical decision log per piece of work.

## The format

A single TSV file, one row per decision. Cells stay single-line. Write each in plain words, as you'd tell a teammate what you did. Columns:

- **ts.** ISO 8601 timestamp.
- **phase.** The phase or workstream.
- **decision.** What was chosen or done, one line.
- **why.** The reason. If a principle drove it, say what it made you do, not just its name.
- **evidence.** A pointer that proves it: commit SHA, PR number, `file:line`, or an artifact, trace, or screenshot path.
- **result.** The outcome or predicate state: `tests green`, `reverted`, `pixel-diff 0`, `INCONCLUSIVE`, `open`.

```
ts	phase	decision	why	evidence	result
2026-05-24T09:40:00Z	harness	took screenshots of the old version before changing anything	so we can compare old against new and catch any visual change	scripts/snapshot.ts, baseline/	saved 120 reference screenshots
2026-05-24T12:30:00Z	widget	threw out a helper's work because its screenshots were blank	checked the real files instead of trusting its summary	worktree reset	reverted, tightened the instructions for next time
```

## Logging a row

Append rows with the bundled script:

```bash
node <this-skill-dir>/scripts/log.ts <logfile> <phase> <decision> <why> <evidence> <result>
```

It stamps `ts`, writes the header on first use, flattens tabs and newlines, and prefixes any cell starting with `=`, `+`, `-`, or `@` with a single quote so a spreadsheet won't run it as a formula.

Log decision points and checkpoints: a fork chosen, a unit completed with its verification result, a pivot or revert with its trigger, a blocker surfaced, a gate fixed. For loop runs, one row per iteration. Skip the trivial and self-evident.

A run is one agent conversation, including its later turns and any summary of it. A pickup, a replacement agent, or a new chat starts a new run. When a run adds to a log that already has rows, its first row has phase `start`, and so does its first row after another run's `start` row; so a run returning to a log in a later turn first reads the last rows to see whether another run wrote since. A `start` row names the `ts` range of the rows before it that this run did not write, and its evidence names this run, such as its session or agent ID. Phase `start` is reserved for this.

## Where it lives

A working artifact kept out of git: `decisions.tsv` in the work dir, or `.audit/<task-slug>.tsv` when several efforts run at once. Commit it only when the work is ambitious enough that a reviewer needs the trail to trust the result.

Rows are append-only: a wrong call gets a new row that supersedes it. Prefer evidence produced by committed scripts over hand-made one-offs.

## Audit the log against the run

Before handing back, walk this run's rows against what actually happened, using this run's transcript if your harness exposes one, otherwise the conversation in your context; other sessions' transcripts stay unread. This run's rows are each stretch that begins at one of its `start` rows, or at the first row if this run created the log, and ends at the next `start` row of another run.

- Every row maps to a real decision or action.
- Each row's evidence resolves and shows what the row claims.
- A fork, pivot, or abandoned approach that shaped the work but isn't logged is a gap. Add it.

The audit only appends. A row whose claim or evidence is wrong, or that records neither a real decision nor a real action, gets a superseding row with what actually happened and a pointer that resolves. Rows outside this run's stretches are out of scope, unless this run's own work shows one is wrong.

## Independent review of the trail

Before handing back, have a reviewer that did not do the work read the trail and the run's transcript: a subagent on a different model family if your harness offers one, otherwise a fresh subagent. Your own review does not count. The reviewer flags what the user should pay attention to and leaves the work as it is:

- Decisions logged with weak or absent evidence.
- Verification steps skipped, or claimed without proof in the transcript.
- Choices that look risky in hindsight: premature, scope-creeping, papering over a symptom.
- Gaps the user would otherwise miss on a casual skim.

Every reply for a run that produced a trail ends with an **Attention** section. Its first line is `reviewed by <model>`, then each flag, pointing to specific rows or moments. "No flags" is a valid list; the model line is always there.

## Composing this skill

Other skills route their audit trail here and let it own the format.
