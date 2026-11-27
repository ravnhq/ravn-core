---
name: verify
description: >-
  Invoke before claiming a feature, fix, or delegated task is done ("does it
  work?", "verify this", "check it against the real code"), OR before
  measuring, trusting, or reporting a benchmark, latency, speedup, or eval
  number. Exercises the real artifact rather than proxies or self-reports. For
  exploratory browser QA, use web-qa.
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Verify

"Explain the Number" is adapted from pstack `principle-explain-the-number`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Verify every task output and every measured claim against the real thing before declaring it done or acting on it. Indirect checks (file mtimes, cached screenshots, self-reports, "it compiles") feel cheaper and cost far more when wrong.

## Prove it works

- Check process liveness directly, not through derived state.
- Read the actual value, not a cached or derived representation.
- When verification fails, suspect the observation method before the system.

For code and features:
1. Build it (necessary but not sufficient).
2. Run it and exercise the actual feature path.
3. Check the full chain: does data flow from input to output?
4. For integrations, test the full communication path end-to-end.

When writing, changing, or keeping a test, apply [Test](../test/SKILL.md).

**Delegation:** trust artifacts, not self-reports. Inspect the delegate's actual output (`git diff`, file contents, runtime behavior), not its summary.

**Disclosure:** report every change you made, including edits a check would reject and anything moved out of view by stash, reset, amend, or checkout. Never shape git state so a checker sees less than you did.

**Script the check when you can:** a deterministic script that re-runs the same comparison turns "trust me" into "run this". Keep its output visible for the human; commit it for large or complex work where the trail must be auditable later.

## Explain the number (benchmarks, perf, evals)

Before measuring, trusting, or reporting a speedup, regression, throughput, latency, or eval result:

- **Write the decision before you run.** Name the result that would change a decision, and the noise floor. Stop when run-to-run spread is larger than the effect.
- **Ask "why not double?"** Name the resource or code path that bounds the result (core, lock, disk, network, load generator) from a profile or system counters taken during a run, mapped to source. A guess from reading code is not a limiter.
- **List what else the number could be measuring, and rule out each one with evidence** (errors, skipped/cached work, code that never ran, untuned defaults, noise, or a piece too small to matter end-to-end).
- **Keep the evidence with the number:** run count, spread, and named limiter.

For a performance benchmark, follow the full [benchmark checklist](BENCHMARK-CHECKLIST.md). For exploratory web-app QA, use [Web QA](../web-qa/SKILL.md).
