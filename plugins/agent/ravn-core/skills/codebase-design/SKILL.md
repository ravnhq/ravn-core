---
name: codebase-design
description: Design deep modules. Use when designing or reshaping an interface, placing a testable seam, or when another skill needs the deep-module vocabulary.
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Codebase Design

Design **deep modules**: much behaviour behind a small interface, placed at a clean seam, testable through that interface. Use the glossary for architectural concepts; preserve domain terms, code identifiers, and quotations. The aim is leverage for callers, locality for maintainers, testability for everyone.

## Glossary

**Module**: anything with an interface and an implementation, at any scale: function, class, package, tier-spanning slice. _Avoid_: unit, component, service, layer, wrapper.

**Interface**: everything a caller must know to use the module correctly: type signature, invariants, ordering constraints, error modes, required configuration, performance characteristics. Not the TypeScript `interface` keyword or a class's public methods. _Avoid_: API, signature.

**Implementation**: a module's body of code. A small adapter can have a large implementation (a Postgres repo); a large adapter a small one (an in-memory fake). Say "adapter" when the seam is the topic, "implementation" otherwise.

**Depth**: leverage at the interface, the behaviour a caller or test can exercise per unit of interface learned. **Deep**: much behaviour behind a small interface. **Shallow**: interface nearly as complex as the implementation, a pass-through. Not Ousterhout's implementation-lines to interface-lines ratio, which rewards padding.

**Seam** _(Michael Feathers)_: the place where you can alter behaviour without editing in that place; where a module's interface lives. Where it goes is a design decision separate from what sits behind it. _Avoid_: boundary (overloaded with DDD's bounded context).

**Adapter**: a concrete thing that satisfies an interface at a seam. Names the role it fills, not what is inside.

**Leverage**: what callers get from depth. One implementation pays back across N call sites and M tests.

**Locality**: what maintainers get from depth. Change, bugs, knowledge, and verification concentrate in one place. Fix once, fixed everywhere.

## Ground the recommendation

Trace an actual caller before proposing a seam. State what it supplies, what it receives, and which module owns the hidden rules. For parallel implementations (for example, in-memory and query execution), distinguish shared data from behavior that must remain separate; name the existing parity check and what it compares. Anchor the recommendation to source paths, not just an illustrative interface.

## Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be built from small, mockable, swappable parts that stay outside its interface. It has an external seam at its interface and may have internal seams, private to its implementation and its own tests.
- **The deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it earned its keep.
- **The interface is the test surface.** Caller-facing tests cross the callers' seam; needing internal knowledge to verify their contract signals the wrong module shape.
- **One adapter means a hypothetical seam. Two adapters means a real one.** Introduce a seam only where something actually varies across it.
- **Shrink the interface.** Fewer methods, simpler parameters, more complexity hidden inside.

## Designing for testability

- **Accept dependencies, don't create them:** `processOrder(order, paymentGateway)`, not a body that calls `new StripeGateway()`.
- **Return results, don't produce side effects:** `calculateDiscount(cart): Discount`, not `applyDiscount(cart): void` mutating `cart.total`.
- **Small surface area.** Fewer methods mean fewer tests; fewer params mean simpler setup.

## Going deeper

- **Deepening a cluster given its dependencies**: [DEEPENING.md](DEEPENING.md), dependency categories, seam discipline, and replace-don't-layer testing.
- **Exploring alternative interfaces**: [DESIGN-IT-TWICE.md](DESIGN-IT-TWICE.md), contrasting designs compared on depth, locality, and seam placement.
- **Code that is hard to trace, or a proposed new layer or mutable state**: [Minimize Reader Load](MINIMIZE-READER-LOAD.md).
- **Replacing an internal API** when old callers remain, no external users need compatibility, and coordinated breaking changes are permitted: [Migrate Callers Then Delete Legacy APIs](MIGRATE-CALLERS.md).
