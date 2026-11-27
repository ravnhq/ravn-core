# Design It Twice

Use when the user wants alternative interfaces for a chosen deepening candidate (Ousterhout: your first idea is unlikely to be the best). Uses the [SKILL.md](SKILL.md) vocabulary.

## Process

### 1. Frame the problem space

Write a user-facing explanation for the chosen candidate:

- The constraints any new interface must satisfy
- The dependencies it relies on, and their category (see [DEEPENING.md](DEEPENING.md))
- A rough illustrative code sketch that makes the constraints concrete, not a proposal

Show it to the user, then go straight to Step 2; they read while the sub-agents work.

### 2. Spawn sub-agents

Spawn 3+ sub-agents in parallel, each producing a **radically different** interface for the deepened module. Give each its own technical brief (file paths, coupling details, dependency category from [DEEPENING.md](DEEPENING.md), what sits behind the seam), independent of Step 1's explanation, and one design constraint:

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

Present the designs one at a time, then contrast them in prose by **depth**, **locality**, and **seam placement**. Finish with your own recommendation: the strongest design and why, or a hybrid when elements combine well. The user wants a strong read, not a menu.
