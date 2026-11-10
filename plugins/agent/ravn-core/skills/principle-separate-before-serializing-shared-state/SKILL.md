---
name: principle-separate-before-serializing-shared-state
description: >-
  Apply when concurrent actors might write to the same file, branch, key, or
  state object. Eliminate the sharing first; serialize structurally only when
  one shared writer is a real invariant.
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Separate Before Serializing Shared State

Adapted from pstack `principle-separate-before-serializing-shared-state`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Concurrent writes to shared state cause races that are intermittent and expensive to debug. Eliminate the sharing first; serialize structurally only when it is real. Instructions and conventions are not concurrency control.

1. **Identify shared mutable state** (files both read and write, branches both push to, APIs both define and consume).
2. **Default: eliminate the shared write target.** Ask: do these actors need one canonical object, or are they publishing independent facts? Give each actor its own owned file, key, branch, or state directory, and merge only at the read/reporting boundary. Two workers writing their own `lastX` field into one `state.json` is still shared mutation. `indexer-state.json` + `metrics-state.json` is not.
3. **Only when one shared write target is a real invariant, serialize access structurally** (lockfiles, sequential phases, single-writer actor, or atomic compare-and-swap). Treat "we need a lock" as a design smell to check, not as the default answer.
