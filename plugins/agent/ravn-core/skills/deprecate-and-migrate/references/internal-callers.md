# Migrate Callers Then Delete Legacy APIs

Adapted from pstack `principle-migrate-callers-then-delete-legacy-apis`, MIT License, Copyright (c) 2026 Lauren Tan. See [the pstack license](../../codebase-design/references/LICENSE-pstack.txt).

Use the caller inventory from [the migration entry](../SKILL.md) to account for every caller. Confirm that only code in this repo can reach the old entry, it all ships together, and the project permits a coordinated break. Any outside or unmeasured caller sends the work back to the compatibility path.

Read [Build the Lever](../../principle-build-the-lever/SKILL.md) before editing callers: this path does its edits with a codemod, never by hand. Write the codemod into this repository's tree, outside the subtree it rewrites and never in /tmp or an outside path, and use it to apply the changes across the inventory. Verify a second run changes nothing, leave the script with the change, and name its path and the rerun in the report. Update tests to assert the new contract; remove tests only when they guard the retired contract alone.

Before deletion, rerun the inventory without the old definition and adapter. Require zero remaining calls and passing checks on the replacement. After the lever runs, search the migrated scope for the old name and clear every remaining occurrence — calls, comments, and test names alike — before reporting done. Any newly discovered caller invalidates the inventory and reopens the choice of path.
