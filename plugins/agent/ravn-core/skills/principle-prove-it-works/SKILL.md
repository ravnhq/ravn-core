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

Pin the behavior the user wants verified, separating the artifact's functional contract from downstream business impact. When the full environment is unavailable, inspect the changed implementation and its existing checks, run the narrower applicable checks, and name the remaining prerequisite. For each check, report the implementation and test paths inspected, command, actual result, and scope still unobserved. A source read or hand calculation establishes less than executing the implementation; missing production data leaves narrower artifact checks to run.

For executable code and features, use the applicable steps:
1. Build it when needed to exercise the artifact (necessary but not sufficient)
2. Run it and exercise the actual changed feature path
3. Check the full chain: does data flow from input to output?
4. For changed integrations, test the full communication path end-to-end

When writing, changing, or keeping a test, apply [Test Behavior, Not Implementation](TEST-BEHAVIOR.md).

Delegation: trust artifacts, not self-reports. Inspect the delegate's actual output (git diff, file contents, runtime behavior), not its summary.

Disclosure: report every change you made, including edits a check would reject and anything moved out of view by stash, reset, amend, or checkout. Never shape git state so a checker sees less than you did. A check that passes because the change is hidden proves nothing.

## Script the check when you can

The strongest proof is a deterministic script that re-runs the same comparison. Run it and keep its output as an artifact a reviewer can re-run instead of trusting your word.

Keep the artifact visible for the human. Commit it only for large or complex work where the trail has to be auditable later, like a big port or migration.
