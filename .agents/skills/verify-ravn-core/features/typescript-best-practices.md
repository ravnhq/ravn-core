# TypeScript best practices

When an engineer asks for a TypeScript change without naming the skill, the agent loads `typescript-best-practices` on its own and the change follows its rules. A change in another language leaves the skill unloaded.

## Sub-features

- `ts.load`: a TypeScript change request loads the skill unprompted.
- `ts.apply`: the change models variants as a discriminated union, matches them exhaustively with a `never` default, and adds no `as` cast.
- `ts.stayout`: a Python change in the same repo does not load the skill.

## How to get to it (user POV)

- An engineer asks for a change to a `.ts` file in plain words, with no invocation.

## Driving it with headless harness runs

Use the README's Harness runs, with Claude Code's `--allowedTools "Bash Read Write Edit Glob Grep Skill"`.

1. Per harness and case, create `/tmp/ravn-verify/$RUN_ID/ts-<harness>-<case>/repo`, a Git repo with one commit holding:
   - `src/order.ts`: `type Order = { id: string; status: string; shippedAt?: Date; trackingNumber?: string }`, a `parseOrder(json)` that returns `JSON.parse(json) as Order`, and a `describeOrder` that branches on `status === "shipped"`.
   - `src/report.py`: `def total(orders): return sum(o["amount"] for o in orders)`.
   - `package.json`: `{ "name": "orders", "private": true, "type": "module" }`.
2. Run one turn:
   - `ts`: "In src/order.ts, add a cancelled order state that records the cancellation reason, and make describeOrder handle it. Edit the file directly; don't install anything or run a build."
   - `py`: "In src/report.py, make total() skip orders whose amount is missing. Edit the file directly; don't run anything."
3. Keep `prompt.txt`, `transcript.jsonl`, `diff.patch`, and `src/` before and after under `.verify/$RUN_ID/typescript-best-practices-<harness>-<case>/`.
4. Check:
   - `ts.load`: a `Skill` call to `typescript-best-practices` in Claude Code; a read of `typescript-best-practices/SKILL.md` in Codex and Pi.
   - `ts.apply`: `diff.patch` turns `Order` into a union on a literal `status`, `describeOrder` has a `const _exhaustive: never` default, and the diff adds no `as`. Then run `node_modules/.bin/tsc --ignoreConfig --noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext <evidence>/after-src/order.ts` from the repo root and require exit 0.
   - `ts.stayout`: no `typescript-best-practices` string in the `py` transcript.

## Gotchas

- Keeping the existing `as Order` in `parseOrder` is acceptable, since the request never touches parsing. Replacing it with a boundary parse is a bonus, not a requirement.
- Your global Git hooks run on the fixture's initial commit. Their output is not the agent's.
