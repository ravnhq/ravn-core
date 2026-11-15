# Sketch First

Adapted from pstack `architect`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Use when building a new module or a non-trivial change where coding first would lock in the wrong shape. Uses the [SKILL.md](SKILL.md) vocabulary.

## 1. Sketch

1. Write the caller's usage first: two or three realistic call sites, showing what they import, what they call, and what comes back. Derive the types from that usage; when the two disagree, change the sketch to fit the usage.
2. Sketch the types, function signatures, and module layout as stubs: bodies that throw `not implemented`, with pseudocode comments for the logic. Use one file for a small change, and a module map plus type definitions for larger work. For whole-shape alternatives, follow [Design It Twice](DESIGN-IT-TWICE.md).
3. Screen the sketch against the [red flags](#red-flags). Assume the next contributor is an agent that sees only the files it opened, copies the nearest example, and takes the shortest path that compiles. Prefer the shape where a change that looks right from one file is right for the whole repo.

The sketch is done when every module and signature exists as a stub that type-checks or imports cleanly, and every red flag is revised away.

## 2. Implement against the sketch

Replace stub bodies with code and pseudocode with logic. The sketch is the contract, and each deviation from it is a finding to report. When a function needs a parameter the sketch did not anticipate, decide whether the sketch was wrong, a requirement was missed, or the implementation is overreaching, and say which.

## 3. Scrap when the sketch is wrong

Scrap the sketch when implementation keeps producing friction it cannot absorb. The signal is a pattern across the implementation, not one instance:

- The same shape of workaround recurs across unrelated code.
- Unrelated edge cases each need their own special-case branch.
- Types compile only through escape hatches: `any`, casts, optional fields that are always set in practice.
- A lock seems necessary where the sketch said the state was not shared; see [Separate Before Serializing Shared State](../principle-separate-before-serializing-shared-state/SKILL.md).
- Callers must know the module's internal rules to use it.
- Two or more independent deviations in step 2 have the same shape.

A few edge cases leave a sketch standing, and complexity in the data is not complexity in the design.

When you scrap, name the signal you saw, then:

1. Trace what has been built.
2. Re-sketch as if the new constraints had been day-one assumptions, fixing the shape that produced the workaround, per [Fix Root Causes](../principle-fix-root-causes/SKILL.md).
3. Subtract first: the new sketch is smaller than the old one before it grows.
4. Return to step 1.

## Red flags

A red flag is a reason to revise or reject the shape. Shallow modules and the deletion test are in [SKILL.md](SKILL.md), pass-through layers in [Minimize Reader Load](MINIMIZE-READER-LOAD.md), temporal decomposition in [Model the Domain](../domain-modeling/MODEL-THE-DOMAIN.md), and wire types crossing a seam in [Boundary Discipline](../principle-boundary-discipline/SKILL.md). Also screen for:

- **Information leakage**: one internal decision (a representation, policy, or protocol detail) appears in more than one module, so changing it takes coordinated edits. Move the decision behind one module's interface.
- **Split ownership**: more than one module writes the same state or keeps its own copy. An agent that edits one writer cannot see the others, so their rules diverge. Give each piece of state one owner; other modules read it or ask the owner to change it.
- **Two ways to do one task**: an agent copies whichever way it finds first, so every way keeps gaining callers. Keep one way, and move callers off the others and delete them in the same change, per [Migrate Callers Then Delete Legacy APIs](MIGRATE-CALLERS.md).
- **Importable internals**: an agent imports a module's internals because that is the shortest path that compiles, and they become part of the interface. Make internals unreachable from outside the module, so such an import fails the build.
- **Hand-synced list**: two or more places list the same items, and an agent that sees one list updates only that one. Keep one list and derive the others from it; when a list cannot be derived, make the build fail when the lists disagree.
