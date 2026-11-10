---
name: principle-boundary-discipline
description: >-
  Apply when wiring validation, error handling, or framework adapters.
  Concentrate guards at system boundaries (CLI, config, network, external
  APIs); trust internal types and keep business logic in pure functions.
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Boundary Discipline

Adapted from pstack `principle-boundary-discipline`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Place validation, type narrowing, and error handling at system boundaries and trust internal code. Business logic lives in pure functions; the shell is thin and mechanical, so the logic runs without the framework.

- **At boundaries** (CLI args, config files, external APIs, network protocols): validate at parse time, parse raw data into domain types, return errors, handle defensively.
- **Inside the system:** typed data, error propagation, no re-validation, no redundant nil checks deep in call chains.
- **Across the boundary:** expose domain concepts, not the boundary's private representation (transport, storage, framework, and wire types stay out of the public surface). Keep general-purpose mechanism inside and special-purpose policy at the edge.
- **Pure core:** parse functions (raw bytes to typed state), prompt construction (state in, string out), scoring and assessment (state to results).

**The tests:**
- "Is this data crossing a system boundary right now?" If not, validation is redundant.
- "Can this be a pure function that the shell just calls?" If yes, extract it.
