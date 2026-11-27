---
name: design
description: >-
  Invoke before designing a module interface or seam ("how should we structure
  this", "one module or two", "where does this belong"), settling domain terms,
  GLOSSARY.md, or ADRs ("what should we call this"), writing/reviewing
  TypeScript types, designing retry-safe/idempotent or concurrent shared-state
  operations, or surveying a repo for refactor candidates.
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Design

Design **deep modules**: much behaviour behind a small interface, placed at a clean seam, named in the domain's own language, and testable through that interface.

## Choose the branch

Read the disclosed reference for the decision in front of you:

- **Module seam, interface, or split/merge decision (default):** follow the steps and vocabulary below.
- **Raw inputs or adapters:** read [Boundary Discipline](references/boundary-discipline.md) before placing validation.
- **New type, signature, or TypeScript safety:** read [Type System Discipline](references/type-system-discipline.md) and, in TypeScript, [TypeScript Best Practices](references/typescript.md) (with [examples](references/typescript-patterns.md)).
- **Domain terms, `GLOSSARY.md`, ADRs, or stateful representations:** read [Domain Modeling](references/domain-modeling.md) (links [Model the Domain](MODEL-THE-DOMAIN.md), [GLOSSARY-FORMAT.md](GLOSSARY-FORMAT.md), [ADR-FORMAT.md](ADR-FORMAT.md)).
- **Retries, restarts, migrations, or concurrent writers of shared state:** read [Concurrency and Idempotency](references/concurrency-and-idempotency.md).
- **Repo-wide refactor survey ("where should we refactor", "audit architecture"):** read [Architecture Survey](references/architecture-survey.md) (produces an HTML shortlist per [HTML-REPORT.md](HTML-REPORT.md)).

## Module design steps

1. **Trace the decision in current code.** For each relevant path, cite where it starts, what it shares, and what it owns. If two paths implement the same behavior, find the existing check that keeps them in sync. If the user only asked for a walkthrough, use [Codebase Q&A](../codebase-qa/SKILL.md).
2. **Resolve the design branch** using the references above.
3. **Deliver one recommendation.** Show the proposed interface or the reason to keep the existing split and what stays with each caller. Give one concrete test through the chosen interface: what goes in and what observable result must come out. A recommendation alone leaves the code unchanged.

## Vocabulary and principles

- **Module:** anything with an interface and an implementation, at any scale.
- **Interface:** everything a caller must know to use the module correctly (types, invariants, ordering, error modes, config).
- **Depth:** leverage at the interface—much behaviour behind a small interface (**deep**), not a pass-through (**shallow**).
- **Seam:** where you can alter behaviour without editing in place; introduce a seam only where something actually varies across it (two adapters, not one).
- **The deletion test:** if deleting a module makes complexity vanish, it was a pass-through; if complexity reappears across N callers, it earned its keep.
- **The interface is the test surface:** accept dependencies instead of constructing them, return results instead of mutating inputs, and keep surface area small.

## Going deeper

- **Deepening a cluster:** [DEEPENING.md](DEEPENING.md).
- **Building a new module or recurring workaround:** [Sketch First](SKETCH-FIRST.md).
- **Exploring alternative interfaces:** [DESIGN-IT-TWICE.md](DESIGN-IT-TWICE.md).
- **Hard-to-trace code or a proposed new layer:** [Minimize Reader Load](MINIMIZE-READER-LOAD.md).
- **Replacing an existing API with callers:** use [Migrate](../migrate/SKILL.md).
