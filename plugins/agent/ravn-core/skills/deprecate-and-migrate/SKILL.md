---
name: deprecate-and-migrate
description: >-
  Remove, replace, or rename a route, path, endpoint, alias, function,
  method, property, export, or field, and move every caller to the
  replacement ("get rid of the old ones", "drop the old name", "rename X to
  Y", "switch everything to X", "update everything that calls it").
  Coordinated one-change breaks for callers that ship together; externally
  reachable names stay working until outside use is measured at zero.
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Deprecate and migrate

Adapted from Addy Osmani's `deprecation-and-migration`, MIT License, Copyright (c) 2025 Addy Osmani. See [LICENSE.txt](LICENSE.txt).

Every observable behavior of an old API has callers (Hyrum's law). Land the replacement beside it, move callers, and remove the old API last — only after measured usage is zero.

**Gate before editing:** an externally reachable name stays working until a fresh local inventory is zero **and** measured traffic shows zero outside use. A request to delete it is not that evidence.

- **Removal requested while the gate is closed:** make no removal edits (not even partial "cleanup"). Keep every old mapping working and report the three-step rollout: move outside callers to the replacement, measure zero use, then remove in a later change.
- **Callers can move now:** migrate them while keeping the old entry working, or use the internal path below if every caller shares one deploy and a coordinated break is allowed.

## Steps

### 1. Inventory

For every name callers use (symbol, re-export, alias, route path, SQL column, mock or config key), run the bundled script (`--word` for a symbol):

```bash
node <this-skill-dir>/scripts/inventory.ts <name> [--word] [--regex] [--exclude <path>]... [--root <dir>]
```

- Exit 1 means nothing was searched — fix `--root` or `--exclude` and rerun.
- Classify every match: caller, definition, test, or docs.
- List outside callers no repo search can see: other services/repos, public API clients, external schedulers/config, stored rows in the old shape, and the prior release serving during rollout.

Done when every match is classified and each outside caller has a measurement method (logs, metric, counter) or is marked unmeasured.

### 2. Choose the path

Treat HTTP routes/aliases, queue topics, webhooks, published exports, CLI flags, config/env keys, shared DBs, and stored data as externally reachable even with zero local callers.

- **All callers share one deploy and a coordinated break is allowed:** read [the internal-caller path](references/internal-callers.md) and [Build the Lever](../principle-build-the-lever/SKILL.md) (for repeated edits) and follow them.
- **Outside or older-deploy callers exist:** follow Steps 3–5 across separate deploys.

### 3. Expand

- Add the new API beside the old one; keep the old behavior intact (directly or as a thin adapter).
- Mark the old API deprecated where callers see it (`@deprecated`, header, log line) and count its use. Give public consumers the replacement, migration guide, and measured removal condition (respecting any contractual notice floor).
- For schemas: add nullable/defaulted columns or tables, dual-write old and new, and backfill in throttled batches. Every migration needs a tested down path.

### 4. Migrate

- Move callers one at a time, verifying each before the next ([Sequence Verifiable Units](../ship/SEQUENCE-VERIFIABLE-UNITS.md)). Keep public callers' own signatures and outputs unchanged.
- Compare old and new entry points on edge inputs and report any differences in output, errors, or timing.
- Switch reads to a new column only after backfill completes.
- Before finishing local migration, rerun the inventory and prove the legacy entry still works. (Unmeasured outside usage keeps the deletion gate closed.)

### 5. Contract

Before deleting anything, verify: the Step 2 path, a fresh local inventory of zero, and measured zero usage for every outside caller. Any new caller, deploy change, or unmeasured caller invalidates the proof; keep the old API working and report what is missing.

Once the gate opens, delete the old API, its adapter, tests guarding only its contract, and deprecation notes. Ship destructive schema changes (drop, rename, tightened constraints) alone in a deploy after code stops using the old shape.

## What to hand back

- **Inventory:** commands run, match counts/files, and each outside caller with how usage is measured.
- **Plan:** phases, deploy per phase, where outside callers are configured and how to migrate them, and the condition opening contract.
- **Done now:** phase reached, checks run, and remaining callers.
- **Lever** (internal path): codemod path in the tree, command run, files changed, and idempotent rerun result.
