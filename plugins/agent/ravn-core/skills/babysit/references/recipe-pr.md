# Recipe PR

For an `INCONCLUSIVE` verdict because no recipe reaches a behavior the diff changes. Build the missing recipes in a separate PR for a person to review, then stop; keeping them off the target PR prevents it from setting its own standard.

1. In a new worktree, branch `verify/<pr>-recipes` from `origin/<base>`. Add a recipe for each behavior the verifier listed, in the skill's own format: a feature file under `features/` and its entry in the index, with any driver beside the skill's others. Follow [Maintain Verification Skill](../../maintain-verification-skill/SKILL.md) for what a recipe holds. Add only: leave every existing recipe, its pass criteria, and the skill's launch and doctor steps unchanged.
2. Drive each new recipe on the PR's head, in a worktree at `<sha>` with the recipe branch merged in locally and never pushed, and confirm it shows the behavior. Run it on the base too, where it must show the behavior absent or failing.
3. Commit, push the recipe branch, and open a PR against the base with `gh pr create`, titled `test: add <skill> recipes for <behavior>` or in the repo's convention. The body names the PR it unblocks and each recipe's results on head and base. Leave it unapproved, unmerged, and unenqueued.
4. Report the recipe PR as the blocker, by Step 10. Once a person merges it, the base has moved, so the next "merge it" gets a fresh verdict that drives the new recipes.

A behavior you cannot write a working recipe for is a blocker, with the verifier's reason.
