---
name: codebase-design
description: >-
  Decide whether code should stay split or get one interface, where a new
  seam should go, or where to parse raw inputs. Use when designing a module's
  types or test surface. For how existing code works today, use how.
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Codebase Design

Design **deep modules**: much behaviour behind a small interface, placed at a clean seam, testable through that interface. Use these terms exactly, never "component," "service," "API," or "boundary": the aim is leverage for callers, locality for maintainers, testability for everyone.

Start with the design decision the user wants. For raw inputs or adapters, read [Boundary Discipline](references/boundary-discipline.md) before choosing where validation belongs. For types or signatures, read [Type System Discipline](references/type-system-discipline.md) before proposing the representation.

## Glossary

**Module**: anything with an interface and an implementation, at any scale: function, class, package, tier-spanning slice. _Avoid_: unit, component, service, layer, wrapper.

**Interface**: everything a caller must know to use the module correctly: type signature, invariants, ordering constraints, error modes, required configuration, performance characteristics. Not the TypeScript `interface` keyword or a class's public methods. _Avoid_: API, signature.

**Implementation**: a module's body of code. A small adapter can have a large implementation (a Postgres repo); a large adapter a small one (an in-memory fake). Say "adapter" when the seam is the topic, "implementation" otherwise.

**Depth**: leverage at the interface, the behaviour a caller or test can exercise per unit of interface learned. **Deep**: much behaviour behind a small interface. **Shallow**: interface nearly as complex as the implementation, a pass-through. Not Ousterhout's implementation-lines to interface-lines ratio, which rewards padding.

**Seam** _(Michael Feathers)_: the place where you can alter behaviour without editing in that place; where a module's interface lives. Where it goes is a design decision separate from what sits behind it. _Avoid_: boundary (overloaded with DDD's bounded context).

**Adapter**: a concrete thing that satisfies an interface at a seam. Names the role it fills, not what is inside.

**Leverage**: what callers get from depth. One implementation pays back across N call sites and M tests.

**Locality**: what maintainers get from depth. Change, bugs, knowledge, and verification concentrate in one place. Fix once, fixed everywhere.

## Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be built from small, mockable, swappable parts that stay outside its interface. It has an external seam at its interface and may have internal seams, private to its implementation and its own tests.
- **The deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it earned its keep.
- **The interface is the test surface.** Callers and tests cross the same seam. A test that must reach past the interface says the module has the wrong shape.
- **One adapter means a hypothetical seam. Two adapters means a real one.** Introduce a seam only where something actually varies across it.
- **Shrink the interface.** Fewer methods, simpler parameters, more complexity hidden inside.

## Designing for testability

- **Accept dependencies, don't create them:** `processOrder(order, paymentGateway)`, not a body that calls `new StripeGateway()`.
- **Return results, don't produce side effects:** `calculateDiscount(cart): Discount`, not `applyDiscount(cart): void` mutating `cart.total`.
- **Small surface area.** Fewer methods mean fewer tests; fewer params mean simpler setup.

## Going deeper

- **Deepening a cluster given its dependencies**: [DEEPENING.md](DEEPENING.md), dependency categories, seam discipline, and replace-don't-layer testing.
- **Building a new module, or a design that keeps needing the same workaround**: [Sketch First](SKETCH-FIRST.md), stub the types and signatures before code, implement against the sketch, and scrap it when the workaround recurs.
- **Exploring alternative interfaces**: [DESIGN-IT-TWICE.md](DESIGN-IT-TWICE.md), parallel sub-agents each design the interface a radically different way; compare on depth, locality, and seam placement.
- **Code that is hard to trace, or a proposed new layer or mutable state**: [Minimize Reader Load](MINIMIZE-READER-LOAD.md).
- **Replacing an internal API**: use the [caller inventory and migration workflow](../deprecate-and-migrate/SKILL.md) before deciding whether the old entry can leave in the same change.
