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
- **Route bulk to subagents.** Delegate independent scans or bulky reads that would crowd the main context; keep small reads inline. Brief with the goal, known facts, completion condition, and a summary with evidence paths as the reply. Without subagents, use bounded reads and summarize locally.
- **Size phases and cap scope.** Bound scans by the task's files and questions.
- **Preserve evidence while compressing.** Use search hits and history subjects as an index, then narrow to the behavior's source and tests and read their causal diffs. Summarize the decision with the introducing and superseding revision subjects, relevant paths and checks, and exception behavior. Keep adjacent decisions distinct; bounded output still needs the chain that answers the question.
