# Build the Lever

Adapted from pstack `principle-build-the-lever`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](../LICENSE.txt).

When the work isn't trivial, build the tool that does it instead of doing it by hand. A codemod, generator, or script does the work the same way every time and reruns for free. It is one artifact a reviewer can read and rerun to check the work, where hand-done changes can only be re-verified by redoing them. A deterministic script turns "trust me" into "run this".

Default to building the lever. Skip it only when the task is trivial: one or two obvious edits you can see at a glance. The same edit at three or more call sites is never trivial.

- Do the first unit by hand to learn the recipe, then build the tool. Prove it by rerunning it on that unit and diffing against your hand-done version. Make the lever safe to rerun.
- Use a codemod or script for edits, a generator for repetitive files, a query over a dump (into SQLite, say) for analysis, and a rerunnable check for verification.
- A deterministic lever beats fan-out. If the tool can process every unit in one pass, run it yourself rather than fanning out subagents to hand-apply what a script can do.
- When you fan work out to subagents, write the lever as a skill they all read: the recipe, the verification contract, and the files they must not touch, in one artifact. Keep it outside their write scope so none can quietly edit the contract.
- Build the smallest script that does or proves the job, never a framework.
- Write the lever into the repository you are changing, outside the subtree it rewrites, where the change ships or the repo keeps its tooling, and leave it there after the run. Put it at the package or repo root (a scripts/ directory, say), never inside the migrated scope: the tool's own text holds the old name, so a later inventory of that name must not count the tool. A lever in /tmp, an outside directory, or deleted after use is no lever: nobody can find or rerun it.

The bar is triviality, not repetition. A one-off still earns a lever when the lever is what makes the work checkable.

Applying this produces a file. You skipped it when the diff has no codemod, script, generator, or delegate skill, when you made the same edit by hand in more than a few places, or when the only copy of the tool sat outside the repository. Name the lever you wrote — its path in the tree, the command that ran it, the files it changed, and its rerun — in what you hand back.

Distinct from [Prove It Works](../../verify/SKILL.md), which decides what counts as proof of an output. This builds the tool that does the work, and that tool's rerun is the proof.
