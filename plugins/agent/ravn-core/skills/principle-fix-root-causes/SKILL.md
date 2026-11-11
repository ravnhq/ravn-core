---
name: principle-fix-root-causes
description: >-
  Apply when choosing where to fix a bug. Trace each symptom back to the first
  place the system went wrong and fix it there. A guard is a fix only when the
  state it handles is legitimate.
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Fix Root Causes

Adapted from pstack `principle-fix-root-causes`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

The symptom is where a wrong state became visible. The root cause is the first place the system did something it should not do, or failed to handle a state it should handle. Fix that.

- Reproduce first.
- Ask "why" at each step until the answer is a wrong decision in the code, not a consequence of an earlier one. When stuck, instrument: read the actual error and the actual state.
- Ask whether the state that triggered the symptom is legitimate. If the system may be in that state, the code that broke on it is the root cause, and handling the state there is the fix. If the state should never exist, a check where it broke hides the bug: find what produced the state. Guards, retries, swallowed errors, clamped values, and discarded state are the usual ways to hide a bug.
- When something fails only after a restart, suspect persisted state first: config files, caches, lock files, serialized state.
- Find and fix every instance of the same fault the task covers; report unrelated nearby problems.
- A workaround that needs a paragraph-long comment means the code is wrong: fix the code.
- If the deciding fact took a deep dig to find, propose the cheap, always-on signal that would have shown it at first look.
