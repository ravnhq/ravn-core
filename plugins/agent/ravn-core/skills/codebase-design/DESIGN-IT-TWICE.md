# Design It Twice

Use when the user wants alternative interfaces for a chosen deepening candidate (Ousterhout: your first idea is unlikely to be the best). Uses the [SKILL.md](SKILL.md) vocabulary.

## Process

### 1. Frame the problem space

Write a user-facing explanation for the chosen candidate:

- The constraints any new interface must satisfy
- The dependencies it relies on, and their category (see [DEEPENING.md](DEEPENING.md))
- A rough illustrative code sketch that makes the constraints concrete, not a proposal

Show it to the user, then go straight to Step 2.

### 2. Spawn sub-agents

Produce 3+ **radically different** interfaces: inline for a small interface or a harness without sub-agents, otherwise with parallel sub-agents for independent alternatives. Brief each without Step 1's sketch, with the goal, file paths, coupling, dependency category from [DEEPENING.md](DEEPENING.md), what sits behind the seam, the five required outputs below, and one constraint:

- Agent 1: "Minimize the interface: 1-3 entry points max. Maximise leverage per entry point."
- Agent 2: "Maximise flexibility: support many use cases and extension."
- Agent 3: "Optimise for the most common caller: make the default case trivial."
- Agent 4 (if applicable): "Design around ports & adapters for cross-seam dependencies."

Include the [SKILL.md](SKILL.md) vocabulary and GLOSSARY.md vocabulary in each brief. Each sub-agent returns:

1. Interface: types, methods, params, invariants, ordering, error modes
2. Usage example for callers
3. What the implementation hides behind the seam
4. Dependency strategy and adapters (see [DEEPENING.md](DEEPENING.md))
5. Trade-offs: where leverage is high, where it's thin

### 3. Present and compare

Lead with the recommended design and why, or a hybrid when elements combine well. Present each design with enough context to stand alone, then compare **depth**, **locality**, and **seam placement** to complete the requested comparison.
