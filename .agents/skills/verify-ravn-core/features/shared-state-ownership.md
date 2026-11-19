# Shared state ownership

The standalone principle checks whether workers need to write the same object. It separates independent facts before considering serialization.

## Sub-features

- `ownership.independent`: workers write independent results without taking a shared lock. An overlapping run leaves both results readable.
- `ownership.shared`: a truly canonical update names its invariant and requires enforcement across both workers, not a process-local convention.

## How to get to it (user POV)

Ask the skill whether adding a lock would fix two workers overwriting one shared JSON report. Try the same request without the explicit command to check native discovery separately.

## Driving it with a local fixture

Seed `report.mjs` with `publish(worker, result)` calling `writeFile("report.json", JSON.stringify({ [worker]: result }))`. Use the [harness setup](README.md#harness-runs) and `scripts/collect.ts` to drive the standalone principle in each harness. Run the proposed change with overlapping publishes for distinct workers; require both values and no lock. In a fresh turn, require one canonical counter whose increment must be atomic and ask what changes. Check that the agent preserves the shared invariant with an enforcing mechanism.

## Gotchas

- Atomic replacement alone prevents a torn file, not one writer losing another's update. A recommendation that merely locks the original overwrite fails the first case.
