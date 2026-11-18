# Guard the Context Window

- **Skip what you won't use.** Read selectively; leave out files the current task does not need.
- **Route bulk to a bounded reader.** If the harness can delegate, give the reader a path or query, a read-only scope, and a short evidence summary to return. Otherwise use targeted queries and bounded output yourself. Keep citations and decisions in the main thread, not raw payloads.
- **Size phases and cap scope.** Limit files per phase, set turn budgets, account for mechanism costs.
