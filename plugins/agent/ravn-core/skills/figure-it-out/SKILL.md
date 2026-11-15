---
name: figure-it-out
description: >-
  Design and run an auditable phase plan for ambitious, multi-part work that no
  narrower playbook fits: a falsifiable done predicate, riskiest-first units
  that are kept or reverted on measurement, and a committed decision trail.
  For an idea that becomes one PR, use ship; to replace or remove an API that
  still has callers, use deprecate-and-migrate.
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Figure it out

When the task matches no playbook, design one. The deliverable before any code is the workflow itself: a sequence of phases that scales rigor to the task, runs the scientific method, and leaves a decision trail a human can audit after stepping away.

Fixed-shape work has its playbook: an idea that becomes one PR goes through [ship](../ship/SKILL.md), a bug with a known symptom through [bug-fix](../bug-fix/SKILL.md), and replacing or removing an API, endpoint, or column that still has callers through [deprecate-and-migrate](../deprecate-and-migrate/SKILL.md). Switch to that skill when the task fits it, and use it for any phase of your plan that does.

## Start

Open a todolist whose first item is to read the principles table in [ask-ravn](../ask-ravn/SKILL.md#vocabulary-and-principles-underneath). Then add the phases below as todos.

## Phase A: Frame

Ground first, then commit. Before the run, state:

- The definition of done as a falsifiable predicate: a check on the real artifact that can come out false ([prove-it-works](../principle-prove-it-works/SKILL.md)).
- Scope, quantified: rough units and effort, plus the blockers grounding surfaced.
- The rigor level, biased high. One-way doors and high blast radius get more. Reversible low-stakes steps get less. Rigor is gates and artifacts, not "try harder".

Present the framing and tradeoffs before committing to a long run. Reversible work proceeds: decide, do it, and show the result. Irreversible actions (force-push, deleting data, messages to other people) wait for confirmation, and a multi-hour run earns one checkpoint.

## Phase B: Design the workflow

Decompose into atomic, independently landable units. Sequence riskiest unknown first. Subtraction comes before scaffold, and scaffold before features: anything every later unit benefits from, such as the verification harness, shared types, or CI, lands first.

- Build the verification harness in the repo before the work. Run the pre-change code on the inputs the check will use and save its outputs as the baseline, so the check reads as "old value vs new value" for each input and the reviewer can rerun it. A suite's pass count is a gate, not a baseline; the baseline is the old values. Every input whose value changes is a decision to log and report.
- For a one-way-door design decision, sketch the shape first with [Sketch First](../codebase-design/SKETCH-FIRST.md). Skip it for mechanical work whose shape is already concrete, and design once: a second design pass over a settled shape is over-engineering, and the smallest change that meets the predicate wins.
- Decide what fans out. A script that makes every edit in one pass beats workers ([build-the-lever](../principle-build-the-lever/SKILL.md)). Fan out only across seams, each worker on its own worktree or branch ([separate-before-serializing-shared-state](../principle-separate-before-serializing-shared-state/SKILL.md)), and spawn workers in your own harness on your own model family. Where the harness cannot spawn subagents, as in Pi by default, run the same units yourself, one after another, in the designed order.
- Write the designed phase list, the predicate, and the rigor level to a plan file beside the decision trail. Commit it, with the harness and its saved baseline file, before the first code change. Those commits are what the human reviews, and they show the plan and the baseline came first.

Then execute the design. Add its units to the todolist as concrete items between the Phase C and Phase D entries. Run each under the Phase C loop, and write the Phase D log as you go, a row as each unit lands, rather than saving the whole trail for the end.

## Phase C: Run the loop

Each unit is an experiment. State the hypothesis, make the smallest change, measure against the predicate on the real artifact, keep it if it advanced, and revert it if it didn't. Verify each unit before starting the next, per [Sequence Verifiable Units](../ship/SEQUENCE-VERIFIABLE-UNITS.md).

- Verify by inspecting the artifact, never a self-report. When something passes too easily, suspect the observation method before the system.
- Check delegated work against its diff and the gate yourself. If a worker games the gate, reset its work and harden the contract. If the gate itself is wrong, fix the gate in its own change rather than routing around it.
- A verdict is VERIFIED, NOT VERIFIED, or INCONCLUSIVE. Inconclusive is not a pass. Report every negative.

## Phase D: Keep the audit trail

Log the run with [show-me-your-work](../show-me-your-work/SKILL.md), plus every fork and pivot. Each unit gets its row when it lands: the hypothesis in `why`, and its verdict and outcome in `result`, such as `VERIFIED, kept` or `NOT VERIFIED, reverted`. This work is ambitious enough to commit the trail so the reviewer reads it in the PR. The trail plus the diff is what lets the human come back and trust the work.

## Phase E: Verify and hand back

Check the whole against the Phase A predicate on the real product, not just the harness. Turn any correction that recurred during the run into a gate, a lint rule, a check, or a script rather than a note.

**Reply:** the playbook you designed, the rigor level and why, the decision-trail path, what's verified against the predicate, and what's still open.
