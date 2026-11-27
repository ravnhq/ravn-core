---
name: formal-verification-skill
description: Create or resync a project guide that formally checks a named property against the code it describes.
disable-model-invocation: true
license: See LICENSE.txt and LICENSE-maintain.txt
metadata:
  proof: subjective
---

# Formal verification skill

Leave a project-local skill that can rerun a formal check on a named property. Record its bounds, assumptions, covered code, and the commit where you confirmed the model or proof describes that code.

- **`create`:** For an unverified property, read [Create](references/create.md). Select the tool from the property, demonstrate that the check can fail, and leave the rerunnable guide.
- **`maintain`:** For an existing proof after code drift, read [Maintain](references/maintain.md). Start at the sync commit and distinguish drift from a bug before moving that commit forward.

An explicit mode wins. Ask if the requested scope is ambiguous. Edit the verification, not the product, unless the user asks. A change to the property, its bounds, or the code it describes invalidates prior proof until the check and the failure witness are rerun.

This command replaces `create-formal-verification-skill` and `maintain-formal-verification-skill`. To model-check a TLA+ spec with TLC and draw its Mermaid statechart and shortest counterexample paths, use [Statechart](../statechart/SKILL.md).
