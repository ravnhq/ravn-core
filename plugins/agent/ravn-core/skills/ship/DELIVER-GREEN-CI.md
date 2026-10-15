# Deliver Green CI

Run from the target repo using its existing `gh` login. Resolve the script path from this installed skill's directory.

1. Run the gate with every check expected on a draft PR from the delivery plan:

   ```bash
   node <ship-directory>/scripts/check-ci.ts <PR-url> --expect "Check" --expect "Scan ravn-core skills"
   ```

   Use the target repo's names. Exit 0 means the observed checks passed and the PR head stayed the same during inspection; 1 means delivery is incomplete; 2 means the inspection failed. The JSON output includes the head, check links, and blockers. Repeat while jobs are queued or running, with short waits and progress updates. A missing check needs investigation of its trigger, filters, permissions, or approval requirement; an empty check list is incomplete.

2. For a failing check, read its linked logs (`gh run view <run-id> --log-failed` for Actions), reproduce it when possible, and use [Fix Root Causes](../principle-fix-root-causes/SKILL.md). Run the repaired check and relevant regression checks, commit, push, and return to the gate. Each push requires fresh CI evidence. Rerun a transient infrastructure failure only after identifying it; repeated reruns are not a fix. Preserve the repo's gates and thresholds.

3. If a fix changes the approved scope, ask the user to settle that decision. If credentials, an external outage, or required human approval prevent progress, retain the draft and report incomplete delivery with the blocker and check links. Pre-existing failures also leave delivery incomplete.

4. A conditional job may be omitted from `--expect`, or named with `--allow-skipped`, only after confirming from the workflow that it does not apply to this change. Required applicable checks must pass. The gate inspects all reported checks, including those outside the expected list. A neutral result is incomplete.

5. Once the draft checks pass, mark the PR ready with `gh pr ready <PR-url>`, then run the gate again with the full expected list, including checks triggered by readiness. If no checks run on drafts, mark ready to trigger them and begin the gate with the full list. If these fail or cannot run, return it to draft with `gh pr ready <PR-url> --undo` and continue the loop; trigger ready-only checks again after the repair. Keep the final gate output as evidence; report success only for the head it verified.
