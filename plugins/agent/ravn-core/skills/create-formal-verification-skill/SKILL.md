---
name: create-formal-verification-skill
description: "Generate a project-local skill that formally verifies the code where a bug costs the most and tests reach the least, in any language, with whichever verification tool fits. Use for /create-formal-verification-skill, \"model-check this race\", \"prove this invariant\", or when concurrency, retries, state machines, parsers, or unsafe code need more than tests."
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Create formal verification skill

A test checks the cases someone thought to write. Formal verification checks every case in a stated scope: every order of steps in a model, every input up to a bound, or every input. Find the part of the repo where that matters most, verify one property of it, and leave a project-local skill that lets the next agent check a change against that property. Write that skill for an agent who reads it cold, mid-change. The user must be able to trust the result and act on it without learning the verification language.

## Choose the target from the code

Answer from the codebase, and ask the user only what you cannot observe. If the user named an area or a bug, start there.

A good target is a promise the code makes, where a break harms users and tests rarely reach the case that breaks it. Choose the strongest such target in the repo over the one that is easiest to verify.

## Let the question choose the tool

Pick the tool that answers the question at the lowest cost: a model checker, a proof assistant, an SMT-backed verifier, or another tool. Whether events can happen in a bad order usually suits a model checker over a small model of the design, and TLA+ is the default for that in any language. Whether the code itself behaves for every input, as with memory safety, overflow, or a data-structure invariant, usually suits a verifier that runs on the code. If no verifier runs on this language, say so, and test the real code with generated inputs in place of a hand model of the function. A property that must hold at every size, where a bound falls short, can need a proof. Prefer a tool that the repo's developers can install and run, and tell the user why you chose it.

## What makes it good

- **True to the code.** Every part of the model or proof points to code that a reviewer can open. What the verification treats as one indivisible step is one indivisible step in the code. Names come from this repo.
- **Able to fail.** A check that you have never seen fail proves nothing. Show each property failing on a broken variant of the code it guards, such as a removed check or a reordered step.
- **Findings stay findings.** When the current code breaks the property, replay the counterexample against the real code, step by step. A step the code cannot take is a modeling error: fix the model. When every step can happen, it is a finding. Confirm it with a test that fails on the real code when a test can reach the case, keep that test beside the verification so the product's own suite stays as it was, and report the finding with the counterexample in the code's terms. Keep the property and the model as strict as the promise, and leave product code unchanged unless the user asks. An open finding keeps the check red; a green run means the property holds in scope.
- **Honest about scope.** Say what is verified, under which bounds and assumptions, and what is left out. A pass covers the model or the bound, and the report says so.
- **Readable without the tool.** State the property and the harm in one plain sentence each. Tell a counterexample as a short sequence of steps in the code's words.
- **Cheap to rerun.** One command that works from a fresh clone, fetches its tool at a pinned version itself, and leaves the tree as it found it, with a run short enough that the next agent will use it on every relevant change.
- **Kept in step with the code.** Record which files and functions each check covers, and the commit at which you last confirmed that the verification describes them. When the covered code changes after that commit, the next agent can see that the verification needs another look.

## Generate the verify skill

Write a project-local skill where the repo keeps its project skills, with frontmatter that names the area and says when to use it; a skill without frontmatter never registers. From the skill alone, the next agent must be able to tell whether a change touches the verified code, run the check, tell a real bug from a modeling error, and update the verification when a change is intended. Put the coverage record and the sync commit in the skill, and tell the next agent to move the sync commit forward only after it confirms that the verification describes the code at the new commit. Use this repo's real commands, paths, and nouns, with every placeholder filled. Refer to `maintain-formal-verification-skill` by name there; a link into this plugin breaks inside the project.

If the check is a TLA+ model, tell the next agent to read every result with the `statechart` skill. It shows each invariant violation the checker finds as its shortest path in plain words, and when the check passes, it draws a chart of how the system moves between states. Refer to `statechart` by name as well, and copy none of its commands, options, or file paths into the generated skill or its scripts: they change between releases and machines.

## Prove it before you hand off

Follow the generated skill once, as the next agent would, on a scratch change that breaks the property in the real code. It must catch the break. Then drop the scratch change and confirm that the check is back where it started: passing, or failing only on the findings you will report. A verify skill that was never run is a draft. If the skill misses the break or a step fails to run, fix the skill or the verification and keep the scratch change as it is.

## Hand off

Tell the user what you verified, which tool you used and why, the bounds, what the check found in plain words, how to run it, and what it leaves uncovered. Suggest a second target only if you found a close one. Name `maintain-formal-verification-skill` as the skill that brings the verification back in line after changes that skipped the check.
