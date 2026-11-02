# Apply simplifications

Apply the simplify findings you kept, then prove the repo's checks still pass. Correctness, security, and every other specialty's findings stay report-only.

## When it applies

All of these hold, or every simplify finding stays a reported `suggestion`:

- The user did not ask for a report only.
- The change is the user's own: a local branch, or a pull request whose author is the `gh` user (`gh api user --jq .login`) and whose head is checked out in the repo root with no uncommitted changes.
- The finding's file has no uncommitted changes from the user. `git status --porcelain -- <path>` printed nothing for it in Step 1. Re-check before you edit; a file that changed since then is skipped.

## Steps

1. **Baseline.** Find the repo's own check commands (its `AGENTS.md`, `CONTRIBUTING.md`, `package.json` scripts, `Makefile`, or CI workflow) and run the ones that cover the files you will edit. Record which pass. A check that already fails stays out of the comparison.
2. **Apply.** Edit each file to carry out its kept simplify findings, the `replacement` when one exists. Keep the behavior identical. Leave the edits uncommitted.
3. **Re-check.** Run the same commands. Every check that passed in the baseline must pass again.
4. **Revert culprits.** When a check fails, restore the files its output points to with `git restore --source=HEAD -- <path>` (they held no uncommitted work, so this drops only your edits), mark those files' findings `"status": "reverted"`, and add the failure to each one's `body`. Rerun the checks until every baseline pass passes again. Mark the rest `"status": "applied"`.

Done when every kept simplify finding is `applied` or `reverted`, or stayed open because a condition above failed, and every baseline check passes. In the report, show `git diff --stat` for the applied edits.
