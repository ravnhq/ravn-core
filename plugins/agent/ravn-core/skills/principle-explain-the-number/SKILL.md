---
name: principle-explain-the-number
description: >-
  Apply before you trust, report, or act on a measured number (speedup,
  regression, throughput, latency, eval result). Find what limits it, and rule
  out that it measured something other than the work you think.
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Explain the Number

Adapted from pstack `principle-explain-the-number`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

For performance numbers, apply these checks within the [benchmark checklist](BENCHMARK-CHECKLIST.md)'s scope, including its quick-ballpark exception.

- **Trace the count.** Read the relevant measurement and admission code: distinguish attempted, admitted, completed, and failed work, and locate configured caps and their windows. Name a policy cap as a possible ceiling, separate from a limiter established by runtime evidence. Include those source-backed facts when explaining what remains unmeasured.
- **Ask "why not double?"** Name the resource or code path that bounds the result, such as a core, a lock, the disk, the network, or the load generator itself. Get it from a profile or from system counters taken during a run, then map it to source. A guess from reading the code is not a limiter. If you cannot say why the number is not twice as good, you do not know what you measured.
- **List what else the number could be measuring, and rule out each one with evidence.** The usual suspects are errors, skipped or cached work, code that never ran, an untuned side (one left on default settings), noise, and a piece too small to matter end to end.
- **Keep the evidence with the number.** Put the run count, the spread, and the limiter in the notes or a linked artifact.

For eval results, check that every run did the task, the gap holds across trials and models, and the scenario matters.

Time saved beyond what the changed piece took signals a bad measurement.

Distinct from [Prove It Works](../principle-prove-it-works/SKILL.md), which checks that an output is real.
