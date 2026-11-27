# TypeScript patterns

Adapted from pstack `typescript-best-practices`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](../LICENSE.txt).

Examples for the rules in [SKILL.md](../SKILL.md), one heading per rule.

## Branded types

```ts
type AgentId = string & { readonly __brand: "AgentId" };

function isAgentId(input: string): input is AgentId {
  return isUUID(input);
}

function parseAgentId(input: string): AgentId {
  if (!isAgentId(input)) throw new Error("Invalid agent id");
  return input;
}
```

Match the `readonly __brand: "X"` shape; invent no new convention.

## Discriminated unions

```ts
// Don't: boolean + optionals admit contradictory states.
type DiffState = { loading: boolean; diff?: GitDiff; error?: string };

// Do
type DiffState =
  | { kind: "loading" }
  | { kind: "ready"; diff: GitDiff }
  | { kind: "error"; error: string };
```

Pick one discriminant name (`kind`, `type`, `tag`) and keep it.

## Constructive modeling

```ts
type NonEmpty<T> = [T, ...T[]];

// Don't: every caller must repeat the length check.
function pickWinner(entries: string[]): string {
  if (entries.length === 0) throw new Error("no entries");
  return entries[Math.floor(Math.random() * entries.length)];
}

// Do: an empty value can't exist.
function pickWinner(entries: NonEmpty<string>): string {
  return entries[Math.floor(Math.random() * entries.length)];
}

// Where a plain T[] arrives, narrow once; the fact then travels in the type.
const isNonEmpty = <T>(arr: T[]): arr is NonEmpty<T> => arr.length > 0;

// Even length.
type Pairs<T> = [T, T][];

// Don't: a comment holds the invariant.
type TimeRange = { start: Date; end: Date }; // start <= end
// Do: a negative range can't be written; derive end when needed.
type TimeRange = { start: Date; durationMs: number };
```

Brand `durationMs` only if a raw number could be passed where a duration is expected. Expose the reading you need on top (`pairs.flat()`, a `rangeEnd()` helper).

## Simplest total type

```ts
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0); // [] is 0: keep T[]

// Don't: partiality smuggled past the compiler.
const newest = (sessions: Session[]): Session => sessions.at(0)!;

// Do: strengthen the input and the assertion disappears.
const newest = (sessions: NonEmpty<Session>): Session => sessions[0];
```

Weakening the result to `Session | undefined` is the other total signature.

## `unknown` over `any`

External data (RPC payloads, `JSON.parse`, `postMessage`, IPC, file contents, environment variables, database results) is `unknown`; narrow before use.

```ts
function handle(input: unknown) {
  if (typeof input === "object" && input !== null && "foo" in input) {
    // narrowed
  }
}
```

## Schemas before guards

One schema owns validation and the type; no duplicate interface or guard to drift. Use `safeParse` when failure is an expected branch, and the equivalent inference helper for another schema library.

```ts
const UserSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["admin", "member"]),
});
type User = z.infer<typeof UserSchema>;

const parseUser = (input: unknown): User => UserSchema.parse(input);
```

## No `as` casts

```ts
// Don't
const user = data as User;

// Don't: a property-by-property guard that proves less than the type.
function isUser(data: unknown): data is User {
  return typeof data === "object" && data !== null && "id" in data;
}

// Do: see Schemas before guards.
```

When the type comes first, annotate the schema with it; the compiler then rejects a schema that proves less. Removing `name` below fails to compile.

```ts
type User = { id: string; name: string };
const userSchema: z.ZodType<User> = z.object({ id: z.string(), name: z.string() });
```

Refactoring an `as` out: find why TypeScript can't infer.

- Missing discriminant: add one, use a discriminated union.
- Overly wide source type (`Record<string, unknown>`): narrow it.
- Untyped boundary: parse with the schema that owns the shape; add one only where none exists.
- Genuinely inexpressible: use a branded type or `satisfies`.

## Narrowing hierarchy

```ts
function area(s: Shape): number {
  if ("radius" in s) return Math.PI * s.radius ** 2; // narrowed to circle
  return s.width * s.height; // narrowed to rect
}
```

## Exhaustiveness

```ts
// Value-returning switch
function area(s: Shape): number {
  switch (s.kind) {
    case "circle":
      return Math.PI * s.radius ** 2;
    case "rect":
      return s.width * s.height;
    default: {
      const _exhaustive: never = s;
      return _exhaustive;
    }
  }
}

// Void switch
function handle(s: Shape): void {
  switch (s.kind) {
    case "circle":
      drawCircle(s);
      break;
    case "rect":
      drawRect(s);
      break;
    default: {
      const _exhaustive: never = s;
      void _exhaustive;
    }
  }
}
```

## `satisfies` over `as`

```ts
const config = { theme: "dark", cols: 3 } satisfies Config;
// config.theme is "dark", not string; `as Config` would widen it
```

## Boundary validation

- **Wire formats** (proto, JSON-RPC): parse with `ignoreUnknownFields` so forward-compatible changes don't break old clients.
- **Persisted JSON:** a versioned blob, with try/catch around the parse.
- Re-validate nowhere deeper in the call chain.

## Schema-derived types

```ts
// Don't: duplicate shape drifts when the schema changes.
type CheckSummary = { totalCount: number; checks: { name: string; status: string }[] };

// Do
import type { ChecksMessage } from "<generated module>";
type CheckSummary = Pick<ChecksMessage, "totalCount" | "checks">;
```

## Object args

```ts
// Don't: swapped args still compile.
openFile(uri, { startLineNumber: 10, startColumn: 1, endLineNumber: 10, endColumn: 1 });

// Do
openFile({ uri, selection: { startLineNumber: 10, startColumn: 1, endLineNumber: 10, endColumn: 1 } });
```
