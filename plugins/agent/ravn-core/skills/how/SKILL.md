---
name: how
description: >-
  Explain how code works and where it belongs: runtime behavior, placement,
  ownership, and layering. Use why for motivation.
disable-model-invocation: true
license: See LICENSE.txt
---

# How

Adapted from pstack `how`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Answer "how does X work?" with an architectural explanation at the level of a senior engineer onboarding onto a subsystem: a working mental model, not annotated source code.

Each spawn below is a subagent. If your harness cannot spawn subagents, do that subagent's work yourself in turn, writing down its output before moving on. Explorers and the explainer read code only; they change nothing.

## 1. Assess complexity

If the scope is ambiguous, state your interpretation and explore. The user can redirect.

- **Simple** (a single module, a small utility, a narrow question such as "how does function X work"): explore and explain inline using `references/explainer-prompt.md` without explorer findings or reconciliation. Go to step 4.
- **Complex** (a subsystem spanning multiple files or services, a cross-cutting feature, a full architectural overview): go to step 2.

When in doubt, take the simple path.

## 2. Explore (complex only)

Decompose the question into 2 to 4 independent angles. Spawn explorers together, each with `references/explorer-prompt.md`, the question, its angle, and any known paths or findings. Each returns the template's sections once its slice is traced or the remaining gaps are named.

## 3. Synthesize (complex only)

Once every explorer has returned, including any your harness runs in the background, spawn one explainer with `references/explainer-prompt.md` and every explorer's findings filled in.

## 4. Present

Present the explanation once every angle is accounted for by code-backed findings or named gaps, with light edits for clarity or conversation context.

## Output format

The explanation uses the sections defined in `references/explainer-prompt.md`, dropping any that do not apply: Overview, Key Concepts, How It Works, Where Things Live, Gotchas.
