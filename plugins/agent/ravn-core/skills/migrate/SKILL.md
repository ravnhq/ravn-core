---
name: migrate
description: >-
  Invoke when removing, replacing, or renaming a route, path, endpoint, alias,
  function, method, property, export, or field and moving callers ("get rid of
  the old ones", "drop the old name", "rename X to Y", "switch everything to
  X"), OR when making repetitive/bulk edits that warrant a codemod or script
  lever.
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Migrate

Adapted from Addy Osmani's `deprecation-and-migration` (MIT License, Copyright (c) 2025 Addy Osmani) and pstack `principle-build-the-lever` (MIT License, Copyright (c) 2026 Lauren Tan). See [LICENSE.txt](LICENSE.txt).

Hyrum's law: with enough callers, every observable behavior of the old API is depended on, its bugs, defaults, error shapes, and timing included. So the replacement lands beside the old API, the callers move, and the old API leaves last, once its measured usage is zero.

**Build the lever for repeated or non-trivial edits:** if the same edit touches three or more call sites, or a reviewer needs a rerunnable proof, read and follow [Build the Lever](references/build-the-lever.md) instead of editing by hand.

**Choose the outcome before editing.** An externally reachable name stays until a fresh inventory finds zero local callers and measured traffic shows zero outside use. A request to delete the name does not count as that evidence.

- **Only removal was requested and the gate is closed:** make no removal edits, not even a subset framed as cleanup. Leave every old mapping working and report the three-step rollout: move outside callers to the named replacement, measure zero use of each old name, then remove it in a later change.
- **Callers can move now:** migrate them while preserving the old entry, or use the internal path below if every caller shares a deploy and a coordinated break is allowed.

## Steps

1. **Inventory.** For each name a caller reaches the old API by (the symbol, re-export, alias, route path, SQL column, mock, or config key), run the bundled script, with `--word` for a symbol:

   ```bash
   node <this-skill-dir>/scripts/inventory.ts <name> [--word] [--regex] [--exclude <path>]... [--root <dir>]
   ```

   Sort every match (caller, definition, test, docs) and name outside callers no repo search can show (other services, public API clients, schedulers, stored rows, previous release during rollout), with how each is measured or marked unmeasured.

2. **Choose the path.** Treat HTTP routes, queue topics, webhooks, published exports, CLI flags, config/env keys, shared databases, and stored data as externally reachable even if local inventory is zero. If every caller is in the same deploy and a coordinated break is allowed, read [the internal-caller path](references/internal-callers.md) and [Build the Lever](references/build-the-lever.md). For outside or older-deploy callers, run Expand → Migrate → Contract in separate deploys.

3. **Expand.** Add the new API beside the old one. Keep the old behavior (as is or via a thin adapter), mark it deprecated, and count its use. For schema changes: add nullable/defaulted column, dual-write, backfill in throttled batches, and verify a down path.

4. **Migrate.** Move callers one unit at a time per [Sequence Verifiable Units](../ship/SEQUENCE-VERIFIABLE-UNITS.md), verifying each before the next. Exercise old and new entry points on edge inputs and report any differences. Rerun the local inventory and confirm the legacy entry still works.

5. **Contract.** Delete the old API only with a fresh local inventory of zero and measured zero outside usage. Ship destructive schema steps alone in a deploy after code stops using the old shape.

## What to hand back

- **Inventory:** commands run, count and files, and outside callers with how usage is measured.
- **Plan:** phases, deploy boundaries, and the measured condition that opens contract.
- **Done now:** phase reached, checks run, and remaining callers.
- **Lever:** when used, the codemod/script path in the tree, command run, files changed, and idempotent rerun result.
