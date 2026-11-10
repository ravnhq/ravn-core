---
name: typescript-best-practices
description: >-
  TypeScript type-safety rules: discriminated unions, branded types, no `as`,
  exhaustive switches, schema-derived types. Use when writing, editing, or
  reviewing TypeScript.
license: See LICENSE.txt
metadata:
  proof: subjective
---

# TypeScript Best Practices

Adapted from pstack `typescript-best-practices`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Apply [Type System Discipline](../principle-type-system-discipline/SKILL.md) first. Apply every rule below; [references/patterns.md](references/patterns.md) holds the examples, under a heading per rule. Read it for a rule you cannot apply from its row alone.

| Rule | Summary |
|------|---------|
| Discriminated unions | Model variants with a `kind` literal discriminant so impossible states can't be represented. No optional-field bags. |
| Branded types | Brand primitives with `& { readonly __brand: "X" }`. Validate once at the boundary. A brand comes from a verifying type guard (`input is AgentId`), never from `as`. |
| Constructive modeling | Build the shape so the illegal value can't be constructed: `[T, ...T[]]` for non-empty, `[T, T][]` for even length, `start` plus `duration` for a range. No runtime guard, no wish for refinement types. |
| Simplest total type | Keep `T[]` while every operation on it stays total. Strengthen to `NonEmpty<T>` only where the loose type forces `!`, a cast, or a "should never happen" throw. |
| `unknown` over `any` | External data is `unknown`. |
| Schemas before guards | Before hand-writing a property-by-property type guard, use the repository's runtime schema library and infer the type from it (`z.infer`). Add no schema dependency for one guard. |
| No `as` casts | Every `as` is a runtime crash waiting. Cast only after validation. |
| Narrowing hierarchy | Discriminant switch > `in` operator > `typeof`/`instanceof` > user-defined type guard > `as`. |
| Type guards | Verify the claim: a lying guard is worse than `as`, since its name says it's safe. Name them `isX` or `hasX`. |
| Exhaustiveness | Assign the discriminant to `const _exhaustive: never = x;` in default arms so a new variant fails to compile. |
| `satisfies` over `as` | Validates the value without widening literal types. |
| Boundary validation | Parse where data crosses in, into a named domain type; `Record<string, unknown>` (however spelled) stops at that parse. Trust types inside. See [Boundary Discipline](../principle-boundary-discipline/SKILL.md). |
| Schema-derived types | Reach for `Pick`/`Omit`/`Parameters`/`ReturnType`/`Awaited`/`typeof`, or generated types from a `.proto`, OpenAPI, GraphQL, or migration, before declaring a new interface. |
| Object args | Pass objects, not positional args, so order is self-documenting. Skip on hot paths (per-frame render, tokenizers, parsers). |
| Real tests | Mock only what you can't run locally. Prefer the framework's real test primitives with leak/disposable checks, and verify UI in a running build. |
| Structured telemetry | Use structured logger diagnostics with enough context to debug from an id; `console.log` stays out of shipped code. |
