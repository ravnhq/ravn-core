# Boundary Discipline

Adapted from pstack `principle-boundary-discipline`, MIT License, Copyright (c) 2026 Lauren Tan. See [the pstack license](LICENSE-pstack.txt).

Place validation, type narrowing, and error handling at system boundaries and trust internal code. Business logic lives in pure functions; the shell is thin and mechanical, so the logic runs without the framework.

- **At boundaries** (CLI args, config files, external APIs, network protocols): validate at parse time, parse raw data into domain types, return errors, handle defensively.
- **Inside the system:** typed data, error propagation, no re-validation, no redundant nil checks deep in call chains.
- **Across the boundary:** expose domain concepts, not the boundary's private representation (transport, storage, framework, and wire types stay out of the public surface). Keep general-purpose mechanism inside and special-purpose policy at the edge.
- **Pure core:** parse functions (raw bytes to typed state), prompt construction (state in, string out), scoring and assessment (state to results).

For a validation proposal, name the raw representation, what values the adapter accepts, and what an unknown input returns. Identify the first consumer that can trust the parsed type.

**The tests:**
- "Is this data crossing a system boundary right now?" If not, validation is redundant.
- "Can this be a pure function that the shell just calls?" If yes, extract it.
