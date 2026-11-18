---
name: principle-attack-the-premise
description: >-
  Apply when two or more fixes that share one premise have failed the same
  gate. Write the premise down and test it directly before you write another
  fix that assumes it.
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Attack the Premise

Adapted from pstack `principle-attack-the-premise`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

When two or more fixes that share one premise have failed the same gate, suspect the premise, not the fixes. Each failed fix is evidence against the belief it assumed, and a third fix on that belief spends effort where the evidence already says the cause is not.

- **Write the premise down.** It is the one sentence every failed fix assumed.
- **Test the premise before the next fix.** Find an observation that would come out differently if the premise were false, and make it. Look at how the failures are distributed, not only at how large they are. Make the check rerunnable with [Build the Lever](../ship/references/build-the-lever.md).
- **Follow the evidence.** If it contradicts the premise, revert the fixes the premise motivated, then look for what the failures have in common that the premise did not predict. If it confirms the premise, ask the next "why" with [Fix Root Causes](../principle-fix-root-causes/SKILL.md): the earlier fixes may have treated a consequence instead of the cause.
- **Remove the condition instead of compensating for it.** If the evidence shows that one part always lands on the losing side, change what puts it there. A mechanism that cleans up after it leaves the cause in place and adds work on every run.

You skipped this when you started a third fix before the premise was written down and tested, or when a fix whose premise the evidence refuted is still in the diff.

Distinct from [Fix Root Causes](../principle-fix-root-causes/SKILL.md), which traces one symptom back to its first wrong step. This questions a belief that several failed fixes shared.
