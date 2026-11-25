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

When no fixed playbook fits, design one: a phase plan with a falsifiable done predicate, riskiest-first experiments, and a committed decision trail a human can audit after stepping away.

If the task fits a narrower playbook — [ship](../ship/SKILL.md) (one PR from an idea), [bug-fix](../bug-fix/SKILL.md) (known bug), or [deprecate-and-migrate](../deprecate-and-migrate/SKILL.md) (replacing/removing an API with callers) — switch to it, or invoke it for any phase that fits.

Add the phases below as todos. Read linked guidance when its condition holds.

## Phase A: Frame

Ground first, then state:

- **Done predicate:** a falsifiable check on the real artifact ([prove-it-works](../principle-prove-it-works/SKILL.md)).
- **Scope:** rough units, effort, and blockers surfaced by grounding.
- **Rigor level** (biased high): one-way doors and high blast radius get stricter gates and artifacts; reversible low-stakes steps get less.

Present the framing and tradeoffs before a long run. Reversible work proceeds; irreversible actions (force-push, deleting data, external messages) wait for confirmation, and multi-hour runs get one checkpoint.

## Phase B: Design the workflow

Decompose into atomic, independently landable units: riskiest unknown first; subtraction before scaffold; scaffold (verification harness, shared types, CI) before features.

- **Build the harness and baseline first:** run the pre-change code on the check's inputs and save its outputs as the baseline ("old value vs. new value" per input, rerunnable by a reviewer). A test pass count is a gate, not a baseline. Log and report every input whose value changes.
- **Sketch one-way doors once:** use [Sketch First](../codebase-design/SKETCH-FIRST.md) for one-way-door design decisions; skip it for mechanical work. The smallest change meeting the predicate wins.
- **Build levers for repeated work:** read [Build the Lever](../principle-build-the-lever/SKILL.md); one script beats fanning out workers. If delegating, give each worker explicit inputs, a verifiable output, and an owned write scope per [Separate Before Serializing Shared State](../principle-separate-before-serializing-shared-state/SKILL.md) (same harness and model family; without subagents, run units sequentially yourself).
- **Commit the plan, harness, and baseline** beside the decision trail before the first product edit. Phase C starts only when that commit replays the old outputs. If inputs or harness change later, rerun against the pre-change revision — never use post-change values as baseline.

Add the concrete units to the todolist between Phase C and Phase D, and log each unit in Phase D as it lands.

## Phase C: Run the loop

Treat each unit as an experiment: state the hypothesis, make the smallest change, measure against the predicate on the real artifact, keep if it advances, revert if not. Verify each unit before starting the next ([Sequence Verifiable Units](../ship/SEQUENCE-VERIFIABLE-UNITS.md)).

- Inspect the artifact directly, never a self-report. When something passes too easily, suspect the observation method first.
- Verify delegated work against its diff and gate yourself. If a worker games the gate, reset its work and harden the contract; if the gate is wrong, fix the gate in its own change.
- Verdict is `VERIFIED`, `NOT VERIFIED`, or `INCONCLUSIVE` (not a pass). Report every negative.

## Phase D: Keep the audit trail

Log every unit, fork, and pivot with [show-me-your-work](../show-me-your-work/SKILL.md) as it lands: hypothesis in `why`, verdict and outcome in `result` (e.g., `VERIFIED, kept` or `NOT VERIFIED, reverted`). Commit the trail so reviewers can audit it in the PR.

## Phase E: Verify and hand back

Check the whole against the Phase A predicate on the real product, not just the harness. Turn any recurring correction from the run into a gate, lint rule, check, or script rather than a note.

**Reply:** the playbook designed, rigor level and rationale, decision-trail path, what is verified against the predicate, and what remains open.
