---
name: principle-type-system-discipline
description: >-
  Apply when designing types, reviewing a function signature, or writing code
  in any statically-typed language. Make illegal states unrepresentable, brand
  semantic primitives, exhaust variants, derive from authoritative schemas.
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Type System Discipline

Adapted from pstack `principle-type-system-discipline`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Make the compiler reject impossible states, mismatched primitives, and unhandled variants. Prefer defining errors and special cases out of existence over proliferating handlers. For TypeScript, also apply [TypeScript Best Practices](../typescript-best-practices/SKILL.md).

- **Brand semantic primitives.** `UserId` and `OrderId` are strings underneath but not interchangeable. Give each its own type, such as a branded intersection in TypeScript or a newtype elsewhere. Validate once at creation, trust the type downstream. Brand any two arguments that share a primitive type but mean different things.
- **External data is untyped until parsed.** RPC payloads, JSON, IPC messages, CLI args, config files, environment variables, database rows each get a parse function that turns unstructured input into the typed model; [Boundary Discipline](../principle-boundary-discipline/SKILL.md) says where.
- **Derive types from authoritative schemas.** When a protocol buffer, OpenAPI spec, GraphQL schema, database migration, design-token file, or another file owns a shape, derive from it instead of hand-rolling a parallel type.
