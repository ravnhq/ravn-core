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

Sharpen the domain model as you design; merely reading `GLOSSARY.md` needs no skill. Resolve ambiguity from code and glossaries; ask only when unresolved domain meaning changes the model, and continue independent work. Finish with resolved terms and accepted ADRs written to their files.

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

Create files lazily: a `GLOSSARY.md` when the first term is resolved, `docs/adr/` when the first ADR is needed. With several contexts, use the context that owns the topic.

## During the session

### Choose the representation

For stateful logic, scattered branches, or repeated shape assumptions, apply [Model the Domain](MODEL-THE-DOMAIN.md). Put implementation representations in code and plans.

### Challenge against the glossary

When the user's term conflicts with `GLOSSARY.md`, call it out immediately: "Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?"

### Sharpen fuzzy language

Propose a precise canonical term for a vague or overloaded one: "You're saying 'account': do you mean the Customer or the User?"

### Discuss concrete scenarios

Map each proposed term to the applicable parts of its observed contract: identity, data, lifecycle, or responsibilities implemented by code. Cite those paths in the discussion, keeping implementation details out of the glossary. Where cardinality or optional participation affects meaning, stress-test the relationship with many-to-one or missing-participant cases. State whether each case is supported, forbidden, or an unresolved domain choice; ask when that choice changes the term's meaning.

### Cross-reference with code

When the user states how something works, check the code. Surface any contradiction: "Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"

### Update GLOSSARY.md inline

Update `GLOSSARY.md` the moment a term resolves, one term at a time, in the format of [GLOSSARY-FORMAT.md](./GLOSSARY-FORMAT.md). Keep proposed terms whose meaning depends on an unanswered domain choice in the discussion until resolved. It is a glossary only: terminology, with no implementation details, spec, or scratch notes.

### Offer ADRs sparingly

Offer an ADR only when all three hold, else skip it:

1. **Hard to reverse**: changing your mind later costs meaningfully
2. **Surprising without context**: a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off**: genuine alternatives, picked for specific reasons

Write an offered ADR once the user accepts it, in the format of [ADR-FORMAT.md](./ADR-FORMAT.md).
