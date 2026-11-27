# Model the Domain

Adapted from pstack `principle-model-the-domain`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Encode the real domain in a data structure instead of scattering it across conditionals. A structure that matches the domain makes invalid states unrepresentable and deletes branches. Choose it at write time; recovering it later gets deferred as a refactor.

Reach for:

- A state machine instead of scattered booleans, phases, or lifecycle checks.
- A typed model instead of loose parameters or repeated shape assumptions.
- A map, registry, lookup table, or discriminated union instead of branching spread across files.
- A reducer or command/event model instead of ad hoc state mutations.
- A module organized around one body of domain knowledge instead of a sequence such as load, validate, transform, and save. Execution order is not ownership.
- A small module boundary that gathers repeated behavior, ownership, or invariants.
- A queue, cache, index, graph, tree, or normalized collection where the access pattern calls for it.
- Any other structure that fits. When none fits, work out what the code must never allow and how the data gets read, then find the structure that encodes exactly that.

Keep boring code when the current shape is clear, local, and unlikely to grow. An abstraction earns its place only by removing branches, duplicated rules, invalid states, or lifecycle risk.

Signs you skipped this: a feature that grows an if/else chain by one more branch, a second boolean that must stay in sync with the first, and phase-named modules (temporal decomposition) that repeat the same domain rules across steps.
