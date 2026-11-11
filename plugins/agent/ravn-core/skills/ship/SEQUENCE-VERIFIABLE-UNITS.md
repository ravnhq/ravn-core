# Sequence work into verifiable units

Adapted from pstack `principle-sequence-verifiable-units`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Order work as a sequence of small units, each ending in a state you can check, and don't advance until the current one is green.

**Why:** A break caught at the unit that caused it is cheap to localize. A break caught after a batch is buried, and you have already built further on a broken base. Sequencing those same units into a delivery a reviewer can replay turns "trust me" into "watch it go red, then green."

**Execution.** In a sweep, migration, or any run of similar edits, each unit is a before/after bracket: known-good state, one change, run the check, then proceed. Establish the baseline against the intended base; use the delivery workflow's rules for updating the branch. Scripted edits still need the per-unit check.

**Delivery.** Stack commits and PRs in the order that proves the work. The canonical shape is the failing test first, then the fix on top. Other story orders are a subtraction before the reshape, a baseline capture before the treatment, the scaffold before the feature. Each commit shows one verifiable state; the sequence proves the change.

The sequencing complement to [Prove It Works](../principle-prove-it-works/SKILL.md), which keeps each check real, and [scripted checks](../principle-prove-it-works/SKILL.md#script-the-check-when-you-can), which makes the per-unit check cheap.
