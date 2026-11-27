# Figure it out

When no fixed playbook fits, design one: a phase plan with a falsifiable done predicate, riskiest-first experiments, and a committed decision trail a human can audit after stepping away.

Fixed-shape work has its playbook: an idea that becomes one PR goes through [ship](../../ship/SKILL.md), a bug with a known symptom through [bug-fix](../../debug/SKILL.md), and replacing or removing an API, endpoint, or column that still has callers through [deprecate-and-migrate](../../migrate/SKILL.md). Switch to that skill when the task fits it, and use it for any phase of your plan that does.

Add the phases below as todos. Read linked guidance when its condition holds.

## Phase A: Frame

Ground first, then state:

- The definition of done as a falsifiable predicate: a check on the real artifact that can come out false ([prove-it-works](../../verify/SKILL.md)).
- Scope, quantified: rough units and effort, plus the blockers grounding surfaced.
- The rigor level, biased high. One-way doors and high blast radius get more. Reversible low-stakes steps get less. Rigor is gates and artifacts, not "try harder".

Present the framing and tradeoffs before a long run. Reversible work proceeds; irreversible actions (force-push, deleting data, external messages) wait for confirmation, and multi-hour runs get one checkpoint.

## Phase B: Design the workflow

Decompose into atomic, independently landable units: riskiest unknown first; subtraction before scaffold; scaffold (verification harness, shared types, CI) before features.

- Build the verification harness in the repo before the work. Run the pre-change code on the inputs the check will use and save its outputs as the baseline, so the check reads as "old value vs new value" for each input and the reviewer can rerun it. A suite's pass count is a gate, not a baseline; the baseline is the old values. Every input whose value changes is a decision to log and report.
- For a one-way-door design decision, sketch the shape first with [Sketch First](../../design/SKETCH-FIRST.md). Skip it for mechanical work whose shape is already concrete, and design once: a second design pass over a settled shape is over-engineering, and the smallest change that meets the predicate wins.
- For repeated work, read [Build the Lever](../../migrate/references/build-the-lever.md); a script that handles every unit in one pass beats workers. If delegating, give each worker inputs, a verifiable output, and an owned write scope by [Separate Before Serializing Shared State](../../design/references/concurrency-and-idempotency.md). Use your own harness and model family; without a subagent tool, run the units yourself in order.
- Write the phase list, predicate, and rigor level beside the decision trail. Commit the plan, harness, and saved baseline before the first product edit. Phase C starts only when that commit can replay the old outputs. If inputs or harness change later, rerun them against the pre-change revision and record the new comparison; do not use post-change values as the baseline.

Add the concrete units to the todolist between Phase C and Phase D, and log each unit in Phase D as it lands.

## Phase C: Run the loop

Each unit is an experiment. State the hypothesis, make the smallest change, measure against the predicate on the real artifact, keep it if it advanced, and revert it if it didn't. Verify each unit before starting the next, per [Sequence Verifiable Units](../../ship/SEQUENCE-VERIFIABLE-UNITS.md).

- Inspect the artifact directly, never a self-report. When something passes too easily, suspect the observation method first.
- Verify delegated work against its diff and gate yourself. If a worker games the gate, reset its work and harden the contract; if the gate is wrong, fix the gate in its own change.
- Verdict is `VERIFIED`, `NOT VERIFIED`, or `INCONCLUSIVE` (not a pass). Report every negative.

## Phase D: Keep the audit trail

Log the run with [show-me-your-work](../../plan/references/decision-log.md), plus every fork and pivot. Each unit gets its row when it lands: the hypothesis in `why`, and its verdict and outcome in `result`, such as `VERIFIED, kept` or `NOT VERIFIED, reverted`. This work is ambitious enough to commit the trail so the reviewer reads it in the PR. The trail plus the diff is what lets the human come back and trust the work.

## Phase E: Verify and hand back

Check the whole against the Phase A predicate on the real product, not just the harness. Turn any recurring correction from the run into a gate, lint rule, check, or script rather than a note.

**Reply:** the playbook designed, rigor level and rationale, decision-trail path, what is verified against the predicate, and what remains open.
