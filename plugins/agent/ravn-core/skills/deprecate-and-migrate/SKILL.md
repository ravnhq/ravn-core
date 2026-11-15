---
name: deprecate-and-migrate
description: >-
  Remove or replace deprecated code through expand, migrate, contract: script
  an inventory of an old function, API, endpoint, or column's callers, move
  them to the replacement, and remove the old one last. Use when asked to get
  rid of a deprecated API, move callers to a replacement, rename or drop a
  column or field, or change a public API or endpoint.
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Deprecate and migrate

Adapted from Addy Osmani's `deprecation-and-migration`, MIT License, Copyright (c) 2025 Addy Osmani. See [LICENSE.txt](LICENSE.txt).

Hyrum's law: with enough callers, every observable behavior of the old API is depended on, its bugs, defaults, error shapes, and timing included. So the replacement lands beside the old API, the callers move, and the old API leaves last, once its measured usage is zero.

## Steps

1. **Inventory.** For each name a caller reaches the old API by (the symbol, a re-export or alias, and its string forms: a route path, a column in raw SQL, a mock or config key), run the bundled script, with `--word` for a symbol:

   ```bash
   node <this-skill-dir>/scripts/inventory.ts <name> [--word] [--regex] [--exclude <path>]... [--root <dir>]
   ```

   Its JSON is the inventory: `count`, `filesSearched`, and each match as `file:line`. A plain search returns the same empty result for "no callers" and for "searched nothing"; the script exits 1 for the second, so fix `--root` or `--exclude` and rerun. Sort every match: caller, definition, test, or docs. Then name the callers no search of this repo can show: other services and repos, clients of a public API or endpoint, schedulers and config outside the repo, rows already stored in the old shape, and the previous release still serving while a deploy rolls out. Done when every match is sorted and each outside caller has a way to measure its usage (logs, a metric, a counter on the old path) or is marked unmeasured.

2. **Choose the path.** A package published to a registry, a public API or endpoint, a shared database, and stored data all have callers outside the repo. When every caller is in this repo, ships in the same deploy, and nothing stored or external depends on the old shape, follow [Migrate Callers Then Delete Legacy APIs](../codebase-design/MIGRATE-CALLERS.md): expand, migrate, and contract land in one change. Otherwise each phase below ships as its own deploy.

3. **Expand.** Add the new API beside the old one. The old one keeps its behavior, as is or as a thin adapter over the new one. Mark it deprecated where its callers will see it (a `@deprecated` tag, a deprecation header or log line, a note naming the replacement), and count its use. Public consumers get a notice with the replacement, a migration guide, and a removal condition based on measured usage, with any contractual notice period as a floor. For a schema change: add the new column, table, or field as nullable or defaulted, dual-write old and new, and backfill existing rows in throttled batches. Every migration has a down path you have run.

4. **Migrate.** Move the callers one at a time, running the checks that cover each before the next, per [Sequence Verifiable Units](../ship/SEQUENCE-VERIFIABLE-UNITS.md). A caller that is itself public keeps its own signature and output. Run old and new side by side on edge inputs (large, negative, empty, missing) and report every difference in output, errors, or timing. Switch reads to a new column only after its backfill completes. Done when the inventory, rerun with the definition and adapter excluded, reports `count` 0, and every outside caller's measured usage is zero.

5. **Contract.** Contract opens when the inventory's `count` is 0 and every outside caller's usage is measured at zero. A request to remove the old API, "get rid of it" included, asks for this phase and is held to the same condition: until it holds, this change ends at migrate, with the old API still exported and marked deprecated, and the hand-back names what opens contract. Once it holds, delete the old API, its adapter, the tests that guard only its contract, and its deprecation notes. A destructive schema step (drop, rename, tightening a constraint) ships alone, in a deploy after the code that stopped using the old shape.

## What to hand back

- **Inventory:** the commands you ran, the count and files, and each outside caller with how its usage is measured.
- **Plan:** the phases, the deploy each lands in, and the measured condition that opens contract.
- **Done now:** the phase this change reached, the checks you ran, and the callers left.
