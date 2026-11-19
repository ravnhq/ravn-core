# Maintain a formal verification skill

A formal check can keep passing after the code it describes changes. Use this pass for changes that skipped the project-local verification: merges, edits made without the guide, or drift across several commits.

## Outcomes

Give each check one outcome, and say which:

- **in sync**: no change since the last sync alters what the check describes, and the check passes.
- **updated**: the code changed, the verification now describes the new code, and the check passes.
- **bug**: the verification describes the current code, and the code breaks the property. This is a finding about the code, separate from drift.
- **blocked**: the check could not be brought back in line or could not run. Say exactly why.

A check can be both updated and bug: the update makes the verification describe the code again, and then the property fails on it.

## Edit scope

Edit only the verification: models, harnesses, property files, and the verify skill itself. Product code stays as it is during a run, unless the user asks you to change it. When a property fails on the current code, keep the property and the model as strict as the promise, and report the failure.

## Pass

1. **Find the checks.** A verify skill has no fixed name, so find it by what it does: a project skill that runs a model checker, a prover, or another verifier against named code. Read each one you find, or the one the user named. For each check, collect the property, the code it covers, the bounds and assumptions, the command that runs it, and the commit where it was last confirmed to describe the code. If no verify skill exists, report it and ask whether to [create one](create.md). If the skill records no sync commit, use the last commit that changed the verification files, and say that you did.

2. **Run it as it is.** Run each check once before you change anything, and record the result. A pass here tells you that the old description still holds; whether the code is correct is still open. A failure here can be drift or a bug. Decide which in step 5.

3. **Read every change to covered code.** Diff the covered files from the sync commit to the current commit, and read each commit message. Also look for code that moved: a covered function that is renamed, split, or moved to another file is still covered code. Also look for new code that touches the state that a check guards, such as a new function that writes the same fields. For each change, decide which of these it is:
   - **No effect.** The change alters nothing the verification describes, such as formatting, comments, or code paths outside the verification's coverage. Check this against the model or harness, with the commit message as a hint only.
   - **The verification no longer describes the code.** A step that was one indivisible action is now two, a branch was added or removed, a check moved, a new path reaches the guarded state, or a value now has a different range. The model or harness must change.
   - **The promise changed on purpose.** The change alters what the code promises, and evidence in the change says that this is intended: the doc comment, the tests, the changelog, or the commit message. The property must change, and you must cite that evidence.
   - **The promise may be broken.** The code changed, and no evidence says that the promise changed. Treat a failure that follows as a bug candidate.

4. **Update from the code, before the result.** Change the model or harness so that each changed part again points to code that a reviewer can open, and keep one indivisible step in the code as one step in the verification. Write the update from the code before you rerun, so that a passing check never shapes it. Change a property only for a promise that changed on purpose. Write down the old wording, the new wording, and the evidence. Keep the bounds unless the change makes them wrong. If you must reduce a bound, say so in the report.

5. **Rerun and judge each result.**
   - **Pass:** the check can now pass on a description that has lost the ability to fail. Break the new code the way the property guards against, such as removing a new check or reordering a new step, and confirm that the check catches it. Then drop the break.
   - **Fail:** replay the counterexample against the real code, step by step. If a step cannot happen in the code, the verification is wrong. Fix the verification, and say what was wrong. If every step can happen, it is a bug. Name the commit that introduced it, tell the counterexample as a sequence of steps in the code's own words, and state the harm in one sentence. If a cheap test or reproduction against the real code shows the bug, add it to the report as evidence and keep it out of the product code.

6. **Update the verify skill.** Update the code that each check covers, the commands, the bounds, the assumptions, and the sync commit. Replace an old `maintain-formal-verification-skill` pointer with `formal-verification-skill maintain`. Set the sync commit to the commit that you checked. Leave the sync commit of a blocked check where it is, and say so in the report. Then follow the verify skill once as the next agent would, so that you know its steps still run.

## Report

Tell the user, for each check:

- the outcome, and the commits that you read;
- what changed in the verification and why, with a short reason for each change: the code changed shape, or the promise changed on purpose (with the evidence);
- the rerun result, and the break that you used to show the updated check can still fail;
- each bug, in plain words: the counterexample as steps in the code's words, the harm, and the commit that introduced it;
- what the verification still leaves uncovered, including new code that it should cover.

Say outright which failures were drift in the verification and which were bugs in the code. For a check that passed before you updated it and fails after, say that the old pass was on a stale description.

Keep the verification updates as a change of their own, separate from any product fix, and commit it when the user asks.
