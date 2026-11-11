# Apply simplifications

Apply kept simplify findings within the reviewed change; report nearby problems. Correctness, security, and other specialties stay report-only. The review request covers eligible local edits and checks.

## When it applies

All of these hold, or every simplify finding stays a reported `suggestion`:

- The user did not ask for a report only.
- The change is the user's own: a local branch, or a pull request whose author is the `gh` user (`gh api user --jq .login`) and whose head is checked out in the repo root with no uncommitted changes.
- The finding's file is absent from Step 1's `git status --porcelain` output, so it holds no uncommitted work of the user's. Run `git status --porcelain` once more just before you edit, and skip any file that appears in it now.

## Steps

1. **Baseline.** Take check commands from `guidance.md`; when it names none, read `package.json` scripts, the `Makefile`, and CI in one parallel batch. Reuse passing results for the same file state, or run checks covering the files you will edit. Record passes; existing failures stay out of the comparison.
2. **Apply.** Edit each file to carry out its kept simplify findings, the `replacement` when one exists. Keep the behavior identical. Leave the edits uncommitted.
3. **Re-check.** Run the same commands after edits. Every baseline pass must pass again; repeat only after a new edit or failure.
4. **Revert culprits.** When a check fails, restore every file its output points to with `git restore --source=HEAD -- <path>` (they held no uncommitted work, so this drops only your edits), mark those files' findings `"status": "reverted"`, and add the failure to each one's `body`. Rerun the checks once. If a baseline pass still fails, restore every file you edited and mark all simplify findings reverted. Mark the rest `"status": "applied"`.

Done when every kept simplify finding is `applied` or `reverted`, or stayed open because a condition above failed, and every baseline check passes. In the report, show `git diff --stat` for the applied edits.
