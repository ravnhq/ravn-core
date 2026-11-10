---
name: domain-modeling
description: >-
  Build and sharpen a project's domain model. Use when discussing codebase
  terminology, writing a GLOSSARY.md or ADR, or choosing structures for stateful
  logic, scattered branches, or repeated shape assumptions.
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Domain Modeling

Actively build and sharpen the project's domain model as you design: challenge terms, invent edge-case scenarios, and write the glossary and decisions down the moment they crystallise. Use it when changing the model; merely reading `GLOSSARY.md` for vocabulary needs no skill.

## File structure

A single-context repo has one `GLOSSARY.md` at the root and ADRs in `docs/adr/`. A `GLOSSARY-MAP.md` at the root marks a multi-context repo; the map points to each context's glossary, and each context may hold its own `docs/adr/` beside system-wide ones:

```
/
├── GLOSSARY-MAP.md
├── docs/adr/                         ← system-wide decisions
└── src/
    ├── ordering/
    │   ├── GLOSSARY.md
    │   └── docs/adr/                 ← context-specific decisions
    └── billing/
        └── GLOSSARY.md
```

Create files lazily: a `GLOSSARY.md` when the first term is resolved, `docs/adr/` when the first ADR is needed. With several contexts, infer which one the topic belongs to; ask if unclear.

## During the session

### Choose the representation

For stateful logic, scattered branches, or repeated shape assumptions, apply [Model the Domain](MODEL-THE-DOMAIN.md). Implementation representations belong in code and plans, never in `GLOSSARY.md`.

### Challenge against the glossary

When the user's term conflicts with `GLOSSARY.md`, call it out immediately: "Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?"

### Sharpen fuzzy language

Propose a precise canonical term for a vague or overloaded one: "You're saying 'account': do you mean the Customer or the User?"

### Discuss concrete scenarios

Stress-test domain relationships with invented scenarios that probe edge cases and force the user to be precise about where concepts divide.

### Cross-reference with code

When the user states how something works, check the code. Surface any contradiction: "Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"

### Update GLOSSARY.md inline

Update `GLOSSARY.md` the moment a term resolves, one term at a time, in the format of [GLOSSARY-FORMAT.md](./GLOSSARY-FORMAT.md). It is a glossary only: terminology, with no implementation details, spec, or scratch notes.

### Offer ADRs sparingly

Offer an ADR only when all three hold, else skip it:

1. **Hard to reverse**: changing your mind later costs meaningfully
2. **Surprising without context**: a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off**: genuine alternatives, picked for specific reasons

Write it in the format of [ADR-FORMAT.md](./ADR-FORMAT.md).
