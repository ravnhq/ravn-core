# Verification skill lifecycle

One explicit command creates a project guide for driving a real surface or maintains a guide that already exists. It leaves the product unchanged.

## Sub-features

- `verification.create`: the create reference is read, the guide and its feature map are filled in from the source, and one journey runs from fresh state through evidence capture and cleanup.
- `verification.maintain`: the maintain reference is read, a stale command is corrected using source and a live run, and every mapped journey is driven. The CLI source is unchanged.

## How to get to it (user POV)

Invoke `verification-skill create` to bootstrap `verify-notes` for a local notes CLI. After its instructions drift, invoke `verification-skill maintain` and name the guide.

## Driving it with a local CLI

Use the [harness setup](README.md#harness-runs) and `scripts/scratch.ts authoring <dir>` for each harness. Ask for a guide for `notes.mjs` covering add, list, and search, with a temporary `NOTES_DB` and evidence that survives cleanup. Follow the resulting commands yourself, including launch/setup and teardown; keep evidence and a diff of the guide. Change one command in a copied guide to use a nonexistent subcommand and run maintenance. Require the fix, all three journeys, and an empty product diff. Capture both turns through `scripts/collect.ts`.

## Gotchas

- Registration or a generated feature map alone does not prove a runnable journey. A run on the real CLI must create and read actual notes.
- A missing guide during maintenance calls for user direction; it does not authorize creation.
