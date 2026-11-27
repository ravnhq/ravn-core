---
name: codebase-qa
description: >-
  Invoke before answering questions about how this repository works or why it
  was built that way ("how does X work", "where is X handled", "trace this",
  "why is this here", "when did we change Y"). Uses source call paths and
  git/PR history. For third-party libraries or external specs, use research.
license: See LICENSE.txt
---

# Codebase Q&A

Adapted from pstack `how` and `why`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Answer questions about **this repository** without modifying the working tree. Pick the branch that fits the question (or run both when the user asks both how something works and why it is shaped that way).

## Call path (`how`)

Explain how the existing code works so the engineer can work in it confidently. If the scope is ambiguous, state the interpretation you traced.

1. **Trace.** Read the entry point, the handoffs it makes, and the destination in source. Trace gates that can reject, skip, retry, or otherwise change the result. For a request to extend a pattern, find the closest working example and the check that exercises it.
2. **Explain.** Walk the relevant path in order, naming the files and symbols that establish each handoff. If extending the pattern, name the places the engineer would change and the checks that would prove it works.

Trace directly by default. Delegate independent paths only when you can collect the results before the final answer. A progress update or a launched agent is not the walkthrough.

## History and rationale (`why`)

Answer from the record, not guesses from the code: read the commits and PR discussions that introduced the target and each later change, and other sources if the trail is thin. Cite what the authors wrote, mark your own inferences as inferences, and say what the record does not answer.

If the history spans many commits or the first search returns large output, read [Guard the Context Window](../ship/references/guard-the-context-window.md) before expanding the search. Keep enough of the original record to check each citation.

For a proposed interface or seam, use [Design](../design/SKILL.md). For third-party libraries, APIs, or external standards, use [Research](../research/SKILL.md).
