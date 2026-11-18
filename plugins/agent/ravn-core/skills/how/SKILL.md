---
name: how
description: >-
  Walk through existing code: where it lives today, who owns what, how a call
  flows, or how to follow the current pattern. For a proposed design use
  codebase-design; for historical rationale use why.
license: See LICENSE.txt
---

# How

Adapted from pstack `how`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Explore the codebase to answer "how does X work?" questions.

If the scope is ambiguous, state your interpretation and explore. The user can redirect.

## 1. Explain

Spawn one read-only subagent that explores and explains in one pass. If your harness cannot spawn subagents, do this work yourself. Give it the user's question and this brief:

> You are writing an architectural explanation for a senior engineer. Explore the codebase and write an explanation that a senior engineer unfamiliar with this area could read and walk away with a solid mental model. They should understand the architecture well enough to start working in it confidently. You have read-only access to the codebase.

## 2. Present

Present the subagent's output. Light edits for clarity or context from the conversation are fine. Do not substantially rewrite it.
