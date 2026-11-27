---
name: statechart
description: >-
  Model-check a TLA+ spec of a system that moves between states, such as a
  product flow, a protocol, or a service, and draw it as a Mermaid statechart
  with the shortest path to each state that breaks a rule. Invoke to read a TLC
  result, to show a bug as a path through states, or for "draw this state
  machine". To create or resync a repo's long-lived formal-verification guide,
  use formal-verification-skill.
license: See LICENSE.txt
---

# Statechart

Give the reader a labeled chart of how the system moves and the shortest path to each rule that breaks. Start from a TLA+ spec and its config. When creating them, work outside the repo and write every agreed rule as an `INVARIANT`. Describe `Next` as named actions in a disjunction. Distinguish valid terminal states from deadlocks: give a valid terminal state a `Done` action that changes nothing.

```sh
node <this-skill-dir>/scripts/statechart.ts SPEC.tla [--config FILE] [--view FILE] [--out DIR]
```

The command needs Java 11 or later, from `PATH` or `JAVA`. First run downloads and checks the SHA-256 of TLC 1.7.4; offline, set `TLA2TOOLS` to a local jar. An exit 2 that names Java is a setup failure, not a verification result.

- When projecting model states and actions into a reader-facing diagram, read [View model](references/view-model.md) before writing `--view`.
- Read [TLC output](references/read-tlc-report.md) before interpreting a check, especially a bounded run or a chart that omitted states.
- For an image or a chart too large to read as text, follow [Rendering](references/render.md).

Hand back `chart.mmd` as Mermaid, each broken rule in the reader's words with its numbered path, the model's exclusions, and the command to rerun in a new output directory. If no chart was emitted, say why and give the report and state count. When a model describes real code, replay each path through the code or a test. If a step cannot happen, fix the model before calling it a bug. Changes to the spec, bounds, config or view invalidate the corresponding report or chart; rerun and show the result from that run.
