---
name: principle-prove-it-works
description: >-
  Apply after completing a task, before declaring done. Verify against the
  real artifact (run the feature, read the actual value, inspect the diff),
  not a proxy, self-report, or "it compiles."
disable-model-invocation: true
metadata:
  proof: subjective
---

# Prove It Works

Verify every task output against the real thing before declaring it done; a proxy can hide a wrong result. Choose checks for the changed behavior. Once they pass, repeat or broaden them only after a new change, a failure, or unresolved evidence.

- Check process liveness directly, not through derived state.
- Read the actual value, not a cached or derived representation.
- When verification fails, suspect the observation method before the system.

Verify the artifact's functional behavior first, then assess downstream business impact. This applies to existing code you are asked to verify as well as changes you made. A missing production environment or outcome dataset leaves the impact claim open while functional verification continues.

For an executable artifact:
1. Open the implementation from input to output and the existing checks for that path.
2. Attempt a check that executes the real entry point, building it when needed. Diagnose observed setup or import failures, then execute any reachable narrower implementation path.
3. Compare actual outputs with the functional contract. For changed integrations, exercise the communication path end to end.
4. Report the inspected implementation and test paths, each attempted command and actual result, and the behavior still unobserved. An unavailable check names its command, observed error, and remaining prerequisite.

Complete functional verification with execution evidence or an observed execution blocker before drawing the separate impact conclusion. A source read or hand calculation supports an inspection finding, less than executing the implementation.

When writing, changing, or keeping a test, apply [Test Behavior, Not Implementation](TEST-BEHAVIOR.md).

Delegation: trust artifacts, not self-reports. Inspect the delegate's actual output (git diff, file contents, runtime behavior), not its summary.

Disclosure: report every change you made, including edits a check would reject and anything moved out of view by stash, reset, amend, or checkout. Never shape git state so a checker sees less than you did. A check that passes because the change is hidden proves nothing.

## Script the check when you can

The strongest proof is a deterministic script that re-runs the same comparison. Run it and keep its output as an artifact a reviewer can re-run instead of trusting your word.

Keep the artifact visible for the human. Commit it only for large or complex work where the trail has to be auditable later, like a big port or migration.
