---
name: principle-guard-the-context-window
description: >-
  Apply when context is filling up: large outputs, long files, repeated
  reads, fan-out planning. Route bulk to subagents; keep summaries in the
  main thread, not raw payloads.
disable-model-invocation: true
metadata:
  proof: subjective
---

# Guard the Context Window

- **Skip what you won't use.** Read selectively; leave out files the current task does not need.
- **Route bulk to subagents.** Large outputs, long files, repeated reads, and fan-out work go to a subagent; the main thread keeps summaries, not raw payloads.
- **Size phases and cap scope.** Limit files per phase, set turn budgets, account for mechanism costs.
