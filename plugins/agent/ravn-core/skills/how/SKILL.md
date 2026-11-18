---
name: how
description: >-
  Trace how existing code works. Use for a walkthrough of the call path or
  ownership today, or to show how to extend an established pattern.
license: See LICENSE.txt
---

# How

Adapted from pstack `how`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Explain how the existing code works so the engineer can work in it confidently. Keep the working tree unchanged. If the scope is ambiguous, state the interpretation you traced.

1. **Trace.** Read the entry point, the handoffs it makes, and the destination in source. For a request to extend a pattern, find the closest working example and trace how it is registered and exercised.
2. **Explain.** Walk the relevant path in order, naming the files and symbols that establish each handoff. If extending the pattern, name the places the engineer would change and the checks that would prove it works.

Trace directly by default. Delegate independent paths only when you can collect the results before the final answer. A progress update or a launched agent is not the walkthrough.

For historical rationale, use [Why](../why/SKILL.md). For a proposed interface or seam, use [Codebase Design](../codebase-design/SKILL.md).
