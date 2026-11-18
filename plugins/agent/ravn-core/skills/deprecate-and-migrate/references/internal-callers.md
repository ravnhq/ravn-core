# Migrate Callers Then Delete Legacy APIs

Adapted from pstack `principle-migrate-callers-then-delete-legacy-apis`, MIT License, Copyright (c) 2026 Lauren Tan. See [the pstack license](../../codebase-design/references/LICENSE-pstack.txt).

Use the caller inventory from [the migration entry](../SKILL.md) to account for every caller. Confirm that only code in this repo can reach the old entry, it all ships together, and the project permits a coordinated break. Any outside or unmeasured caller sends the work back to the compatibility path.

Expand, migrate, and contract in one change. For a repeated edit, read [Build the Lever](../../ship/references/build-the-lever.md) before editing callers. Write the codemod and use it to apply the changes across the inventory. Verify a second run changes nothing and leave the script with the change. Update tests to assert the new contract; remove tests only when they guard the retired contract alone.

Before deletion, rerun the inventory without the old definition and adapter. Require zero remaining calls and passing checks on the replacement. Any newly discovered caller invalidates the inventory and reopens the choice of path.
