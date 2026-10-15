---
name: principle-type-system-discipline
description: >-
  Apply when designing types, reviewing a function signature, or writing code
  in any statically-typed language. Make illegal states unrepresentable, brand
  semantic primitives, parse external data at boundaries, refuse to lie to the
  compiler, exhaust variants, derive from authoritative schemas.
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Type System Discipline

Adapted from pstack `principle-type-system-discipline`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

The type checker is a proof assistant. Use it to eliminate impossible states, mismatched primitives, and unhandled variants at compile time. A case the types let you ignore becomes a runtime failure the compiler could have stopped. Prefer defining errors and special cases out of existence over proliferating handlers. Unrepresentable states, total functions, and interface redesign (the patterns below) are the tools.

Applies to any typed language.

Apply every relevant pattern and check in [PATTERNS.md](PATTERNS.md).
