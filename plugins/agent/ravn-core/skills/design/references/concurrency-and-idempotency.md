# Make Operations Idempotent

Adapted from pstack `principle-make-operations-idempotent`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](../LICENSE.txt).

Design operations to converge to the correct state however many times they run and wherever the previous run stopped.

**The idea:** derive each step from the state that exists, not from what the previous run meant to do. Read the current state, compare it to the goal, and apply only the difference. A repeat then finds nothing left to do.

Anything a run leaves behind, such as a lock, a temporary file, a half-written record, or a claimed job, must be recognizable as stale by the next run. Judge staleness by evidence that stays true wherever the previous run could have stopped, not only in the common case. For example, write to a temporary path and rename it into place, or compare artifacts by content instead of by creation order.

**The test**, for every state-mutating operation:
1. What happens if this runs twice in a row?
2. What happens if the previous run crashed at every possible point?
3. Does re-execution converge to the same end state?

If any answer is "it depends on what state was left behind," the operation needs a reconciliation step.

---

# Separate Before Serializing Shared State

Adapted from pstack `principle-separate-before-serializing-shared-state`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](../LICENSE.txt).

Concurrent writes to shared state cause races that are intermittent and expensive to debug. Eliminate the sharing first; serialize structurally only when it is real. Instructions and conventions are not concurrency control.

1. **Identify shared mutable state** (files both read and write, branches both push to, APIs both define and consume).
2. **Default: eliminate the shared write target.** Ask: do these actors need one canonical object, or are they publishing independent facts? Give each actor its own owned file, key, branch, or state directory, and merge only at the read/reporting boundary. Two workers writing their own `lastX` field into one `state.json` is still shared mutation. `indexer-state.json` + `metrics-state.json` is not.
3. **Only when one shared write target is a real invariant, serialize access structurally** (lockfiles, sequential phases, single-writer actor, or atomic compare-and-swap). Treat "we need a lock" as a design smell to check, not as the default answer.
