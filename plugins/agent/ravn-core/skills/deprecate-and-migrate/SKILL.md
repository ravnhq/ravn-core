---
name: deprecate-and-migrate
description: >-
  Remove or rename a legacy route, alias, function, export, or field. Use
  when callers must move or an old name should go away. Keep public names
  working until outside use is measured at zero.
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Deprecate and migrate

Adapted from Addy Osmani's `deprecation-and-migration`, MIT License, Copyright (c) 2025 Addy Osmani. See [LICENSE.txt](LICENSE.txt).

Hyrum's law: with enough callers, every observable behavior of the old API is depended on, its bugs, defaults, error shapes, and timing included. So the replacement lands beside the old API, the callers move, and the old API leaves last, once its measured usage is zero.

**Choose the outcome before editing.** An externally reachable name stays until a fresh inventory finds zero local callers and measured traffic shows zero outside use. A request to delete the name does not count as that evidence.

- **Only removal was requested and the gate is closed:** leave the old entry working, including each alias in its route map. Report where to migrate callers, what to measure, and what opens removal. This completes the request as far as the evidence allows; make no removal edits.
- **Callers can move now:** migrate them while preserving the old entry, or use the internal path below if every caller shares a deploy and a coordinated break is allowed.

## Steps

1. **Inventory.** For each name a caller reaches the old API by (the symbol, a re-export or alias, and its string forms: a route path, a column in raw SQL, a mock or config key), run the bundled script, with `--word` for a symbol:

   ```bash
   node <this-skill-dir>/scripts/inventory.ts <name> [--word] [--regex] [--exclude <path>]... [--root <dir>]
   ```

   Its JSON is the inventory: `count`, `filesSearched`, and each match as `file:line`. A plain search returns the same empty result for "no callers" and for "searched nothing"; the script exits 1 for the second, so fix `--root` or `--exclude` and rerun. Sort every match: caller, definition, test, or docs. Then name the callers no search of this repo can show: other services and repos, clients of a public API or endpoint, schedulers and config outside the repo, rows already stored in the old shape, and the previous release still serving while a deploy rolls out. Done when every match is sorted and each outside caller has a way to measure its usage (logs, a metric, a counter on the old path) or is marked unmeasured.

2. **Choose the path.** Treat HTTP routes and their aliases, queue topics, webhooks, published exports, CLI flags, config or environment keys, shared databases, and stored data as externally reachable even if the inventory found no local caller. If every caller is in the same deploy and a coordinated break is allowed, read [the internal-caller path](references/internal-callers.md) and follow it. For outside or older-deploy callers, follow the steps below in separate deploys.

3. **Expand.** Add the new API beside the old one. The old one keeps its behavior, as is or as a thin adapter over the new one. Mark it deprecated where its callers will see it (a `@deprecated` tag, a deprecation header or log line, a note naming the replacement), and count its use. Public consumers get a notice with the replacement, a migration guide, and a removal condition based on measured usage, with any contractual notice period as a floor. For a schema change: add the new column, table, or field as nullable or defaulted, dual-write old and new, and backfill existing rows in throttled batches. Every migration has a down path you have run.

4. **Migrate.** Move the callers one at a time, running the checks that cover each before the next, per [Sequence Verifiable Units](../ship/SEQUENCE-VERIFIABLE-UNITS.md). A caller that is itself public keeps its own signature and output. Exercise the old and new entry points on relevant edge inputs and report differences in output, errors, or timing. Switch reads to a new column only after its backfill completes. Before reporting the local migration done, rerun the local inventory and prove the legacy entry still works. Outside usage can remain unmeasured at this point; that keeps the deletion gate closed.

5. **Contract.** Before deleting anything, record the path from Step 2, a fresh local inventory count of zero, and measured zero usage for each outside caller. Any new caller, deploy change, or unmeasured caller invalidates that proof. Until the gate opens, leave the old API working and deprecated and report the missing evidence. Once it opens, delete the old API, its adapter, the tests that guard only its contract, and its deprecation notes. Ship a destructive schema step (drop, rename, tightening a constraint) alone, in a deploy after the code that stopped using the old shape.

## What to hand back

- **Inventory:** the commands you ran, the count and files, and each outside caller with how its usage is measured.
- **Plan:** the phases, the deploy each lands in, where each outside caller is configured and the change that moves it to the replacement, and the measured condition that opens contract.
- **Done now:** the phase this change reached, the checks you ran, and the callers left.
