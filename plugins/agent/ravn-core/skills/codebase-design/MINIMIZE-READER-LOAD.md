# Minimize Reader Load

Adapted from pstack `principle-minimize-reader-load`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Maintainability is the work a reader must do to understand code. Track two independent axes: **layers to trace** (indirections between the question and the answer) and **state to hold** (hidden or mutable context the reader must remember). A flat file with 50 globals is as hard to reason about as a 6-layer adapter stack. Guard both: this is the human analog of [Guard the Context Window](../principle-guard-the-context-window/SKILL.md).

- **Collapse layers** that cost more than they save: wrappers with one caller, adapters with no second implementation, speculative indirection, and pass-through layers that repeat the same methods and arguments. Inline them.
- **Make adjacent layers change the abstraction.**
- **Demand interface compression.** Prefer interfaces that hide meaningful decisions over broad ones that make readers learn the surface and the implementation.
- **Shrink state scope:** prefer pure functions (returns over mutations), locals over fields, fields over module state, and module state over globals. Derive instead of sync.
- **Name the invariant at the boundary,** not in every consumer, so the reader learns it once.
- Before adding a layer or a piece of state, ask: does it reduce reader load elsewhere by at least as much?

**The test:** can a new reader answer "where does X come from?" and "what can change X?" in under 30 seconds? If not, cut layers or cut state.
